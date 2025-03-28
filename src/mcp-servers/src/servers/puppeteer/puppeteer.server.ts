import { Request, Response } from 'express';
import { BaseMCPServer } from '../base.server';
import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import ServerConfig from '../../config/server.config';

export class PuppeteerServer extends BaseMCPServer {
  private browser: Browser | null = null;
  private downloadPath: string;

  constructor() {
    super('Puppeteer-MCP-Server');
    this.downloadPath = path.resolve(ServerConfig.uploadsDir, 'downloads');
    this.ensureDirectoryExists(this.downloadPath);
  }

  protected setupRoutes(): void {
    this.app.post('/download-pdf', this.downloadPdfHandler.bind(this));
    this.app.get('/status', this.statusHandler.bind(this));
  }

  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      console.log(`[${this.serverName}] Initializing browser...`);
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      // Handle browser disconnection
      this.browser.on('disconnected', () => {
        console.log(`[${this.serverName}] Browser disconnected`);
        this.browser = null;
      });
    }
    return this.browser;
  }

  private async downloadPdfHandler(req: Request, res: Response): Promise<void> {
    try {
      const { url, filename } = req.body;

      if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
      }

      // Validate the URL
      const isValid = await this.validateRequest(req);
      if (!isValid) {
        res.status(400).json({ error: 'Invalid request' });
        return;
      }

      const outputPath = await this.downloadPdf(url, filename);

      res.json({
        status: 'success',
        message: 'PDF downloaded successfully',
        path: outputPath
      });
    } catch (error) {
      this.logError(error as Error);
      res.status(500).json({
        error: 'PDF download failed',
        message: (error as Error).message
      });
    }
  }

  private async downloadPdf(url: string, customFilename?: string): Promise<string> {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    // Generate a filename if not provided
    const filename = customFilename || `download-${Date.now()}.pdf`;
    const outputPath = path.join(this.downloadPath, filename);

    console.log(`[${this.serverName}] Downloading PDF from ${url}`);

    try {
      // Configure download behavior
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: this.downloadPath
      });

      // Navigate to URL
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      if (url.endsWith('.pdf')) {
        // Direct PDF URL handling
        const response = await page.goto(url, { waitUntil: 'networkidle2' });
        const buffer = await response?.buffer();

        if (buffer) {
          fs.writeFileSync(outputPath, buffer);
          console.log(`[${this.serverName}] PDF saved to ${outputPath}`);
        } else {
          throw new Error('Failed to download PDF: No response buffer');
        }
      } else {
        // Handle website with PDF download links
        // This would need custom implementation based on the website structure
        throw new Error('Custom PDF download from websites not implemented');
      }

      await page.close();
      return outputPath;
    } catch (error) {
      console.error(`[${this.serverName}] Download error:`, error);
      throw error;
    }
  }

  private statusHandler(_req: Request, res: Response): void {
    res.json({
      status: 'healthy',
      browserActive: !!this.browser,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`[${this.serverName}] Created directory: ${dirPath}`);
    }
  }

  public async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log(`[${this.serverName}] Browser closed`);
    }
  }
}
import { Anthropic } from '@anthropic-ai/sdk';
import express, { Express, Request, Response } from 'express';
import ServerConfig from '../config/server.config';
import fs from 'fs';
import path from 'path';

export abstract class BaseMCPServer {
  protected app: Express;
  protected anthropic: Anthropic;
  protected serverName: string;

  constructor(serverName: string) {
    this.serverName = serverName;
    this.app = express();
    this.anthropic = new Anthropic({
      apiKey: ServerConfig.anthropicApiKey,
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupDownloadRoute();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: ServerConfig.maxRequestSize }));
    this.app.use((req, res, next) => {
      console.log(`[${this.serverName}] ${req.method} ${req.path}`);
      next();
    });
  }

  protected abstract setupRoutes(): void;

  private setupDownloadRoute(): void {
    this.app.get('/download', (req: Request, res: Response) => {
      try {
        const filePath = req.query.path;

        if (!filePath || typeof filePath !== 'string') {
          res.status(400).json({
            error: 'Invalid request',
            message: 'File path is required'
          });
          return;
        }

        // Resolve path and validate it's within uploads directory
        const fullPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(ServerConfig.uploadsDir, filePath);

        // Security check: ensure the path is within uploads directory
        const normalizedFullPath = path.normalize(fullPath);
        const normalizedUploadsDir = path.normalize(ServerConfig.uploadsDir);

        if (!normalizedFullPath.startsWith(normalizedUploadsDir)) {
          console.warn(`[${this.serverName}] Attempted to access file outside uploads directory: ${filePath}`);
          res.status(403).json({
            error: 'Access denied',
            message: 'Cannot access files outside the uploads directory'
          });
          return;
        }

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
          res.status(404).json({
            error: 'File not found',
            message: 'The requested file does not exist'
          });
          return;
        }

        // Get file stats to check if it's a file (not a directory)
        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) {
          res.status(400).json({
            error: 'Invalid request',
            message: 'The path does not point to a file'
          });
          return;
        }

        // Get filename for Content-Disposition header
        const filename = path.basename(fullPath);

        // Set appropriate headers
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', this.getContentType(filename));

        // Stream the file
        const fileStream = fs.createReadStream(fullPath);
        fileStream.on('error', (error) => {
          console.error(`[${this.serverName}] Error streaming file:`, error);
          // Only set headers if they haven't been sent yet
          if (!res.headersSent) {
            res.status(500).json({
              error: 'File streaming error',
              message: error.message
            });
          }
        });

        fileStream.pipe(res);
      } catch (error) {
        this.logError(error as Error);
        res.status(500).json({
          error: 'Download failed',
          message: (error as Error).message
        });
      }
    });
  }

  // Helper method to determine content type
  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();

    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif'
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: Function) => {
      console.error(`[${this.serverName}] Error:`, err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
      });
    });
  }

  public start(port: number = ServerConfig.port): void {
    this.app.listen(port, () => {
      console.log(`[${this.serverName}] MCP Server running on port ${port}`);
    });
  }

  protected async validateRequest(req: Request): Promise<boolean> {
    // Add your request validation logic here
    return true;
  }

  protected logError(error: Error): void {
    console.error(`[${this.serverName}] Error:`, error);
  }

  // Helper method to ensure a directory exists
  protected ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`[${this.serverName}] Created directory: ${dirPath}`);
    }
  }
}
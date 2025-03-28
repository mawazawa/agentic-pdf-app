import axios from 'axios';
import ServerConfig from '../config/server.config';
import fs from 'fs';
import path from 'path';

interface ServerEndpoint {
  name: string;
  url: string;
}

interface WorkflowResult {
  status: 'success' | 'failure';
  message: string;
  data?: any;
  error?: string;
}

export class WorkflowOrchestrator {
  private servers: Record<string, ServerEndpoint>;
  private workflowCache: Map<string, any>;

  constructor() {
    // Configure server endpoints
    this.servers = {
      puppeteer: {
        name: 'Puppeteer Server',
        url: `http://localhost:${ServerConfig.port}`
      },
      aiAnalysis: {
        name: 'AI Analysis Server',
        url: `http://localhost:${ServerConfig.port + 1}`
      }
    };

    // Initialize workflow cache for persisting state between steps
    this.workflowCache = new Map();

    console.log('[Orchestrator] Initialized with servers:',
      Object.entries(this.servers)
        .map(([key, endpoint]) => `${key}: ${endpoint.url}`)
        .join(', ')
    );
  }

  /**
   * Run the complete PDF analysis workflow
   */
  public async runPdfAnalysisWorkflow(
    pdfUrl: string,
    options?: {
      analysisProvider?: 'perplexity' | 'openai';
      filename?: string;
      skipDownloadOnError?: boolean;
    }
  ): Promise<WorkflowResult> {
    const workflowId = `workflow-${Date.now()}`;
    const skipDownloadOnError = options?.skipDownloadOnError ?? true; // Default to true

    try {
      console.log(`[Orchestrator] Starting workflow ${workflowId} for PDF ${pdfUrl}`);

      // Step 1: Download PDF
      console.log(`[Orchestrator] Step 1: Downloading PDF from ${pdfUrl}`);
      let downloadResult: WorkflowResult;

      try {
        downloadResult = await this.downloadPdf(pdfUrl, options?.filename);
      } catch (error) {
        console.error(`[Orchestrator] PDF download failed:`, error);
        return {
          status: 'failure',
          message: 'PDF download failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      if (downloadResult.status === 'failure') {
        return downloadResult;
      }

      const pdfPath = downloadResult.data.path;

      // Cache the intermediate result
      this.workflowCache.set(`${workflowId}-download`, downloadResult);

      // Step 2: Extract form fields
      console.log(`[Orchestrator] Step 2: Extracting form fields from ${pdfPath}`);
      let extractionResult: WorkflowResult;

      try {
        extractionResult = await this.extractFormFields(
          pdfPath,
          options?.analysisProvider
        );
      } catch (error) {
        console.error(`[Orchestrator] Field extraction failed:`, error);
        return {
          status: 'failure',
          message: 'Field extraction failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          data: {
            // Still include the downloaded PDF path so it can be accessed if needed
            pdfPath: skipDownloadOnError ? null : pdfPath
          }
        };
      }

      if (extractionResult.status === 'failure') {
        return {
          ...extractionResult,
          data: {
            // Still include the downloaded PDF path so it can be accessed if needed
            pdfPath: skipDownloadOnError ? null : pdfPath
          }
        };
      }

      // Cache the final result
      this.workflowCache.set(`${workflowId}-extraction`, extractionResult);

      // Return the combined result
      return {
        status: 'success',
        message: 'PDF analysis workflow completed successfully',
        data: {
          pdfPath,
          fields: extractionResult.data.fields,
          provider: extractionResult.data.provider,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`[Orchestrator] Workflow error:`, error);
      return {
        status: 'failure',
        message: 'PDF analysis workflow failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Step 1: Download PDF using Puppeteer Server
   */
  private async downloadPdf(
    pdfUrl: string,
    customFilename?: string
  ): Promise<WorkflowResult> {
    try {
      const response = await axios.post(
        `${this.servers.puppeteer.url}/download-pdf`,
        {
          url: pdfUrl,
          filename: customFilename || `download-${Date.now()}.pdf`
        }
      );

      if (response.data && response.data.status === 'success') {
        return {
          status: 'success',
          message: 'PDF downloaded successfully',
          data: {
            path: response.data.path
          }
        };
      }

      return {
        status: 'failure',
        message: 'PDF download failed',
        error: 'Invalid response from Puppeteer server'
      };
    } catch (error) {
      console.error('[Orchestrator] Download error:', error);
      return {
        status: 'failure',
        message: 'PDF download failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Step 2: Extract form fields using AI Analysis Server
   */
  private async extractFormFields(
    pdfPath: string,
    provider?: 'perplexity' | 'openai'
  ): Promise<WorkflowResult> {
    try {
      // Ensure file exists
      if (!fs.existsSync(pdfPath)) {
        return {
          status: 'failure',
          message: 'PDF file not found',
          error: `File does not exist at path: ${pdfPath}`
        };
      }

      const response = await axios.post(
        `${this.servers.aiAnalysis.url}/extract-fields`,
        {
          pdfPath,
          provider,
          options: {
            max_tokens: 8192
          }
        }
      );

      if (response.data && response.data.status === 'success') {
        return {
          status: 'success',
          message: 'Form fields extracted successfully',
          data: {
            fields: response.data.fields,
            provider: response.data.provider
          }
        };
      }

      return {
        status: 'failure',
        message: 'Field extraction failed',
        error: 'Invalid response from AI Analysis server'
      };
    } catch (error) {
      console.error('[Orchestrator] Extraction error:', error);
      return {
        status: 'failure',
        message: 'Field extraction failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Get the results of a completed workflow
   */
  public getWorkflowResult(workflowId: string): any {
    const downloadResult = this.workflowCache.get(`${workflowId}-download`);
    const extractionResult = this.workflowCache.get(`${workflowId}-extraction`);

    if (!downloadResult || !extractionResult) {
      return null;
    }

    return {
      download: downloadResult,
      extraction: extractionResult,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear workflow data from cache
   */
  public clearWorkflowCache(workflowId: string): boolean {
    this.workflowCache.delete(`${workflowId}-download`);
    this.workflowCache.delete(`${workflowId}-extraction`);
    return true;
  }
}
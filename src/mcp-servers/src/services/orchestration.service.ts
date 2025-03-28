import { Request, Response } from 'express';
import { BaseMCPServer } from '../servers/base.server';
import { WorkflowOrchestrator } from '../orchestration/workflow.orchestrator';
import ServerConfig from '../config/server.config';

export class OrchestrationService extends BaseMCPServer {
  private orchestrator: WorkflowOrchestrator;
  private activeWorkflows: Map<string, {
    status: string;
    startTime: Date;
    completedTime?: Date;
  }>;

  constructor() {
    super('Orchestration-Service');
    this.orchestrator = new WorkflowOrchestrator();
    this.activeWorkflows = new Map();
  }

  protected setupRoutes(): void {
    this.app.post('/workflow/pdf-analysis', this.startPdfAnalysisWorkflow.bind(this));
    this.app.get('/workflow/:workflowId', this.getWorkflowStatus.bind(this));
    this.app.delete('/workflow/:workflowId', this.clearWorkflow.bind(this));
    this.app.get('/status', this.statusHandler.bind(this));
  }

  private async startPdfAnalysisWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { pdfUrl, analysisProvider, filename } = req.body;

      if (!pdfUrl) {
        res.status(400).json({ error: 'PDF URL is required' });
        return;
      }

      // Generate a workflow ID
      const workflowId = `pdf-analysis-${Date.now()}`;

      // Register the workflow
      this.activeWorkflows.set(workflowId, {
        status: 'running',
        startTime: new Date()
      });

      // Start the workflow asynchronously
      this.runWorkflowAsync(workflowId, pdfUrl, analysisProvider, filename);

      // Return immediately with the workflow ID
      res.json({
        status: 'accepted',
        message: 'PDF analysis workflow started',
        workflowId
      });
    } catch (error) {
      this.logError(error as Error);
      res.status(500).json({
        error: 'Failed to start PDF analysis workflow',
        message: (error as Error).message
      });
    }
  }

  private async runWorkflowAsync(
    workflowId: string,
    pdfUrl: string,
    analysisProvider?: 'perplexity' | 'openai',
    filename?: string
  ): Promise<void> {
    try {
      console.log(`[${this.serverName}] Running workflow ${workflowId} asynchronously`);

      const result = await this.orchestrator.runPdfAnalysisWorkflow(pdfUrl, {
        analysisProvider,
        filename
      });

      // Update workflow status
      this.activeWorkflows.set(workflowId, {
        status: result.status,
        startTime: this.activeWorkflows.get(workflowId)?.startTime || new Date(),
        completedTime: new Date()
      });

      console.log(`[${this.serverName}] Workflow ${workflowId} completed with status: ${result.status}`);
    } catch (error) {
      console.error(`[${this.serverName}] Workflow ${workflowId} failed:`, error);

      // Update workflow status
      this.activeWorkflows.set(workflowId, {
        status: 'failure',
        startTime: this.activeWorkflows.get(workflowId)?.startTime || new Date(),
        completedTime: new Date()
      });
    }
  }

  private async getWorkflowStatus(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;

      if (!workflowId) {
        res.status(400).json({ error: 'Workflow ID is required' });
        return;
      }

      // Check if workflow exists
      const workflowStatus = this.activeWorkflows.get(workflowId);

      if (!workflowStatus) {
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }

      // If workflow is completed, get the result
      if (workflowStatus.status !== 'running') {
        const result = this.orchestrator.getWorkflowResult(workflowId);

        res.json({
          workflowId,
          status: workflowStatus.status,
          startTime: workflowStatus.startTime,
          completedTime: workflowStatus.completedTime,
          result
        });
        return;
      }

      // If workflow is still running
      res.json({
        workflowId,
        status: workflowStatus.status,
        startTime: workflowStatus.startTime,
        message: 'Workflow is still running'
      });
    } catch (error) {
      this.logError(error as Error);
      res.status(500).json({
        error: 'Failed to get workflow status',
        message: (error as Error).message
      });
    }
  }

  private async clearWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;

      if (!workflowId) {
        res.status(400).json({ error: 'Workflow ID is required' });
        return;
      }

      // Check if workflow exists
      if (!this.activeWorkflows.has(workflowId)) {
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }

      // Clear workflow data
      this.orchestrator.clearWorkflowCache(workflowId);
      this.activeWorkflows.delete(workflowId);

      res.json({
        status: 'success',
        message: 'Workflow data cleared successfully'
      });
    } catch (error) {
      this.logError(error as Error);
      res.status(500).json({
        error: 'Failed to clear workflow data',
        message: (error as Error).message
      });
    }
  }

  private statusHandler(_req: Request, res: Response): void {
    const activeWorkflowCount = this.activeWorkflows.size;
    const runningWorkflowCount = Array.from(this.activeWorkflows.values())
      .filter(workflow => workflow.status === 'running')
      .length;

    res.json({
      status: 'healthy',
      workflows: {
        total: activeWorkflowCount,
        running: runningWorkflowCount,
        completed: activeWorkflowCount - runningWorkflowCount
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }
}
import { PDFServer } from './servers/pdf.server';
import { PuppeteerServer } from './servers/puppeteer/puppeteer.server';
import { AIAnalysisServer } from './servers/ai-analysis/ai-analysis.server';
import { OrchestrationService } from './services/orchestration.service';
import ServerConfig from './config/server.config';
import fs from 'fs';
import path from 'path';

console.log('Starting Agentic PDF MCP Servers...');
console.log(`Environment: ${ServerConfig.environment}`);
console.log(`Log Level: ${ServerConfig.logLevel}`);

// Ensure required directories exist
const requiredDirs = [
  ServerConfig.uploadsDir,
  path.resolve(ServerConfig.uploadsDir, 'downloads')
];

requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Initialize and start Puppeteer Server
const puppeteerServer = new PuppeteerServer();
puppeteerServer.start(ServerConfig.port);

// Initialize and start AI Analysis Server
const aiAnalysisServer = new AIAnalysisServer();
aiAnalysisServer.start(ServerConfig.port + 1);

// Initialize and start Orchestration Service
const orchestrationService = new OrchestrationService();
orchestrationService.start(ServerConfig.port + 2);

console.log(`Puppeteer Server running on port ${ServerConfig.port}`);
console.log(`AI Analysis Server running on port ${ServerConfig.port + 1}`);
console.log(`Orchestration Service running on port ${ServerConfig.port + 2}`);

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Performing graceful shutdown...');

  // Cleanup resources if needed
  await (puppeteerServer as any).shutdown?.();

  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Performing graceful shutdown...');

  // Cleanup resources if needed
  await (puppeteerServer as any).shutdown?.();

  process.exit(0);
});
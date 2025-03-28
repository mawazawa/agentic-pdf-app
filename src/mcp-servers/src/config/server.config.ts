import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const ServerConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  logLevel: process.env.LOG_LEVEL || 'info',

  // Server paths
  rootDir: path.resolve(__dirname, '../../'),
  uploadsDir: path.resolve(__dirname, '../../uploads'),

  // Security
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

  // Performance
  maxRequestSize: '50mb',
  timeout: 30000, // 30 seconds
};

// Validate required environment variables
const requiredEnvVars = ['ANTHROPIC_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export default ServerConfig;
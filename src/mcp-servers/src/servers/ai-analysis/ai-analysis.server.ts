import { Request, Response } from 'express';
import { BaseMCPServer } from '../base.server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import ServerConfig from '../../config/server.config';

// Configuration for API providers
interface ApiConfig {
  apiKey: string;
  baseUrl: string;
}

interface AnalysisRequest {
  pdfPath: string;
  provider?: 'perplexity' | 'openai';
  options?: Record<string, any>;
}

interface FieldData {
  name: string;
  type: string;
  description: string;
  location?: {
    page: number;
    coordinates?: number[];
  };
}

export class AIAnalysisServer extends BaseMCPServer {
  private perplexityConfig: ApiConfig;
  private openaiConfig: ApiConfig;

  constructor() {
    super('AI-Analysis-MCP-Server');

    // Initialize API configurations
    this.perplexityConfig = {
      apiKey: process.env.PERPLEXITY_API_KEY || '',
      baseUrl: 'https://api.perplexity.ai'
    };

    this.openaiConfig = {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: 'https://api.openai.com/v1'
    };
  }

  protected setupRoutes(): void {
    this.app.post('/extract-fields', this.extractFieldsHandler.bind(this));
    this.app.get('/status', this.statusHandler.bind(this));
  }

  private async extractFieldsHandler(req: Request, res: Response): Promise<void> {
    try {
      const analysisRequest = req.body as AnalysisRequest;

      if (!analysisRequest.pdfPath) {
        res.status(400).json({ error: 'PDF path is required' });
        return;
      }

      // Validate request
      const isValid = await this.validateRequest(req);
      if (!isValid) {
        res.status(400).json({ error: 'Invalid request' });
        return;
      }

      // Check if file exists
      const fullPath = path.isAbsolute(analysisRequest.pdfPath)
        ? analysisRequest.pdfPath
        : path.resolve(ServerConfig.uploadsDir, analysisRequest.pdfPath);

      if (!fs.existsSync(fullPath)) {
        res.status(404).json({
          error: 'PDF file not found',
          path: fullPath
        });
        return;
      }

      // Choose API provider (default to Perplexity)
      const provider = analysisRequest.provider || 'perplexity';

      // Extract PDF fields
      const fields = await this.extractPdfFields(fullPath, provider, analysisRequest.options);

      res.json({
        status: 'success',
        provider,
        fields,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logError(error as Error);
      res.status(500).json({
        error: 'Field extraction failed',
        message: (error as Error).message
      });
    }
  }

  private async extractPdfFields(
    pdfPath: string,
    provider: 'perplexity' | 'openai',
    options?: Record<string, any>
  ): Promise<FieldData[]> {
    // Read the PDF as base64 for API submission
    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64Pdf = pdfBuffer.toString('base64');

    console.log(`[${this.serverName}] Extracting fields from ${pdfPath} using ${provider}`);

    if (provider === 'perplexity') {
      return this.extractWithPerplexity(base64Pdf, options);
    } else {
      return this.extractWithOpenAI(base64Pdf, options);
    }
  }

  private async extractWithPerplexity(base64Pdf: string, options?: Record<string, any>): Promise<FieldData[]> {
    try {
      const apiKey = this.perplexityConfig.apiKey;

      if (!apiKey) {
        throw new Error('Perplexity API key not configured');
      }

      const prompt = `
        Analyze this PDF form and identify all empty fields that need to be filled out.
        For each field, extract:
        1. Field name or identifier
        2. Field type (text, checkbox, date, number, etc.)
        3. A brief description of what information should be entered
        4. If possible, the page number where the field appears

        Format your response as a JSON array with one object per field.
        Only include empty fields that need to be filled in, not fields that already contain data.
      `;

      const response = await axios.post(
        `${this.perplexityConfig.baseUrl}/sonar/api/v1/query`,
        {
          model: "sonar-medium-online",
          document: base64Pdf,
          query: prompt,
          override_settings: options || {}
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Parse and validate the response
      if (response.data && response.data.answer) {
        try {
          // Extract the JSON from the response text if needed
          const jsonMatch = response.data.answer.match(/\[.*\]/s);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }

          // If no JSON array detected, try to parse the entire answer
          const fields = JSON.parse(response.data.answer);
          return Array.isArray(fields) ? fields : [];
        } catch (parseError) {
          console.error(`[${this.serverName}] Error parsing Perplexity response:`, parseError);
          throw new Error('Failed to parse API response');
        }
      }

      throw new Error('Invalid API response format from Perplexity');
    } catch (error) {
      console.error(`[${this.serverName}] Perplexity API error:`, error);
      throw error;
    }
  }

  private async extractWithOpenAI(base64Pdf: string, options?: Record<string, any>): Promise<FieldData[]> {
    try {
      const apiKey = this.openaiConfig.apiKey;

      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await axios.post(
        `${this.openaiConfig.baseUrl}/chat/completions`,
        {
          model: options?.model || "gpt-4-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `
                    Analyze this PDF form and identify all empty fields that need to be filled out.
                    For each field, extract:
                    1. Field name or identifier
                    2. Field type (text, checkbox, date, number, etc.)
                    3. A brief description of what information should be entered
                    4. If possible, the page number where the field appears

                    Format your response as a JSON array with one object per field.
                    Only include empty fields that need to be filled in, not fields that already contain data.
                  `
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${base64Pdf}`
                  }
                }
              ]
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: options?.max_tokens || 4096
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const content = response.data.choices[0].message.content;
        try {
          const parsedResponse = JSON.parse(content);
          return parsedResponse.fields || [];
        } catch (parseError) {
          console.error(`[${this.serverName}] Error parsing OpenAI response:`, parseError);
          throw new Error('Failed to parse API response');
        }
      }

      throw new Error('Invalid API response format from OpenAI');
    } catch (error) {
      console.error(`[${this.serverName}] OpenAI API error:`, error);
      throw error;
    }
  }

  private statusHandler(_req: Request, res: Response): void {
    res.json({
      status: 'healthy',
      providers: {
        perplexity: !!this.perplexityConfig.apiKey,
        openai: !!this.openaiConfig.apiKey
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }
}
import { Request, Response } from 'express';
import { BaseMCPServer } from '../base.server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import ServerConfig from '../../config/server.config';

interface ApiConfig {
  apiKey: string;
  baseUrl: string;
}

interface ExtractionRequest {
  documentPath: string;
  documentType?: string;
  targetFields?: string[];
  provider?: 'perplexity' | 'openai';
  options?: Record<string, any>;
}

export class DocumentExtractionServer extends BaseMCPServer {
  private perplexityConfig: ApiConfig;
  private openaiConfig: ApiConfig;
  private upload: multer.Multer;

  constructor() {
    super('Document-Extraction-Server');

    // Initialize API configurations
    this.perplexityConfig = {
      apiKey: process.env.PERPLEXITY_API_KEY || '',
      baseUrl: 'https://api.perplexity.ai'
    };

    this.openaiConfig = {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: 'https://api.openai.com/v1'
    };

    // Configure file upload
    const uploadDir = path.resolve(ServerConfig.uploadsDir, 'donor-documents');
    this.ensureDirectoryExists(uploadDir);

    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      }
    });

    this.upload = multer({
      storage,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        // Accept images, PDFs, and common document types
        const allowedTypes = [
          'image/jpeg', 'image/png', 'image/webp',
          'application/pdf',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`Unsupported file type: ${file.mimetype}`));
        }
      }
    });
  }

  protected setupRoutes(): void {
    this.app.post('/upload', this.upload.single('document'), this.handleDocumentUpload.bind(this));
    this.app.post('/extract-data', this.extractDataHandler.bind(this));
    this.app.get('/status', this.statusHandler.bind(this));
  }

  private async handleDocumentUpload(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No document uploaded' });
        return;
      }

      res.json({
        status: 'success',
        message: 'Document uploaded successfully',
        document: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          path: req.file.path,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } catch (error) {
      this.logError(error as Error);
      res.status(500).json({
        error: 'Document upload failed',
        message: (error as Error).message
      });
    }
  }

  private async extractDataHandler(req: Request, res: Response): Promise<void> {
    try {
      const extractionRequest = req.body as ExtractionRequest;

      if (!extractionRequest.documentPath) {
        res.status(400).json({ error: 'Document path is required' });
        return;
      }

      // Validate request
      const isValid = await this.validateRequest(req);
      if (!isValid) {
        res.status(400).json({ error: 'Invalid request' });
        return;
      }

      // Check if file exists
      const fullPath = path.isAbsolute(extractionRequest.documentPath)
        ? extractionRequest.documentPath
        : path.resolve(ServerConfig.uploadsDir, extractionRequest.documentPath);

      if (!fs.existsSync(fullPath)) {
        res.status(404).json({
          error: 'Document not found',
          path: fullPath
        });
        return;
      }

      // Choose API provider (default to Perplexity)
      const provider = extractionRequest.provider || 'perplexity';

      // Extract document data
      const extractedData = await this.extractDocumentData(
        fullPath,
        extractionRequest.documentType,
        extractionRequest.targetFields,
        provider,
        extractionRequest.options
      );

      res.json({
        status: 'success',
        provider,
        documentType: extractionRequest.documentType || 'auto-detected',
        extractedData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logError(error as Error);
      res.status(500).json({
        error: 'Data extraction failed',
        message: (error as Error).message
      });
    }
  }

  private async extractDocumentData(
    documentPath: string,
    documentType?: string,
    targetFields?: string[],
    provider: 'perplexity' | 'openai' = 'perplexity',
    options?: Record<string, any>
  ): Promise<Record<string, any>> {
    // Get file extension to handle different document types
    const fileExt = path.extname(documentPath).toLowerCase();
    const mimeType = this.getMimeType(fileExt);

    console.log(`[${this.serverName}] Extracting data from ${documentPath} (${mimeType}) using ${provider}`);

    // Read the document as base64 for API submission
    const docBuffer = fs.readFileSync(documentPath);
    const base64Doc = docBuffer.toString('base64');

    if (provider === 'perplexity') {
      return this.extractWithPerplexity(base64Doc, mimeType, documentType, targetFields, options);
    } else {
      return this.extractWithOpenAI(base64Doc, mimeType, documentType, targetFields, options);
    }
  }

  private async extractWithPerplexity(
    base64Doc: string,
    mimeType: string,
    documentType?: string,
    targetFields?: string[],
    options?: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      const apiKey = this.perplexityConfig.apiKey;

      if (!apiKey) {
        throw new Error('Perplexity API key not configured');
      }

      let prompt = `
        I need you to extract structured information from this ${documentType || 'document'}.

        Extract all personal information, dates, identifiers, and relevant data that could be used to fill out a legal form.
        Include fields such as:
        - Full name, including first name, last name, and middle name/initial if available
        - Date of birth
        - Address information (street, city, state, zip)
        - Phone numbers
        - Email addresses
        - License numbers or IDs
        - Case numbers (if applicable)
        - Any other relevant structured information

        Format your response as a JSON object with appropriate field names.
      `;

      if (targetFields && targetFields.length > 0) {
        prompt = `
          I need you to extract specific fields from this ${documentType || 'document'}.

          Please find and extract the following fields:
          ${targetFields.map(field => `- ${field}`).join('\n')}

          Format your response as a JSON object with these exact field names.
          If a field is not found, set its value to null.
        `;
      }

      const response = await axios.post(
        `${this.perplexityConfig.baseUrl}/sonar/api/v1/query`,
        {
          model: "sonar-medium-online",
          document: base64Doc,
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
          const jsonMatch = response.data.answer.match(/\{.*\}/s);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }

          // If no JSON object detected, try to parse the entire answer
          const extractedData = JSON.parse(response.data.answer);
          return typeof extractedData === 'object' ? extractedData : {};
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

  private async extractWithOpenAI(
    base64Doc: string,
    mimeType: string,
    documentType?: string,
    targetFields?: string[],
    options?: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      const apiKey = this.openaiConfig.apiKey;

      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      let promptText = `
        I need you to extract structured information from this ${documentType || 'document'}.

        Extract all personal information, dates, identifiers, and relevant data that could be used to fill out a legal form.
        Include fields such as:
        - Full name, including first name, last name, and middle name/initial if available
        - Date of birth
        - Address information (street, city, state, zip)
        - Phone numbers
        - Email addresses
        - License numbers or IDs
        - Case numbers (if applicable)
        - Any other relevant structured information

        Format your response as a JSON object with appropriate field names.
      `;

      if (targetFields && targetFields.length > 0) {
        promptText = `
          I need you to extract specific fields from this ${documentType || 'document'}.

          Please find and extract the following fields:
          ${targetFields.map(field => `- ${field}`).join('\n')}

          Format your response as a JSON object with these exact field names.
          If a field is not found, set its value to null.
        `;
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
                  text: promptText
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Doc}`
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
          return JSON.parse(content);
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

  private getMimeType(fileExt: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return mimeTypes[fileExt] || 'application/octet-stream';
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`[${this.serverName}] Created directory: ${dirPath}`);
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
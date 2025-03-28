import { Request, Response } from 'express';
import { BaseMCPServer } from '../base.server';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import ServerConfig from '../../config/server.config';
import { PythonBridge } from '../../services/python-bridge';

interface FormFillingRequest {
  formPath: string;
  formData: Record<string, any>;
  outputFilename?: string;
  donorDocuments?: string[];
}

export class FormFillingServer extends BaseMCPServer {
  private outputDir: string;
  private pythonBridge: PythonBridge;

  constructor() {
    super('Form-Filling-Server');
    this.outputDir = path.resolve(ServerConfig.uploadsDir, 'filled-forms');
    this.ensureDirectoryExists(this.outputDir);
    this.pythonBridge = new PythonBridge();
  }

  protected setupRoutes(): void {
    this.app.post('/fill-form', this.fillFormHandler.bind(this));
    this.app.post('/process-document', this.processDocumentHandler.bind(this));
    this.app.get('/status', this.statusHandler.bind(this));
  }

  private async processDocumentHandler(req: Request, res: Response): Promise<void> {
    try {
      const request = req.body as FormFillingRequest;

      if (!request.formPath || !request.donorDocuments || !request.donorDocuments.length) {
        res.status(400).json({ error: 'Form path and donor documents are required' });
        return;
      }

      // Validate the request
      const isValid = await this.validateRequest(req);
      if (!isValid) {
        res.status(400).json({ error: 'Invalid request' });
        return;
      }

      // Check if form exists
      const formPath = path.isAbsolute(request.formPath)
        ? request.formPath
        : path.resolve(ServerConfig.uploadsDir, request.formPath);

      if (!fs.existsSync(formPath)) {
        res.status(404).json({
          error: 'Form not found',
          path: formPath
        });
        return;
      }

      // Check if all donor documents exist
      const donorDocumentPaths = request.donorDocuments.map(doc =>
        path.isAbsolute(doc) ? doc : path.resolve(ServerConfig.uploadsDir, doc)
      );

      for (const docPath of donorDocumentPaths) {
        if (!fs.existsSync(docPath)) {
          res.status(404).json({
            error: 'Donor document not found',
            path: docPath
          });
          return;
        }
      }

      // Generate output filename
      const filename = request.outputFilename || `filled-${path.basename(formPath)}`;
      const outputPath = path.join(this.outputDir, filename);

      // Process the document using Python FormFiller
      console.log(`[${this.serverName}] Processing document with Python FormFiller`);
      console.log(`[${this.serverName}] Form: ${formPath}`);
      console.log(`[${this.serverName}] Donor Documents: ${donorDocumentPaths.join(', ')}`);
      console.log(`[${this.serverName}] Output: ${outputPath}`);

      const result = await this.pythonBridge.processDocument(
        formPath,
        donorDocumentPaths,
        outputPath
      );

      if (result.status === 'success') {
        res.json({
          status: 'success',
          message: 'Document processed successfully',
          filledForm: {
            path: outputPath,
            filename: path.basename(outputPath)
          },
          stats: {
            fieldCount: result.field_count,
            mappedFields: result.mapped_fields
          }
        });
      } else {
        res.status(500).json({
          error: 'Document processing failed',
          message: result.message
        });
      }
    } catch (error) {
      this.logError(error as Error);
      res.status(500).json({
        error: 'Document processing failed',
        message: (error as Error).message
      });
    }
  }

  private async fillFormHandler(req: Request, res: Response): Promise<void> {
    try {
      const request = req.body as FormFillingRequest;

      if (!request.formPath || !request.formData) {
        res.status(400).json({ error: 'Form path and form data are required' });
        return;
      }

      // Validate the request
      const isValid = await this.validateRequest(req);
      if (!isValid) {
        res.status(400).json({ error: 'Invalid request' });
        return;
      }

      // Check if form exists
      const formPath = path.isAbsolute(request.formPath)
        ? request.formPath
        : path.resolve(ServerConfig.uploadsDir, request.formPath);

      if (!fs.existsSync(formPath)) {
        res.status(404).json({
          error: 'Form not found',
          path: formPath
        });
        return;
      }

      // Generate output filename
      const filename = request.outputFilename || `filled-${path.basename(formPath)}`;
      const outputPath = path.join(this.outputDir, filename);

      // Try filling the form using Python first
      try {
        console.log(`[${this.serverName}] Filling form using Python FormFiller`);
        const pythonResult = await this.pythonBridge.fillPdf(
          formPath,
          request.formData,
          outputPath
        );

        console.log(`[${this.serverName}] Python FormFiller result: ${pythonResult}`);

        res.json({
          status: 'success',
          message: 'Form filled successfully with Python FormFiller',
          filledForm: {
            path: outputPath,
            filename: path.basename(outputPath)
          }
        });
        return;
      } catch (pythonError) {
        console.warn(`[${this.serverName}] Failed to fill form with Python FormFiller: ${pythonError}`);
        console.log(`[${this.serverName}] Falling back to JavaScript implementation`);
      }

      // Fall back to JavaScript implementation
      const outputPathJS = await this.fillPdfFormJS(formPath, request.formData, filename);

      res.json({
        status: 'success',
        message: 'Form filled successfully with JavaScript fallback',
        filledForm: {
          path: outputPathJS,
          filename: path.basename(outputPathJS)
        }
      });
    } catch (error) {
      this.logError(error as Error);
      res.status(500).json({
        error: 'Form filling failed',
        message: (error as Error).message
      });
    }
  }

  private async fillPdfFormJS(
    formPath: string,
    formData: Record<string, any>,
    outputFilename?: string
  ): Promise<string> {
    try {
      // Read the PDF
      const formBuffer = fs.readFileSync(formPath);

      // Load the PDF document
      const pdfDoc = await PDFDocument.load(formBuffer);

      // Get form fields
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      console.log(`[${this.serverName}] Form has ${fields.length} fields`);

      // Map of field name variations to standardized names
      const fieldNameVariations: Record<string, string[]> = {
        'firstName': ['first_name', 'first', 'fname', 'givenname'],
        'lastName': ['last_name', 'last', 'lname', 'surname', 'familyname'],
        'fullName': ['full_name', 'name', 'fullname'],
        'dateOfBirth': ['dob', 'date_of_birth', 'birthdate', 'birth_date'],
        'address': ['street_address', 'streetaddress', 'addr'],
        'city': ['city_name', 'cityname', 'town'],
        'state': ['state_name', 'statename', 'province'],
        'zipCode': ['zip', 'zip_code', 'postal', 'postal_code', 'postalcode'],
        'phoneNumber': ['phone', 'telephone', 'phone_number', 'tel', 'mobile'],
        'email': ['email_address', 'emailaddress', 'mail'],
      };

      // Fill form fields
      for (const field of fields) {
        const fieldName = field.getName();
        console.log(`[${this.serverName}] Processing field: ${fieldName}`);

        // Try direct match first
        if (formData[fieldName] !== undefined) {
          this.fillField(form, fieldName, formData[fieldName]);
          continue;
        }

        // Try case-insensitive match
        const lcFieldName = fieldName.toLowerCase();
        const matchingKey = Object.keys(formData).find(k => k.toLowerCase() === lcFieldName);

        if (matchingKey) {
          this.fillField(form, fieldName, formData[matchingKey]);
          continue;
        }

        // Try variations
        let filled = false;
        for (const [standardKey, variations] of Object.entries(fieldNameVariations)) {
          if (variations.some(v => lcFieldName.includes(v))) {
            // Found a variation match
            if (formData[standardKey] !== undefined) {
              this.fillField(form, fieldName, formData[standardKey]);
              filled = true;
              break;
            }
          }
        }

        if (filled) continue;

        // If no match found, try best-effort fuzzy matching
        // This is a simple approach - compare first 4 chars of field names
        for (const [key, value] of Object.entries(formData)) {
          if (lcFieldName.substring(0, 4) === key.toLowerCase().substring(0, 4)) {
            this.fillField(form, fieldName, value);
            break;
          }
        }
      }

      // Flatten the form to prevent further editing
      form.flatten();

      // Save the filled form
      const filledPdfBytes = await pdfDoc.save();

      // Generate output filename
      const filename = outputFilename || `filled-${path.basename(formPath)}`;
      const outputPath = path.join(this.outputDir, filename);

      // Write to file
      fs.writeFileSync(outputPath, filledPdfBytes);
      console.log(`[${this.serverName}] Filled form saved to: ${outputPath}`);

      return outputPath;
    } catch (error) {
      console.error(`[${this.serverName}] Form filling error:`, error);
      throw error;
    }
  }

  private fillField(form: any, fieldName: string, value: any): void {
    try {
      const field = form.getField(fieldName);

      if (!field) {
        console.warn(`[${this.serverName}] Field not found: ${fieldName}`);
        return;
      }

      const fieldType = field.constructor.name;
      console.log(`[${this.serverName}] Filling field ${fieldName} (${fieldType}) with value: ${value}`);

      switch (fieldType) {
        case 'PDFTextField':
          field.setText(String(value));
          break;
        case 'PDFCheckBox':
          if (value === true || value === 'true' || value === 'yes' || value === 'checked') {
            field.check();
          } else {
            field.uncheck();
          }
          break;
        case 'PDFRadioGroup':
          field.select(String(value));
          break;
        case 'PDFDropdown':
          field.select(String(value));
          break;
        case 'PDFOptionList':
          if (Array.isArray(value)) {
            field.select(value.map(v => String(v)));
          } else {
            field.select(String(value));
          }
          break;
        default:
          console.warn(`[${this.serverName}] Unsupported field type: ${fieldType}`);
      }
    } catch (error) {
      console.warn(`[${this.serverName}] Error filling field ${fieldName}:`, error);
    }
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
      uptime: process.uptime(),
      outputDirectory: this.outputDir,
      timestamp: new Date().toISOString()
    });
  }
}
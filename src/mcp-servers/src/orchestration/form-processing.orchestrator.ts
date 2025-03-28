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

interface FormFillingOptions {
  analysisProvider?: 'perplexity' | 'openai';
  confidenceThreshold?: number;
  skipEmptyFields?: boolean;
  allowPartial?: boolean;
  skipDownloadOnError?: boolean;
}

export class FormProcessingOrchestrator {
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
      },
      documentExtraction: {
        name: 'Document Extraction Server',
        url: `http://localhost:${ServerConfig.port + 3}`
      },
      fieldMapping: {
        name: 'Field Mapping Service',
        url: `http://localhost:${ServerConfig.port + 4}`
      },
      formFilling: {
        name: 'Form Filling Server',
        url: `http://localhost:${ServerConfig.port + 5}`
      }
    };

    // Initialize workflow cache for persisting state between steps
    this.workflowCache = new Map();

    console.log('[Form Orchestrator] Initialized with servers:',
      Object.entries(this.servers)
        .map(([key, endpoint]) => `${key}: ${endpoint.url}`)
        .join(', ')
    );
  }

  /**
   * Run the form auto-filling workflow
   */
  public async runFormFillingWorkflow(
    pdfFormUrl: string,
    donorDocumentPaths: string[],
    options?: FormFillingOptions
  ): Promise<WorkflowResult> {
    const workflowId = `form-filling-${Date.now()}`;
    const skipDownloadOnError = options?.skipDownloadOnError ?? true; // Default to true

    try {
      console.log(`[Form Orchestrator] Starting workflow ${workflowId} for form ${pdfFormUrl}`);

      // Step 1: Download the PDF form
      console.log(`[Form Orchestrator] Step 1: Downloading form from ${pdfFormUrl}`);
      let downloadResult: WorkflowResult;

      try {
        downloadResult = await this.downloadPdf(pdfFormUrl);
      } catch (error) {
        console.error(`[Form Orchestrator] Form download failed:`, error);
        return {
          status: 'failure',
          message: 'Form download failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      if (downloadResult.status === 'failure') {
        return downloadResult;
      }

      const formPath = downloadResult.data.path;

      // Cache the intermediate result
      this.workflowCache.set(`${workflowId}-download`, downloadResult);

      // Step 2: Extract empty form fields
      console.log(`[Form Orchestrator] Step 2: Extracting form fields from ${formPath}`);
      let fieldExtractionResult: WorkflowResult;

      try {
        fieldExtractionResult = await this.extractFormFields(
          formPath,
          options?.analysisProvider
        );
      } catch (error) {
        console.error(`[Form Orchestrator] Field extraction failed:`, error);
        return {
          status: 'failure',
          message: 'Field extraction failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          data: {
            formPath: skipDownloadOnError ? null : formPath
          }
        };
      }

      if (fieldExtractionResult.status === 'failure') {
        return {
          ...fieldExtractionResult,
          data: {
            formPath: skipDownloadOnError ? null : formPath
          }
        };
      }

      const formFields = fieldExtractionResult.data.fields;

      // Cache the intermediate result
      this.workflowCache.set(`${workflowId}-fields`, fieldExtractionResult);

      // Step 3: Extract data from donor documents
      console.log(`[Form Orchestrator] Step 3: Extracting data from ${donorDocumentPaths.length} donor documents`);
      const donorDataPromises = donorDocumentPaths.map(async (docPath) => {
        try {
          return await this.extractDonorData(docPath, options?.analysisProvider);
        } catch (error) {
          console.error(`[Form Orchestrator] Donor data extraction failed for ${docPath}:`, error);
          return {
            status: 'failure',
            message: `Failed to extract data from ${path.basename(docPath)}`,
            error: error instanceof Error ? error.message : 'Unknown error'
          } as WorkflowResult;
        }
      });

      const donorDataResults = await Promise.all(donorDataPromises);

      // Check if all donor data extractions failed
      const allDonorExtrationsFailed = donorDataResults.every(result => result.status === 'failure');
      if (allDonorExtrationsFailed && donorDocumentPaths.length > 0) {
        return {
          status: 'failure',
          message: 'All donor data extractions failed',
          error: 'Failed to extract data from any donor documents',
          data: {
            formPath: skipDownloadOnError ? null : formPath,
            fields: formFields
          }
        };
      }

      // Combine donor data, with later documents overriding earlier ones
      const donorData = donorDataResults.reduce((combined, result) => {
        if (result.status === 'success' && result.data.extractedData) {
          return { ...combined, ...result.data.extractedData };
        }
        return combined;
      }, {});

      // Cache the intermediate result
      this.workflowCache.set(`${workflowId}-donor-data`, donorData);

      // Step 4: Map donor data to form fields
      console.log(`[Form Orchestrator] Step 4: Mapping donor data to form fields`);
      let fieldMappingResult: WorkflowResult;

      try {
        fieldMappingResult = await this.mapFieldsToData(
          formFields,
          donorData,
          options?.confidenceThreshold
        );
      } catch (error) {
        console.error(`[Form Orchestrator] Field mapping failed:`, error);
        return {
          status: 'failure',
          message: 'Field mapping failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          data: {
            formPath: skipDownloadOnError ? null : formPath,
            fields: formFields,
            donorData: Object.keys(donorData).length > 0 ? donorData : null
          }
        };
      }

      if (fieldMappingResult.status === 'failure') {
        return {
          ...fieldMappingResult,
          data: {
            ...fieldMappingResult.data,
            formPath: skipDownloadOnError ? null : formPath
          }
        };
      }

      const mappedFields = fieldMappingResult.data.mappedFields;

      // Transform mapped fields into the format needed for form filling
      const formData = mappedFields.reduce((data: Record<string, any>, field: { fieldName: string; value: any }) => {
        data[field.fieldName] = field.value;
        return data;
      }, {} as Record<string, any>);

      // Cache the intermediate result
      this.workflowCache.set(`${workflowId}-mapping`, fieldMappingResult);

      // Step 5: Fill the form
      console.log(`[Form Orchestrator] Step 5: Filling the form with mapped data`);
      let formFillingResult: WorkflowResult;

      try {
        formFillingResult = await this.fillForm(
          formPath,
          formData
        );
      } catch (error) {
        console.error(`[Form Orchestrator] Form filling failed:`, error);
        return {
          status: 'failure',
          message: 'Form filling failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          data: {
            formPath: skipDownloadOnError ? null : formPath,
            mappedFields: mappedFields
          }
        };
      }

      if (formFillingResult.status === 'failure') {
        return {
          ...formFillingResult,
          data: {
            ...formFillingResult.data,
            formPath: skipDownloadOnError ? null : formPath,
            mappedFields: mappedFields
          }
        };
      }

      // Cache the final result
      this.workflowCache.set(`${workflowId}-filled-form`, formFillingResult);

      // Return the combined result
      return {
        status: 'success',
        message: 'Form filling workflow completed successfully',
        data: {
          originalFormPath: formPath,
          filledFormPath: formFillingResult.data.filledForm.path,
          filledFormFilename: formFillingResult.data.filledForm.filename,
          extractedFields: formFields.length,
          mappedFields: mappedFields.length,
          unmappedFields: fieldMappingResult.data.unmappedFormFields.length,
          donorDataFields: Object.keys(donorData).length,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`[Form Orchestrator] Workflow error:`, error);
      return {
        status: 'failure',
        message: 'Form filling workflow failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Step 1: Download PDF using Puppeteer Server
   */
  private async downloadPdf(pdfUrl: string): Promise<WorkflowResult> {
    try {
      const response = await axios.post(
        `${this.servers.puppeteer.url}/download-pdf`,
        {
          url: pdfUrl,
          filename: `form-${Date.now()}.pdf`
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
      console.error('[Form Orchestrator] Download error:', error);
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
      console.error('[Form Orchestrator] Field extraction error:', error);
      return {
        status: 'failure',
        message: 'Field extraction failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Step 3: Extract data from donor documents
   */
  private async extractDonorData(
    documentPath: string,
    provider?: 'perplexity' | 'openai'
  ): Promise<WorkflowResult> {
    try {
      // Ensure file exists
      if (!fs.existsSync(documentPath)) {
        return {
          status: 'failure',
          message: 'Donor document not found',
          error: `File does not exist at path: ${documentPath}`
        };
      }

      const response = await axios.post(
        `${this.servers.documentExtraction.url}/extract-data`,
        {
          documentPath,
          provider,
          options: {
            max_tokens: 8192
          }
        }
      );

      if (response.data && response.data.status === 'success') {
        return {
          status: 'success',
          message: 'Donor data extracted successfully',
          data: {
            extractedData: response.data.extractedData,
            provider: response.data.provider
          }
        };
      }

      return {
        status: 'failure',
        message: 'Donor data extraction failed',
        error: 'Invalid response from Document Extraction server'
      };
    } catch (error) {
      console.error('[Form Orchestrator] Donor extraction error:', error);
      return {
        status: 'failure',
        message: 'Donor data extraction failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Step 4: Map form fields to donor data
   */
  private async mapFieldsToData(
    formFields: Array<{name: string; type: string; description: string}>,
    donorData: Record<string, any>,
    confidenceThreshold?: number
  ): Promise<WorkflowResult> {
    try {
      const response = await axios.post(
        `${this.servers.fieldMapping.url}/map-fields`,
        {
          formFields,
          donorData,
          confidence: confidenceThreshold
        }
      );

      if (response.data && response.data.status === 'success') {
        return {
          status: 'success',
          message: 'Fields mapped successfully',
          data: {
            mappedFields: response.data.mappedFields,
            unmappedFormFields: response.data.unmappedFormFields,
            unmappedDonorFields: response.data.unmappedDonorFields,
            confidenceThreshold: response.data.confidenceThreshold
          }
        };
      }

      return {
        status: 'failure',
        message: 'Field mapping failed',
        error: 'Invalid response from Field Mapping service'
      };
    } catch (error) {
      console.error('[Form Orchestrator] Field mapping error:', error);
      return {
        status: 'failure',
        message: 'Field mapping failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Step 5: Fill form with mapped data
   */
  private async fillForm(
    formPath: string,
    formData: Record<string, any>
  ): Promise<WorkflowResult> {
    try {
      // Ensure file exists
      if (!fs.existsSync(formPath)) {
        return {
          status: 'failure',
          message: 'Form not found',
          error: `File does not exist at path: ${formPath}`
        };
      }

      const response = await axios.post(
        `${this.servers.formFilling.url}/fill-form`,
        {
          formPath,
          formData,
          outputFilename: `filled-${path.basename(formPath)}`
        }
      );

      if (response.data && response.data.status === 'success') {
        return {
          status: 'success',
          message: 'Form filled successfully',
          data: {
            filledForm: response.data.filledForm
          }
        };
      }

      return {
        status: 'failure',
        message: 'Form filling failed',
        error: 'Invalid response from Form Filling server'
      };
    } catch (error) {
      console.error('[Form Orchestrator] Form filling error:', error);
      return {
        status: 'failure',
        message: 'Form filling failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Get the results of a completed workflow
   */
  public getWorkflowResult(workflowId: string): any {
    const downloadResult = this.workflowCache.get(`${workflowId}-download`);
    const fieldsResult = this.workflowCache.get(`${workflowId}-fields`);
    const donorDataResult = this.workflowCache.get(`${workflowId}-donor-data`);
    const mappingResult = this.workflowCache.get(`${workflowId}-mapping`);
    const filledFormResult = this.workflowCache.get(`${workflowId}-filled-form`);

    if (!downloadResult || !fieldsResult || !filledFormResult) {
      return null;
    }

    return {
      download: downloadResult,
      fields: fieldsResult,
      donorData: donorDataResult,
      mapping: mappingResult,
      filledForm: filledFormResult,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear workflow data from cache
   */
  public clearWorkflowCache(workflowId: string): boolean {
    this.workflowCache.delete(`${workflowId}-download`);
    this.workflowCache.delete(`${workflowId}-fields`);
    this.workflowCache.delete(`${workflowId}-donor-data`);
    this.workflowCache.delete(`${workflowId}-mapping`);
    this.workflowCache.delete(`${workflowId}-filled-form`);
    return true;
  }
}
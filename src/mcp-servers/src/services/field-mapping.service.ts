import { Request, Response } from 'express';
import { BaseMCPServer } from '../servers/base.server';
import axios from 'axios';
import ServerConfig from '../config/server.config';

interface MappingRequest {
  formFields: Array<{
    name: string;
    type: string;
    description: string;
    location?: {
      page: number;
      coordinates?: number[];
    };
  }>;
  donorData: Record<string, any>;
  confidence?: number;
}

interface MappingResult {
  fieldName: string;
  value: any;
  confidence: number;
  source: string;
}

export class FieldMappingService extends BaseMCPServer {
  private confidenceThreshold: number;

  constructor() {
    super('Field-Mapping-Service');
    this.confidenceThreshold = 0.7; // Default threshold
  }

  protected setupRoutes(): void {
    this.app.post('/map-fields', this.mapFieldsHandler.bind(this));
    this.app.get('/status', this.statusHandler.bind(this));
  }

  private async mapFieldsHandler(req: Request, res: Response): Promise<void> {
    try {
      const request = req.body as MappingRequest;

      if (!request.formFields || !request.donorData) {
        res.status(400).json({ error: 'Form fields and donor data are required' });
        return;
      }

      // Apply custom confidence threshold if provided
      const confidenceThreshold = request.confidence || this.confidenceThreshold;

      // Map fields from donor data to form fields
      const mappedFields = this.mapFields(request.formFields, request.donorData, confidenceThreshold);

      res.json({
        status: 'success',
        mappedFields,
        confidenceThreshold,
        unmappedFormFields: request.formFields
          .filter(field => !mappedFields.some(m => m.fieldName === field.name)),
        unmappedDonorFields: Object.keys(request.donorData)
          .filter(key => !mappedFields.some(m => m.source === key))
      });
    } catch (error) {
      this.logError(error as Error);
      res.status(500).json({
        error: 'Field mapping failed',
        message: (error as Error).message
      });
    }
  }

  private mapFields(
    formFields: Array<{name: string; type: string; description: string}>,
    donorData: Record<string, any>,
    confidenceThreshold: number
  ): MappingResult[] {
    const results: MappingResult[] = [];
    const commonFieldMappings: Record<string, string[]> = {
      // Common donor data field names mapped to potential form field names
      'firstName': ['first_name', 'first', 'fname', 'givenname', 'given_name'],
      'lastName': ['last_name', 'last', 'lname', 'surname', 'family_name', 'familyname'],
      'fullName': ['full_name', 'name', 'fullname', 'complete_name', 'completename'],
      'dateOfBirth': ['dob', 'date_of_birth', 'birthdate', 'birth_date'],
      'address': ['street_address', 'streetaddress', 'addr', 'street', 'residence'],
      'addressLine1': ['address_line_1', 'address1', 'addr1', 'street1'],
      'addressLine2': ['address_line_2', 'address2', 'addr2', 'street2', 'apt', 'unit'],
      'city': ['city_name', 'cityname', 'town', 'municipality'],
      'state': ['state_name', 'statename', 'province', 'region'],
      'zipCode': ['zip', 'zip_code', 'postal', 'postal_code', 'postalcode'],
      'phoneNumber': ['phone', 'telephone', 'phone_number', 'tel', 'mobile', 'cell'],
      'email': ['email_address', 'emailaddress', 'mail', 'e-mail'],
      'ssn': ['social_security', 'social_security_number', 'socialsecurity', 'social'],
      'driversLicense': ['drivers_license', 'dl_number', 'license_number', 'licensenumber'],
      'gender': ['sex', 'gender_identity'],
      'birthPlace': ['place_of_birth', 'birth_place', 'birthcity', 'birth_city'],
    };

    // Process each form field
    for (const formField of formFields) {
      const fieldName = formField.name;
      const fieldDesc = formField.description.toLowerCase();
      const lcFieldName = fieldName.toLowerCase();

      // Try direct mapping first
      if (donorData[fieldName] !== undefined) {
        results.push({
          fieldName,
          value: donorData[fieldName],
          confidence: 1.0,
          source: fieldName
        });
        continue;
      }

      // Check for common mappings
      let mapped = false;

      // From donor data keys to form fields
      for (const [donorKey, formVariations] of Object.entries(commonFieldMappings)) {
        if (donorData[donorKey] !== undefined &&
            (formVariations.some(v => lcFieldName.includes(v)) ||
             lcFieldName.includes(donorKey.toLowerCase()))) {
          results.push({
            fieldName,
            value: donorData[donorKey],
            confidence: 0.9,
            source: donorKey
          });
          mapped = true;
          break;
        }
      }

      if (mapped) continue;

      // From form fields to donor data
      for (const [donorKey, formVariations] of Object.entries(commonFieldMappings)) {
        for (const donorField of Object.keys(donorData)) {
          if (formVariations.some(v => donorField.toLowerCase().includes(v)) ||
              donorField.toLowerCase().includes(donorKey.toLowerCase())) {
            if (formVariations.some(v => lcFieldName.includes(v)) ||
                lcFieldName.includes(donorKey.toLowerCase())) {
              results.push({
                fieldName,
                value: donorData[donorField],
                confidence: 0.85,
                source: donorField
              });
              mapped = true;
              break;
            }
          }
        }
        if (mapped) break;
      }

      if (mapped) continue;

      // Try fuzzy matching based on descriptions
      for (const [donorKey, value] of Object.entries(donorData)) {
        // Check if donor key appears in field description
        if (fieldDesc.includes(donorKey.toLowerCase())) {
          results.push({
            fieldName,
            value,
            confidence: 0.8,
            source: donorKey
          });
          mapped = true;
          break;
        }

        // Check if field name has significant overlap with donor key (at least 4 chars)
        const donorKeyLower = donorKey.toLowerCase();
        if (lcFieldName.length >= 4 && donorKeyLower.length >= 4) {
          if (lcFieldName.includes(donorKeyLower.substring(0, 4)) ||
              donorKeyLower.includes(lcFieldName.substring(0, 4))) {
            results.push({
              fieldName,
              value,
              confidence: 0.7,
              source: donorKey
            });
            mapped = true;
            break;
          }
        }
      }
    }

    // Filter by confidence threshold
    return results.filter(result => result.confidence >= confidenceThreshold);
  }

  private statusHandler(_req: Request, res: Response): void {
    res.json({
      status: 'healthy',
      confidenceThreshold: this.confidenceThreshold,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }
}
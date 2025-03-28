# Simplified PDF Form Filler with Sonar/OpenAI API

## Core Form Filling Functionality (Priority Implementation)

```python
from openai import OpenAI
import json
from pypdf import PdfReader, PdfWriter
import os
from tenacity import retry, stop_after_attempt, wait_exponential

class FormFiller:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv('SONAR_API_KEY'))  # Sonar API
        self.fallback_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))  # Fallback
        
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    def extract_form_fields(self, pdf_text):
        """Extract form fields using LLM with structured prompt"""
        prompt = f"""ANALYZE THIS PDF FORM STRUCTURE:
        {pdf_text[:15000]}
        
        OUTPUT JSON WITH:
        - fields: List of field objects containing:
          * name: Field identifier
          * type: Field data type (text/date/number)
          * description: Human-readable purpose
          * context_clues: List of nearby text clues
        """
        
        return self._call_api(prompt)
        
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))    
    def map_data_to_fields(self, form_schema, donor_text):
        """Map donor data to form fields using context-aware prompts"""
        prompt = f"""MATCH DONOR DATA TO FORM FIELDS:
        FORM SCHEMA: {json.dumps(form_schema)}
        DONOR DATA: {donor_text[:15000]}
        
        OUTPUT JSON WITH:
        - field_name: Original form field ID
        - value: Extracted value
        - source_text: Exact matching text snippet
        - confidence: 0-1 confidence score
        """
        
        return self._call_api(prompt)
        
    def _call_api(self, prompt):
        """Unified API caller with fallback"""
        try:
            return self.client.chat.completions.create(
                model="sonar-large-online",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            ).choices[0].message.content
        except Exception as e:
            return self.fallback_client.chat.completions.create(
                model="gpt-4-turbo",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            ).choices[0].message.content
            
    def fill_pdf(self, template_path, field_data, output_path):
        """Core PDF writing function"""
        reader = PdfReader(template_path)
        writer = PdfWriter()
        
        for page in reader.pages:
            writer.add_page(page)
            
        writer.update_page_form_field_values(
            writer.pages,
            {item['field_name']: item['value'] for item in field_data},
            auto_regenerate=False
        )
        
        with open(output_path, "wb") as f:
            writer.write(f)
```


## 5 Critical Unasked Questions (+Answers)

1. **Q: How to handle API rate limits during bulk processing?**
    - A: Implement exponential backoff with jitter and batch processing (5 docs/batch)
2. **Q: What validation exists for LLM-extracted field mappings?**
    - A: Add confidence threshold (0.7) with human review queue for low-confidence matches
3. **Q: How to preserve PDF formatting during writes?**
    - A: Use PyPDF's `auto_regenerate=False` flag and validate with PDF/A compliance checks
4. **Q: What's the fallback when both APIs fail?**
    - A: Implement local cache of common form schemas and queue for retries+notifications
5. **Q: How to handle multi-page form fields?**
    - A: Add page number tracking in extraction prompt and cross-reference field positions

## AI-Executable WBS (4 Levels)

**1.0 Core System Development**

- 1.1 API Integration Layer
    - 1.1.1 Sonar API Connector
    - 1.1.2 OpenAI Fallback Handler
    - 1.1.3 Rate Limit Manager
- 1.2 PDF Processing Engine
    - 1.2.1 Field Writer Module
    - 1.2.2 Format Preservation System
    - 1.2.3 Output Validator

**2.0 Context-Aware Processing**

- 2.1 Field Extraction System
    - 2.1.1 Schema Generator
    - 2.1.2 Context Analyzer
- 2.2 Data Mapping Logic
    - 2.2.1 Donor Text Processor
    - 2.2.2 Confidence Scorer
    - 2.2.3 Conflict Resolver

**3.0 Validation \& Error Handling**

- 3.1 Quality Control
    - 3.1.1 Field Coverage Checker
    - 3.1.2 Format Integrity Verifier
- 3.2 Error Recovery
    - 3.2.1 Retry Handler
    - 3.2.2 Failure Queue System

**4.0 Deployment Package**

- 4.1 Environment Setup
    - 4.1.1 Dependency Installer
    - 4.1.2 Config Generator
- 4.2 Test Suite
    - 4.2.1 Sample Forms Library
    - 4.2.2 Validation Scenarios


## AI Agent System Prompts

**Prompt 1: API Layer Implementation**

```
Create Python class with:
- Exponential backoff using tenacity
- Automatic API key rotation
- Response schema validation
- Unified error logging
Use: requests >=2.32, tenacity >=8.2
Validate with: Mock API endpoints
```

**Prompt 2: PDF Writer Rules**

```
Implement PyPDF writer that:
- Preserves original PDF metadata
- Maintains fillable field properties
- Adds modification timestamp
- Validates output with pdfplumber
Constraint: No third-party PDF libs except PyPDF
Test with: DV-100 sample form
```

**Prompt 3: Context Analyzer**

```
Create prompt engineering system that:
1. Extracts field context clues
2. Identifies value patterns (date formats, etc)
3. Detects field relationships
4. Generates search keywords
Output: JSON schema with validation examples
Use: Faker lib for test data generation
```

**Prompt 4: Deployment Package**

```
Build Dockerfile with:
- Python 3.11
- Minimal dependencies
- Healthcheck endpoint
- Log rotation
Include:
- .env template
- sample_forms/ directory
- pre-commit hooks
Validate: Docker build under 300MB
```

This structure enables AI agents to execute tasks in parallel while maintaining system cohesion. The WBS provides atomic implementation targets that can be completed in under 10 minutes each by modern coding agents.


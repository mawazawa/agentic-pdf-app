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
            print(f"Error calling primary API: {e}")
            try:
                return self.fallback_client.chat.completions.create(
                    model="gpt-4-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"}
                ).choices[0].message.content
            except Exception as e:
                print(f"Error calling fallback API: {e}")
                raise

    def fill_pdf(self, template_path, field_data, output_path):
        """Core PDF writing function"""
        reader = PdfReader(template_path)
        writer = PdfWriter()

        for page in reader.pages:
            writer.add_page(page)

        # Normalize field data to match PDF field names
        normalized_data = {}
        for item in field_data:
            if isinstance(item, dict) and 'field_name' in item and 'value' in item:
                normalized_data[item['field_name']] = item['value']
            elif isinstance(field_data, dict):
                # If field_data is already a dict, use it directly
                normalized_data = field_data
                break

        # Add debug logging
        print(f"Filling PDF with the following data: {json.dumps(normalized_data, indent=2)}")

        # Update form fields
        writer.update_page_form_field_values(
            writer.pages,
            normalized_data,
            auto_regenerate=False
        )

        # Save the filled PDF
        with open(output_path, "wb") as f:
            writer.write(f)

        print(f"Successfully wrote filled PDF to {output_path}")
        return output_path

    def process_document(self, template_path, donor_documents, output_path):
        """Full document processing pipeline"""
        try:
            # Step 1: Extract form text
            reader = PdfReader(template_path)
            form_text = ""
            for page in reader.pages:
                form_text += page.extract_text() + "\n"

            # Step 2: Extract form fields
            form_fields_json = self.extract_form_fields(form_text)
            form_fields = json.loads(form_fields_json)

            # Step 3: Compile donor document text
            donor_text = ""
            for doc_path in donor_documents:
                try:
                    if doc_path.lower().endswith('.pdf'):
                        doc_reader = PdfReader(doc_path)
                        for page in doc_reader.pages:
                            donor_text += page.extract_text() + "\n"
                    else:
                        with open(doc_path, 'r', encoding='utf-8') as f:
                            donor_text += f.read() + "\n"
                except Exception as e:
                    print(f"Error processing donor document {doc_path}: {e}")

            # Step 4: Map donor data to form fields
            field_mappings_json = self.map_data_to_fields(form_fields, donor_text)
            field_mappings = json.loads(field_mappings_json)

            # Step 5: Fill the form
            self.fill_pdf(template_path, field_mappings.get('mappings', []), output_path)

            return {
                "status": "success",
                "message": "Form processed successfully",
                "output_path": output_path,
                "field_count": len(form_fields.get('fields', [])),
                "mapped_fields": len(field_mappings.get('mappings', []))
            }
        except Exception as e:
            print(f"Error processing document: {e}")
            return {
                "status": "error",
                "message": f"Failed to process document: {str(e)}"
            }
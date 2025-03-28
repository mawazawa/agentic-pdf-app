import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Bridge for calling Python FormFiller from TypeScript
 */
export class PythonBridge {
  private pythonPath: string;
  private scriptDir: string;
  private pythonModuleDir: string;

  constructor(pythonPath: string = 'python3') {
    this.pythonPath = pythonPath;
    this.scriptDir = path.resolve(__dirname);
    this.pythonModuleDir = path.resolve(__dirname, '../../../python');
    this.ensureScriptsExist();
  }

  /**
   * Ensure all required Python scripts exist
   */
  private ensureScriptsExist(): void {
    const formFillerPath = path.join(this.pythonModuleDir, 'form_filler.py');
    if (!fs.existsSync(formFillerPath)) {
      console.error(`[PythonBridge] form_filler.py script not found at: ${formFillerPath}`);
    } else {
      console.log(`[PythonBridge] Found form_filler.py at ${formFillerPath}`);
    }
  }

  /**
   * Execute a Python function from the form-filler.py script
   * @param functionName Function name to execute
   * @param args Arguments to pass to the function
   * @returns Promise with the function result
   */
  public async executePythonFunction(
    functionName: string,
    args: Record<string, any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Create a temporary Python script to execute the function
      const tempScriptContent = `
import sys
import json
import os

# Add the module directory to the path
sys.path.insert(0, '${this.pythonModuleDir}')

from form_filler import FormFiller

# Set up environment variables
os.environ['SONAR_API_KEY'] = '${process.env.PERPLEXITY_API_KEY || ''}'
os.environ['OPENAI_API_KEY'] = '${process.env.OPENAI_API_KEY || ''}'

# Parse arguments
args = json.loads('''${JSON.stringify(args)}''')

# Create FormFiller instance
form_filler = FormFiller()

# Call requested function
result = getattr(form_filler, '${functionName}')(**args)

# Print result as JSON
print(json.dumps(result))
`;

      const tempScriptPath = path.join(this.scriptDir, `temp_${Date.now()}.py`);
      fs.writeFileSync(tempScriptPath, tempScriptContent);

      console.log(`[PythonBridge] Executing function: ${functionName}`);
      console.log(`[PythonBridge] Using Python module directory: ${this.pythonModuleDir}`);

      // Execute the temporary script
      const pythonProcess = spawn(this.pythonPath, [tempScriptPath]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`[PythonBridge] stderr: ${data.toString()}`);
      });

      pythonProcess.on('close', (code) => {
        // Clean up the temporary script
        fs.unlinkSync(tempScriptPath);

        if (code !== 0) {
          console.error(`[PythonBridge] Python process exited with code ${code}`);
          console.error(`[PythonBridge] stderr: ${stderr}`);
          reject(new Error(`Python execution failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          console.error(`[PythonBridge] Failed to parse Python output: ${stdout}`);
          reject(new Error(`Failed to parse Python output: ${error}`));
        }
      });
    });
  }

  /**
   * Process a document using FormFiller
   * @param templatePath Path to the template PDF
   * @param donorDocuments Array of paths to donor documents
   * @param outputPath Path to save the filled PDF
   * @returns Processing result
   */
  public async processDocument(
    templatePath: string,
    donorDocuments: string[],
    outputPath: string
  ): Promise<any> {
    return this.executePythonFunction('process_document', {
      template_path: templatePath,
      donor_documents: donorDocuments,
      output_path: outputPath
    });
  }

  /**
   * Fill a PDF form with data
   * @param templatePath Path to the template PDF
   * @param fieldData Field data to fill
   * @param outputPath Path to save the filled PDF
   * @returns Path to the filled PDF
   */
  public async fillPdf(
    templatePath: string,
    fieldData: Record<string, any> | Array<{field_name: string, value: any}>,
    outputPath: string
  ): Promise<string> {
    return this.executePythonFunction('fill_pdf', {
      template_path: templatePath,
      field_data: fieldData,
      output_path: outputPath
    });
  }
}
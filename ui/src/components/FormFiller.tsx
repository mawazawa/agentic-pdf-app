import { useRef, useState } from 'react';
import axios from 'axios';

interface ErrorMessage {
  message: string;
  details?: string;
  code?: string;
}

export default function FormFiller() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [jsonFormData, setJsonFormData] = useState('');
  const [errors, setErrors] = useState<ErrorMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const donorFileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);
    setErrors([]);

    try {
      const formFiles = fileInputRef.current?.files;
      const donorFiles = donorFileInputRef.current?.files;

      if (!formFiles || formFiles.length === 0) {
        throw new Error('Please select a form file');
      }

      // Upload form file
      const formData = new FormData();
      formData.append('form', formFiles[0]);

      let formPath: string;
      try {
        const formUploadResponse = await axios.post('http://localhost:3002/upload', formData);
        formPath = formUploadResponse.data.filePath;
      } catch (error) {
        console.error('Form upload error:', error);
        setErrors(prev => [...prev, {
          message: 'Failed to upload form file',
          details: error instanceof Error ? error.message : 'Unknown error'
        }]);
        setIsLoading(false);
        return; // Skip the rest of the process
      }

      // Handle donor documents if provided
      const donorPaths: string[] = [];
      if (donorFiles && donorFiles.length > 0) {
        try {
          for (let i = 0; i < donorFiles.length; i++) {
            const donorFormData = new FormData();
            donorFormData.append('document', donorFiles[i]);
            const donorUploadResponse = await axios.post('http://localhost:3002/upload', donorFormData);
            donorPaths.push(donorUploadResponse.data.filePath);
          }
        } catch (error) {
          console.error('Donor document upload error:', error);
          setErrors(prev => [...prev, {
            message: 'Failed to upload donor documents',
            details: error instanceof Error ? error.message : 'Unknown error'
          }]);
          setIsLoading(false);
          return; // Skip the rest of the process
        }
      }

      // Parse user-entered form data JSON if provided
      let parsedFormData = {};
      if (jsonFormData.trim()) {
        try {
          parsedFormData = JSON.parse(jsonFormData);
        } catch (error) {
          setErrors(prev => [...prev, {
            message: 'Invalid JSON in form data field',
            details: 'Please check your JSON syntax'
          }]);
          setIsLoading(false);
          return; // Skip the rest of the process
        }
      }

      // Process document if donor files are provided, otherwise just fill form
      try {
        let response;
        if (donorPaths.length > 0) {
          response = await axios.post('http://localhost:3002/fill', {
            formPath,
            donorDocuments: donorPaths
          });
        } else {
          response = await axios.post('http://localhost:3002/fill-form', {
            formPath,
            formData: parsedFormData
          });
        }

        setResult(response.data);
      } catch (error) {
        console.error('Form processing error:', error);
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown error';

        if (axios.isAxiosError(error) && error.response) {
          // Handle server errors with response data
          setErrors(prev => [...prev, {
            message: 'Form processing failed',
            details: error.response?.data?.error || error.response?.data?.message || errorMessage,
            code: String(error.response.status)
          }]);
        } else {
          setErrors(prev => [...prev, {
            message: 'Form processing failed',
            details: errorMessage
          }]);
        }

        // Don't set result if there's an error, so download won't be attempted
      }
    } catch (error) {
      console.error('General error:', error);
      setErrors(prev => [...prev, {
        message: 'Operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFilledForm = () => {
    if (result && result.filledForm && result.filledForm.path && !errors.length) {
      window.open(`http://localhost:3002/download?path=${encodeURIComponent(result.filledForm.path)}`, '_blank');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">PDF Form Filler</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block font-medium">
            Select Form (PDF):
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf"
              className="block w-full mt-1 border border-gray-300 rounded p-2"
              required
            />
          </label>
        </div>

        <div className="space-y-2">
          <label className="block font-medium">
            Select Donor Document(s):
            <input
              type="file"
              ref={donorFileInputRef}
              accept=".pdf,.txt"
              multiple
              className="block w-full mt-1 border border-gray-300 rounded p-2"
            />
            <span className="text-sm text-gray-500">Upload text files or PDFs with donor information</span>
          </label>
        </div>

        <div className="space-y-2">
          <label className="block font-medium">
            Form Data (JSON):
            <textarea
              value={jsonFormData}
              onChange={(e) => setJsonFormData(e.target.value)}
              className="block w-full mt-1 border border-gray-300 rounded p-2 h-32 font-mono"
              placeholder='{"fullName": "Jane Smith", "address": "123 Main St"}'
            />
            <span className="text-sm text-gray-500">Optional: Enter form field data as JSON (used if no donor documents provided)</span>
          </label>
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Fill Form'}
        </button>
      </form>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mt-8 p-4 border border-red-300 bg-red-50 rounded">
          <h2 className="text-xl font-semibold mb-2 text-red-700">Errors</h2>
          <ul className="list-disc pl-5 space-y-2">
            {errors.map((error, index) => (
              <li key={index} className="text-red-600">
                <strong>{error.message}</strong>
                {error.details && <div className="text-sm mt-1">{error.details}</div>}
                {error.code && <div className="text-xs mt-1">Error code: {error.code}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="mt-8 p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Result</h2>

          {result.error ? (
            <div className="text-red-600">
              Error: {result.error}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-green-600 font-medium">
                {result.message || 'Form processed successfully'}
              </div>

              {result.filledForm && !errors.length && (
                <div>
                  <p className="mb-2">File: {result.filledForm.filename}</p>
                  <button
                    onClick={downloadFilledForm}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Download Filled Form
                  </button>
                </div>
              )}

              {result.stats && (
                <div className="mt-2 text-sm">
                  <p>Fields found: {result.stats.fieldCount}</p>
                  <p>Fields mapped: {result.stats.mappedFields}</p>
                </div>
              )}
            </div>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-700">Raw Response</summary>
            <pre className="mt-2 p-2 bg-gray-100 overflow-auto text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
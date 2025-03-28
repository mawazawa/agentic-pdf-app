import { useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface DonorDocumentUploaderProps {
  donorDocs: string[];
  onDonorDocsChange: (docs: string[]) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export default function DonorDocumentUploader({
  donorDocs,
  onDonorDocsChange,
  onBack,
  onSubmit,
}: DonorDocumentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    onDrop: acceptedFiles => {
      uploadFiles(acceptedFiles);
    },
  });

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    setError('');

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('document', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const data = await response.json();
        return data.document.path;
      });

      const uploadedPaths = await Promise.all(uploadPromises);
      onDonorDocsChange([...donorDocs, ...uploadedPaths]);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload one or more files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (index: number) => {
    const updatedDocs = [...donorDocs];
    updatedDocs.splice(index, 1);
    onDonorDocsChange(updatedDocs);
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Step 2: Upload Supporting Documents</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Upload documents containing information to fill the form (ID, driver's license, other forms, etc.)
        </p>
      </div>

      <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
        <div
          {...getRootProps()}
          className={`mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md ${
            isDragActive ? 'border-primary-400 bg-primary-50' : 'border-gray-300'
          }`}
        >
          <div className="space-y-1 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex text-sm text-gray-600">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
              >
                <span>Upload a file</span>
                <input {...getInputProps()} id="file-upload" className="sr-only" />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">PNG, JPG, PDF, DOC up to 10MB</p>
          </div>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {uploading && (
          <div className="mt-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-600"></div>
            <span className="ml-2 text-sm text-gray-700">Uploading...</span>
          </div>
        )}

        {donorDocs.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-900">Uploaded Documents</h4>
            <ul className="mt-3 divide-y divide-gray-200">
              {donorDocs.map((doc, index) => (
                <li key={index} className="py-3 flex justify-between items-center">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="ml-2 text-sm text-gray-700 truncate max-w-xs">
                      {doc.split('/').pop() || doc}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDocument(index)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <svg
              className="mr-2 -ml-1 h-4 w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={donorDocs.length === 0 || uploading}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            Process Documents
            <svg
              className="ml-2 -mr-1 h-4 w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
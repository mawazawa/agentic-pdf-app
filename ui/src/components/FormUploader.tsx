import { useState } from 'react';

interface FormUploaderProps {
  formUrl: string;
  onFormUrlChange: (url: string) => void;
  onNext: () => void;
}

export default function FormUploader({ formUrl, onFormUrlChange, onNext }: FormUploaderProps) {
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const validateAndProceed = async () => {
    if (!formUrl.trim()) {
      setError('Please enter a form URL');
      return;
    }

    if (!formUrl.endsWith('.pdf')) {
      setError('URL must point to a PDF file');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      // Simple validation - check if URL exists
      const response = await fetch(formUrl, { method: 'HEAD' });

      if (!response.ok) {
        setError('Could not access the form. Please check the URL.');
        setIsValidating(false);
        return;
      }

      onNext();
    } catch (err) {
      setError('Could not validate the form URL. Please check it and try again.');
      console.error('Error validating form URL:', err);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Step 1: Select Form</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Enter the URL of the California court form you want to fill.
        </p>
      </div>
      <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
        <div className="mb-4">
          <label htmlFor="form-url" className="block text-sm font-medium text-gray-700">
            Form URL
          </label>
          <div className="mt-1">
            <input
              type="text"
              name="form-url"
              id="form-url"
              value={formUrl}
              onChange={(e) => {
                onFormUrlChange(e.target.value);
                if (error) setError('');
              }}
              className={`shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                error ? 'border-red-300' : ''
              }`}
              placeholder="https://courts.ca.gov/sites/default/files/courts/default/2024-11/dv100.pdf"
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <p className="mt-2 text-xs text-gray-500">
            Default: California DV-100 Domestic Violence Restraining Order Request form
          </p>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={validateAndProceed}
            disabled={isValidating}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isValidating ? 'Validating...' : 'Continue to Next Step'}
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
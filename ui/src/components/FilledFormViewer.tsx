import { useState } from 'react';

interface FilledFormViewerProps {
  resultUrl: string;
  onReset: () => void;
}

export default function FilledFormViewer({ resultUrl, onReset }: FilledFormViewerProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);

    try {
      // Get the filename from the URL
      const filename = resultUrl.split('/').pop() || 'filled-form.pdf';

      // Fetch the file
      const response = await fetch(`/api/download?path=${encodeURIComponent(resultUrl)}`);

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      // Convert to blob
      const blob = await response.blob();

      // Create download link and trigger click
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download the form. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Step 3: Completed Form</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Your form has been filled with information from your documents
        </p>
      </div>

      <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
        <div className="rounded-md bg-green-50 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success!</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>We've successfully filled your form. You can now download it.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="bg-gray-100 p-4 rounded-lg w-full max-w-md text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112.586 3L15 5.414A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M8 11a1 1 0 112 0v4a1 1 0 11-2 0v-4z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M10 11a1 1 0 10-2 0v4a1 1 0 102 0v-4z" clipRule="evenodd" />
            </svg>
            <p className="mt-2 text-sm text-gray-500 break-all">
              {resultUrl.split('/').pop() || resultUrl}
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {downloading ? 'Downloading...' : 'Download Filled Form'}
                <svg
                  className="ml-2 -mr-1 h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={onReset}
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
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
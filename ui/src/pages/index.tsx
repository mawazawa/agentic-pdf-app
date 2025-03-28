import React from 'react';
import Head from 'next/head';
import FormUploader from '../components/FormUploader';
import DonorDocumentUploader from '../components/DonorDocumentUploader';
import WorkflowProgress from '../components/WorkflowProgress';
import FilledFormViewer from '../components/FilledFormViewer';
import FormFiller from '../components/FormFiller';

export default function Home() {
  const [activeStep, setActiveStep] = React.useState(0);
  const [workflowId, setWorkflowId] = React.useState<string | null>(null);
  const [formUrl, setFormUrl] = React.useState('https://courts.ca.gov/sites/default/files/courts/default/2024-11/dv100.pdf');
  const [donorDocs, setDonorDocs] = React.useState<string[]>([]);
  const [resultUrl, setResultUrl] = React.useState<string | null>(null);

  const handleStartWorkflow = async () => {
    try {
      setActiveStep(2); // Set to processing state

      const response = await fetch('/api/workflow/pdf-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfUrl: formUrl,
          donorDocumentPaths: donorDocs,
          analysisProvider: 'perplexity',
        }),
      });

      const data = await response.json();

      if (data.workflowId) {
        setWorkflowId(data.workflowId);
        pollWorkflowStatus(data.workflowId);
      } else {
        console.error('Failed to start workflow', data);
        setActiveStep(0);
      }
    } catch (error) {
      console.error('Error starting workflow', error);
      setActiveStep(0);
    }
  };

  const pollWorkflowStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/workflow/${id}`);
      const data = await response.json();

      if (data.status === 'success') {
        setResultUrl(data.result?.filledForm?.path || null);
        setActiveStep(3); // Set to completed state
      } else if (data.status === 'failure') {
        console.error('Workflow failed', data);
        setActiveStep(0);
      } else {
        // Still processing, poll again after a delay
        setTimeout(() => pollWorkflowStatus(id), 2000);
      }
    } catch (error) {
      console.error('Error polling workflow status', error);
      setActiveStep(0);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setWorkflowId(null);
    setDonorDocs([]);
    setResultUrl(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>California Court Forms Filler</title>
        <meta name="description" content="Automatically fill California court forms using AI" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">California Court Forms Filler</h1>
          <p className="mt-1 text-sm text-gray-500">
            Easily fill court forms using information from your documents
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <WorkflowProgress
            activeStep={activeStep}
            onStepClick={(step) => {
              // Only allow going back to previous steps
              if (step < activeStep) {
                setActiveStep(step);
              }
            }}
          />

          <div className="mt-8">
            {activeStep === 0 && (
              <FormUploader
                formUrl={formUrl}
                onFormUrlChange={setFormUrl}
                onNext={() => setActiveStep(1)}
              />
            )}

            {activeStep === 1 && (
              <DonorDocumentUploader
                donorDocs={donorDocs}
                onDonorDocsChange={setDonorDocs}
                onBack={() => setActiveStep(0)}
                onSubmit={handleStartWorkflow}
              />
            )}

            {activeStep === 2 && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
                <h2 className="mt-4 text-xl font-semibold text-gray-700">Processing your documents</h2>
                <p className="mt-2 text-gray-500">
                  This may take a minute. We're extracting information and filling your form.
                </p>
              </div>
            )}

            {activeStep === 3 && resultUrl && (
              <FilledFormViewer
                resultUrl={resultUrl}
                onReset={handleReset}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
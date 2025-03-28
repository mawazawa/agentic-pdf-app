import axios from 'axios';

const ORCHESTRATION_SERVICE_URL = 'http://localhost:3002';
const PDF_URL = 'https://courts.ca.gov/sites/default/files/courts/default/2024-11/dv100.pdf';

async function runTest() {
  try {
    console.log('Starting PDF analysis workflow test...');
    console.log(`PDF URL: ${PDF_URL}`);

    // Step 1: Start the workflow
    console.log('\n1. Starting workflow...');
    const startResponse = await axios.post(
      `${ORCHESTRATION_SERVICE_URL}/workflow/pdf-analysis`,
      {
        pdfUrl: PDF_URL,
        analysisProvider: 'perplexity', // or 'openai'
        filename: 'dv100.pdf'
      }
    );

    console.log('Workflow started:', startResponse.data);

    if (startResponse.data.status !== 'accepted' || !startResponse.data.workflowId) {
      throw new Error('Failed to start workflow');
    }

    const workflowId = startResponse.data.workflowId;

    // Step 2: Poll for workflow completion
    console.log(`\n2. Polling for workflow ${workflowId} completion...`);
    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second delay

    while (!isCompleted && attempts < maxAttempts) {
      attempts++;

      console.log(`Checking status (attempt ${attempts})...`);
      const statusResponse = await axios.get(
        `${ORCHESTRATION_SERVICE_URL}/workflow/${workflowId}`
      );

      if (statusResponse.data.status !== 'running') {
        isCompleted = true;
        console.log('\nWorkflow completed!');
        console.log('Final status:', statusResponse.data.status);

        if (statusResponse.data.result) {
          console.log('\nExtracted fields:');
          console.log(JSON.stringify(statusResponse.data.result, null, 2));
        }

        break;
      }

      // Wait for 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    if (!isCompleted) {
      console.log('Workflow did not complete within the timeout period.');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
runTest();
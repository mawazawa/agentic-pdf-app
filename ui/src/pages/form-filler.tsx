import Head from 'next/head';
import FormFiller from '../components/FormFiller';

export default function FormFillerPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>PDF Form Filler Test</title>
        <meta name="description" content="Test page for the PDF Form Filler functionality" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">PDF Form Filler Test</h1>
          <p className="mt-1 text-sm text-gray-500">
            Simple interface for testing the PDF form filling functionality
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <FormFiller />
        </div>
      </main>
    </div>
  );
}
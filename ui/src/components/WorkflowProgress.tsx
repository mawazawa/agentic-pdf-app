import React from 'react';

interface WorkflowProgressProps {
  activeStep: number;
  onStepClick: (step: number) => void;
}

const steps = [
  { id: 0, name: 'Select Form' },
  { id: 1, name: 'Upload Documents' },
  { id: 2, name: 'Processing' },
  { id: 3, name: 'Review & Download' },
];

export default function WorkflowProgress({ activeStep, onStepClick }: WorkflowProgressProps) {
  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {steps.map((step, stepIdx) => (
          <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''} ${stepIdx !== 0 ? 'pl-8 sm:pl-20' : ''}`}>
            {stepIdx !== steps.length - 1 && (
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className={`h-0.5 w-full ${stepIdx < activeStep ? 'bg-primary-600' : 'bg-gray-200'}`} />
              </div>
            )}
            <button
              type="button"
              onClick={() => onStepClick(step.id)}
              className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                step.id < activeStep
                  ? 'bg-primary-600 hover:bg-primary-700'
                  : step.id === activeStep
                  ? 'bg-primary-600'
                  : 'bg-gray-200'
              } border-2 border-white ${step.id <= activeStep ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            >
              {step.id < activeStep ? (
                <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              ) : (
                <span className={`text-sm font-semibold ${step.id === activeStep ? 'text-white' : 'text-gray-700'}`}>
                  {step.id + 1}
                </span>
              )}
            </button>
            <span className="absolute mt-2 ml-[-12px] text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">
              {step.name}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
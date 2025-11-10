import React from 'react';

const BranchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <circle cx="9" cy="12" r="2.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h2.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.5 12h3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 12l5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 12l5 5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 12h5" />
  </svg>
);

export default BranchIcon;

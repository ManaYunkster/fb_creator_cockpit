import React from 'react';

const ItalicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l-4.5 15m4.5-15h6m-6 0L8.25 19.5" />
  </svg>
);

export default ItalicIcon;

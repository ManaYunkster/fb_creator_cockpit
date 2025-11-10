import React from 'react';

const BoldIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h4.5a3 3 0 0 1 0 6h-4.5v-6Zm0 6h5.25a3 3 0 0 1 0 6H8.25v-6Z" />
  </svg>
);

export default BoldIcon;

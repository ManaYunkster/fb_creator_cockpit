import React from 'react';

const LadybugIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17" />
    <circle cx="9.5" cy="10.5" r="1" />
    <circle cx="14.5" cy="10.5" r="1" />
    <circle cx="9.5" cy="14.5" r="1" />
    <circle cx="14.5" cy="14.5" r="1" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 5l2 2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 5l-2 2" />
  </svg>
);

export default LadybugIcon;
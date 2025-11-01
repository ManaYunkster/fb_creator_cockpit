import React from 'react';

const ListNumberedIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 6h9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 12h9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 18h9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16a2 2 0 1 1 4 0c0 .591-.5 1-1.5 1.5s-1.5.909-1.5 1.5a2 2 0 1 0 4 0" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 10V4l-2 2" />
  </svg>
);

export default ListNumberedIcon;

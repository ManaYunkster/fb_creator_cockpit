import React from 'react';

const ListBulletIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM3.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 5.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
  </svg>
);

export default ListBulletIcon;

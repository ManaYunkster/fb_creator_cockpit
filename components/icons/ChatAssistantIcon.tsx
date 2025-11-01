
import React from 'react';

const ChatAssistantIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    {/* Main user in front */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21v-4.5c0-1.105.895-2 2-2h12.5c1.105 0 2 .895 2 2v4.5" />
    
    {/* Secondary user in back, slightly offset */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" transform="translate(-7, 0)" opacity="0.4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21v-4.5c0-1.105.895-2 2-2h12.5c1.105 0 2 .895 2 2v4.5" transform="translate(-7, 0)" opacity="0.4" />
  </svg>
);

export default ChatAssistantIcon;
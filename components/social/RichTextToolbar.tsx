// components/social/RichTextToolbar.tsx
import React from 'react';
import BoldIcon from '../icons/BoldIcon';
import ItalicIcon from '../icons/ItalicIcon';
import ListBulletIcon from '../icons/ListBulletIcon';
import ListNumberedIcon from '../icons/ListNumberedIcon';

const RichTextToolbar: React.FC = () => {
    const applyStyle = (command: string) => {
        document.execCommand(command, false, undefined);
    };

    const ToolButton: React.FC<{ command: string, title: string, children: React.ReactNode }> = ({ command, title, children }) => (
        <button
            onClick={() => applyStyle(command)}
            className="p-1.5 text-gray-300 hover:bg-gray-600 hover:text-white rounded-md transition-colors"
            title={title}
            onMouseDown={e => e.preventDefault()} // Prevent editor from losing focus
        >
            {children}
        </button>
    );

    return (
        <div className="flex items-center gap-1 p-1 bg-gray-700 border-b border-gray-600 rounded-t-md">
            <ToolButton command="bold" title="Bold"><BoldIcon className="w-5 h-5" /></ToolButton>
            <ToolButton command="italic" title="Italic"><ItalicIcon className="w-5 h-5" /></ToolButton>
            <ToolButton command="insertUnorderedList" title="Bulleted List"><ListBulletIcon className="w-5 h-5" /></ToolButton>
            <ToolButton command="insertOrderedList" title="Numbered List"><ListNumberedIcon className="w-5 h-5" /></ToolButton>
        </div>
    );
};

export default RichTextToolbar;

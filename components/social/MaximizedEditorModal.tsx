// components/social/MaximizedEditorModal.tsx
import React from 'react';
import { ProcessedPost } from '../../types';
import ArrowsPointingInIcon from '../icons/ArrowsPointingInIcon';
import RichTextToolbar from './RichTextToolbar';

interface MaximizedEditorModalProps {
  post: ProcessedPost;
  index: number;
  onClose: () => void;
  onContentChange: (newContent: string, index: number) => void;
}

const MaximizedEditorModal: React.FC<MaximizedEditorModalProps> = ({
  post,
  index,
  onClose,
  onContentChange,
}) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="p-3 border-b border-gray-600 flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-100">Editing Post #{index + 1}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-300 hover:bg-gray-600 hover:text-white rounded-md" title="Minimize">
            <ArrowsPointingInIcon className="w-6 h-6" />
          </button>
        </header>
        <main className="p-4 flex-1 flex flex-col min-h-0">
          <RichTextToolbar />
          <div
            contentEditable
            onBlur={(e) => onContentChange(e.currentTarget.innerHTML, index)}
            suppressContentEditableWarning={true}
            className="editable-content w-full flex-1 p-4 bg-gray-900 border border-gray-600 border-t-0 rounded-b-md overflow-y-auto prose prose-invert max-w-none focus:ring-2 focus:ring-blue-500 focus:outline-none [&_ul]:list-disc [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:my-4 [&_ul]:pl-5 [&_ol]:pl-5"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </main>
      </div>
    </div>
  );
};

export default MaximizedEditorModal;

// components/social/GeneratedPostCard.tsx
import React, { useState } from 'react';
import { GeneratedPost, ProcessedPost } from '../../types';
import SpeakerWaveIcon from '../icons/SpeakerWaveIcon';
import SpeakerXMarkIcon from '../icons/SpeakerXMarkIcon';
import RefreshIcon from '../icons/RefreshIcon';
import ArrowsPointingOutIcon from '../icons/ArrowsPointingOutIcon';
import ClipboardModernIcon from '../icons/ClipboardModernIcon';
import ClipboardIcon from '../icons/ClipboardIcon';
import RichTextToolbar from './RichTextToolbar';
import { log } from '../../services/loggingService';

interface GeneratedPostCardProps {
  post: ProcessedPost;
  index: number;
  speakingPostIndex: number | null;
  handleReadAloud: (text: string, index: number) => void;
  handleContentChange: (newContent: string, index: number) => void;
  setMaximizedPost: (post: { post: ProcessedPost; index: number } | null) => void;
  setRegenModalState: (state: { isOpen: boolean; postIndex: number | null; feedback: string }) => void;
  handleRegenerateWithEmojis: (index: number) => void;
}

const GeneratedPostCard: React.FC<GeneratedPostCardProps> = ({
  post,
  index,
  speakingPostIndex,
  handleReadAloud,
  handleContentChange,
  setMaximizedPost,
  setRegenModalState,
  handleRegenerateWithEmojis,
}) => {
  const [copyStatus, setCopyStatus] = useState<Record<string, string>>({});

  const handleCopy = (event: React.MouseEvent<HTMLButtonElement>, postId: string) => {
    const contentElement = (event.currentTarget as HTMLElement).closest('.post-panel')?.querySelector('.editable-content');
    if (contentElement) {
        navigator.clipboard.writeText((contentElement as HTMLElement).innerText);
        setCopyStatus(prev => ({ ...prev, [postId]: 'Copied!' }));
        setTimeout(() => {
            setCopyStatus(prev => {
                const newState = { ...prev };
                delete newState[postId];
                return newState;
            });
        }, 2000);
    }
  };

  const handleCopyRender = (event: React.MouseEvent<HTMLButtonElement>, postId: string) => {
    log.info('SocialPostAssistant: handleCopyRender triggered');
    const contentElement = (event.currentTarget as HTMLElement).closest('.post-panel')?.querySelector('.editable-content');
    if (!contentElement) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentElement.innerHTML;
    
    let renderedText = '';
    
    tempDiv.childNodes.forEach(node => {
        const trimmedText = node.textContent?.trim() || '';
        if (!trimmedText && node.nodeName !== 'P') return;

        if (node.nodeName === 'P') {
            renderedText += trimmedText + '\n\n';
        } else if (node.nodeName === 'UL') {
            const ul = node as HTMLUListElement;
            Array.from(ul.children).filter(child => child.tagName === 'LI').forEach(li => {
                renderedText += `▶︎ ${li.textContent?.trim()}\n`;
            });
            renderedText += '\n';
        } else if (node.nodeName === 'OL') {
            const ol = node as HTMLOListElement;
            Array.from(ol.children).filter(child => child.tagName === 'LI').forEach((li, index) => {
                renderedText += `${index + 1}. ${li.textContent?.trim()}\n`;
            });
            renderedText += '\n';
        } else {
            if(trimmedText) renderedText += trimmedText + '\n\n';
        }
    });
    
    renderedText = renderedText.replace(/\n{3,}/g, '\n\n').trim();

    navigator.clipboard.writeText(renderedText);

    setCopyStatus(prev => ({ ...prev, [`${postId}_render`]: 'Copied!' }));
    setTimeout(() => {
        setCopyStatus(prev => {
            const newState = { ...prev };
            delete newState[`${postId}_render`];
            return newState;
        });
    }, 2000);
  };

  return (
    <div key={post.id} className="post-panel bg-gray-900 border border-gray-700 rounded-lg p-4">
      <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-300">Post #{index + 1}</h4>
          {post.quote && (
            <p className="text-xs italic text-gray-400 mt-1">
              Source: "{post.quote}"
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setMaximizedPost({ post, index })} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1" title="Enlarge Editor"><ArrowsPointingOutIcon className="w-4 h-4" /></button>
          <button onClick={() => setRegenModalState({ isOpen: true, postIndex: index, feedback: '' })} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1" title="Regenerate this post"><RefreshIcon className="w-4 h-4" />Regen</button>
          <button onClick={() => handleRegenerateWithEmojis(index)} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors" title="Regenerate with Emojis">+ Emojis</button>
          <button onClick={() => handleReadAloud(post.content, index)} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1" title="Read post aloud">{speakingPostIndex === index ? <SpeakerXMarkIcon className="w-4 h-4" /> : <SpeakerWaveIcon className="w-4 h-4" />}</button>
          <button onClick={(e) => handleCopyRender(e, post.id)} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1" title="Copy as plain text with formatting">
            <ClipboardModernIcon className="w-4 h-4" />
            {copyStatus[`${post.id}_render`] || 'Copy/Render'}
          </button>
          <button onClick={(e) => handleCopy(e, post.id)} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1" title="Copy displayed text">
            <ClipboardIcon className="w-4 h-4" />
            {copyStatus[post.id] || 'Copy'}
          </button>
        </div>
      </div>
      <div className="flex gap-4 items-start">
        {post.imageUrl && <div className="w-1/4 flex-shrink-0"><img src={post.imageUrl} alt={`Source for post ${index + 1}`} className="rounded-md w-full object-cover"/></div>}
        <div className={`relative flex-1 ${post.isRegenerating ? 'opacity-50' : ''}`}>
          {post.isRegenerating && <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-md z-10"><svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>}
          <div>
            <RichTextToolbar />
            <div
              contentEditable={!post.isRegenerating}
              onBlur={(e) => handleContentChange(e.currentTarget.innerHTML, index)}
              suppressContentEditableWarning={true}
              className="editable-content w-full h-96 p-3 bg-gray-800 border border-gray-600 border-t-0 rounded-b-md overflow-y-auto prose prose-sm prose-invert max-w-none focus:ring-2 focus:ring-blue-500 focus:outline-none [&_ul]:list-disc [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:my-4 [&_ul]:pl-5 [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>
        </div>
      </div>
      {post.sources && post.sources.length > 0 && (
        <div className="mt-4 border-t border-gray-700 pt-3">
          <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sources Used by AI</h5>
          <ul className="list-disc list-inside space-y-1">
            {post.sources.map((source, idx) => (
              <li key={idx} className="text-sm">
                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all" title={source.uri}>
                  {source.title || source.uri}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GeneratedPostCard;

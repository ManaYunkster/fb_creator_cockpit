// components/quotefinder/CallbackResultCard.tsx
import React from 'react';
import { ProcessedCallbackResult } from '../../types';
import RefreshIcon from '../icons/RefreshIcon';
import XCircleIcon from '../icons/XCircleIcon';
import ClipboardIcon from '../icons/ClipboardIcon';

interface CallbackResultCardProps {
    result: ProcessedCallbackResult;
    index: number;
    regeneratingIndex: number | null;
    handleRegenerate: (index: number) => void;
    handleReject: (index: number) => void;
    handleCallbackSentenceChange: (index: number, newContent: string) => void;
    copyStatus: Record<string, boolean>;
    handleCopyCallback: (processedCallbackHtml: string, index: number) => void;
    handleCopyCallbackWithUrl: (processedCallbackHtml: string, index: number) => void;
}

const CallbackResultCard: React.FC<CallbackResultCardProps> = ({
    result,
    index,
    regeneratingIndex,
    handleRegenerate,
    handleReject,
    handleCallbackSentenceChange,
    copyStatus,
    handleCopyCallback,
    handleCopyCallbackWithUrl,
}) => {
    return (
        <>
            <div className="absolute top-4 right-4 flex items-center gap-3">
                <button onClick={() => handleRegenerate(index)} title="Regenerate Callback" disabled={regeneratingIndex === index}>
                    {regeneratingIndex === index
                        ? <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        : <RefreshIcon className="w-6 h-6 text-gray-400 hover:text-white transition-colors" />
                    }
                </button>
                <button onClick={() => handleReject(index)} title="Remove Suggestion">
                    <XCircleIcon className="w-6 h-6 text-gray-500 hover:text-red-400 transition-colors" />
                </button>
            </div>

            <h3 className="text-xl font-bold text-gray-100 mb-4 pr-20">{index + 1}. {result.topicHeader}</h3>

            <div className="space-y-6 text-sm flex-grow">
                <div>
                    <strong className="text-gray-400 block mb-2">Draft with Callback</strong>
                    <div className="p-4 bg-gray-800 rounded-md border border-gray-700 leading-relaxed text-base prose prose-invert max-w-none">
                        <div className="opacity-70" dangerouslySetInnerHTML={{ __html: result.precedingWorkingContext || '' }} />
                        <div className="my-2 border-y-2 border-dashed border-gray-600 py-2">
                            <div dangerouslySetInnerHTML={{ __html: result.workingArticleAnchor }} className="text-white" />
                            <div className="mt-2 text-base text-white bg-blue-900/50 p-3 rounded-md">
                                <div
                                    contentEditable
                                    onBlur={(e) => handleCallbackSentenceChange(index, e.currentTarget.innerHTML)}
                                    suppressContentEditableWarning
                                    dangerouslySetInnerHTML={{ __html: result.processedCallbackSentence.replace(/<a /g, '<a class="text-blue-400 hover:underline" ') }}
                                />
                            </div>
                        </div>
                        <div className="opacity-70" dangerouslySetInnerHTML={{ __html: result.followingWorkingContext || '' }} />
                    </div>

                    <p className="text-gray-300 pt-3"><strong className="text-gray-400">Rationale:</strong> {result.whyItMatched}</p>
                </div>

                <div className="pt-4 border-t border-gray-700">
                    <strong className="text-gray-400">Original callback context</strong>
                    <p className="text-sm text-gray-400 mt-2">From: <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline"><em>{result.sourceTitle}</em></a></p>
                    <blockquote className="mt-2 border-l-2 border-gray-600 pl-3 prose prose-sm prose-invert max-w-none">
                        {result.precedingContext && (
                            <div className="opacity-70" dangerouslySetInnerHTML={{ __html: '...' + result.precedingContext }} />
                        )}
                        <div className="my-2" dangerouslySetInnerHTML={{ __html: result.anchorQuote }} />
                        {result.followingContext && (
                            <div className="opacity-70" dangerouslySetInnerHTML={{ __html: result.followingContext + '...' }} />
                        )}
                    </blockquote>
                </div>
            </div>
            <div className="flex items-center gap-2 pt-4 flex-wrap">
                <button onClick={() => handleCopyCallback(result.processedCallbackSentence, index)} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                    <ClipboardIcon className="w-3.5 h-3.5" /> {copyStatus[`callback_${index}`] ? 'Copied!' : 'Copy Callback'}
                </button>
                <button onClick={() => handleCopyCallbackWithUrl(result.processedCallbackSentence, index)} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                    <ClipboardIcon className="w-3.5 h-3.5" /> {copyStatus[`callback_url_${index}`] ? 'Copied!' : 'Copy Callback with URL'}
                </button>
            </div>
        </>
    );
};

export default CallbackResultCard;

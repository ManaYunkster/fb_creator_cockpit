// components/quotefinder/QuoteResultCard.tsx
import React from 'react';
import { QuoteResult } from '../../types';
import ClipboardIcon from '../icons/ClipboardIcon';

interface QuoteResultCardProps {
    result: QuoteResult;
    index: number;
    copyStatus: Record<string, boolean>;
    handleCopy: (text: string, key: string) => void;
    handleCopySource: (result: QuoteResult, index: number) => void;
    handleCopyWithAttribution: (result: QuoteResult, index: number) => void;
}

const QuoteResultCard: React.FC<QuoteResultCardProps> = ({
    result,
    index,
    copyStatus,
    handleCopy,
    handleCopySource,
    handleCopyWithAttribution,
}) => {
    return (
        <>
            <h3 className="text-xl font-bold text-gray-100 mb-4 pr-20">{index + 1}. {result.topicHeader}</h3>
            <div className="flex-grow mb-4">
                <blockquote className="border-l-4 border-gray-600 pl-4">
                    <p className="text-xl text-gray-200 italic">{result.quote}</p>
                </blockquote>
            </div>
            <div className="mt-auto">
                <p className="mt-4 text-sm text-gray-300">{result.whyItMatched}</p>
                <div className="mt-4 pt-4 border-t border-gray-700 space-y-1 text-sm">
                    <p className="text-gray-400">
                        <strong>Source:</strong> <em>{result.sourceTitle}</em> ({new Date(result.sourceDate).toLocaleDateString()})
                    </p>
                    <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate block">
                        {result.sourceUrl}
                    </a>
                </div>
                <div className="flex items-center gap-2 pt-4 flex-wrap">
                    <button onClick={() => handleCopy(result.quote, `quote_${index}`)} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                        <ClipboardIcon className="w-3.5 h-3.5" /> {copyStatus[`quote_${index}`] ? 'Copied!' : 'Copy Quote'}
                    </button>
                    <button onClick={() => handleCopyWithAttribution(result, index)} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                        <ClipboardIcon className="w-3.5 h-3.5" /> {copyStatus[`attr_${index}`] ? 'Copied!' : 'Copy with Attribution'}
                    </button>
                    <button onClick={() => handleCopySource(result, index)} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                        <ClipboardIcon className="w-3.5 h-3.5" /> {copyStatus[`source_${index}`] ? 'Copied!' : 'Copy Title with URL'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default QuoteResultCard;

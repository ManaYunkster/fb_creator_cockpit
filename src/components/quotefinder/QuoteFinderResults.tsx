// components/quotefinder/QuoteFinderResults.tsx
import React from 'react';
import { Mode, ProcessedResult, QuoteResult, ProcessedCallbackResult } from '../../types';
import QuoteResultCard from './QuoteResultCard';
import CallbackResultCard from './CallbackResultCard';

interface QuoteFinderResultsProps {
    error: string | null;
    visibleResults: { result: ProcessedResult; index: number }[];
    mode: Mode;
    copyStatus: Record<string, boolean>;
    handleCopy: (text: string, key: string) => void;
    handleCopySource: (result: QuoteResult, index: number) => void;
    handleCopyWithAttribution: (result: QuoteResult, index: number) => void;
    regeneratingIndex: number | null;
    handleRegenerate: (index: number) => void;
    handleReject: (index: number) => void;
    handleCallbackSentenceChange: (index: number, newContent: string) => void;
    handleCopyCallback: (processedCallbackHtml: string, index: number) => void;
    handleCopyCallbackWithUrl: (processedCallbackHtml: string, index: number) => void;
}

const QuoteFinderResults: React.FC<QuoteFinderResultsProps> = ({
    error,
    visibleResults,
    mode,
    copyStatus,
    handleCopy,
    handleCopySource,
    handleCopyWithAttribution,
    regeneratingIndex,
    handleRegenerate,
    handleReject,
    handleCallbackSentenceChange,
    handleCopyCallback,
    handleCopyCallbackWithUrl,
}) => {
    return (
        <div className="space-y-6">
            {error && <div className="p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-md">{error}</div>}

            {visibleResults.length > 0 && visibleResults.map(({ result, index }) => (
                <div key={index} className="relative bg-gray-900/50 border border-gray-700 rounded-lg p-6 animate-fade-in-up flex flex-col transition-colors" style={{ animationDelay: `${index * 100}ms` }}>
                    {mode === 'quote' && 'quote' in result && (
                        <QuoteResultCard
                            result={result as QuoteResult}
                            index={index}
                            copyStatus={copyStatus}
                            handleCopy={handleCopy}
                            handleCopySource={handleCopySource}
                            handleCopyWithAttribution={handleCopyWithAttribution}
                        />
                    )}

                    {mode === 'callback' && 'callbackSentence' in result && (
                        <CallbackResultCard
                            result={result as ProcessedCallbackResult}
                            index={index}
                            regeneratingIndex={regeneratingIndex}
                            handleRegenerate={handleRegenerate}
                            handleReject={handleReject}
                            handleCallbackSentenceChange={handleCallbackSentenceChange}
                            copyStatus={copyStatus}
                            handleCopyCallback={handleCopyCallback}
                            handleCopyCallbackWithUrl={handleCopyCallbackWithUrl}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

export default QuoteFinderResults;

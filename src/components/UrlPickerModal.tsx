
import React, { useState, useEffect } from 'react';
import { log } from '../services/loggingService';
import XMarkIcon from './icons/XMarkIcon';

interface UrlPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (finalUrls: string[]) => void;
    initialUrls: string[];
}

const URL_LIMIT = 5;

const UrlPickerModal: React.FC<UrlPickerModalProps> = ({ isOpen, onClose, onConfirm, initialUrls }) => {
    const [urls, setUrls] = useState<string[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setUrls(initialUrls);
        }
    }, [isOpen, initialUrls]);

    const isValidUrl = (url: string) => {
        try {
            new URL(url);
            return true;
        } catch (_) {
            return false;
        }
    };

    const handleAddUrl = () => {
        setError(null);
        const trimmedUrl = currentInput.trim();

        if (!trimmedUrl) return;

        if (!isValidUrl(trimmedUrl)) {
            setError('Please enter a valid URL (e.g., https://example.com).');
            return;
        }

        if (urls.length >= URL_LIMIT) {
            setError(`You can add a maximum of ${URL_LIMIT} URLs.`);
            return;
        }

        if (urls.includes(trimmedUrl)) {
            setError('This URL has already been added.');
            return;
        }

        setUrls(prev => [...prev, trimmedUrl]);
        setCurrentInput('');
    };

    const handleRemoveUrl = (urlToRemove: string) => {
        setUrls(prev => prev.filter(url => url !== urlToRemove));
    };

    const handleConfirm = () => {
        log.info('UrlPickerModal: handleConfirm', { finalUrls: urls });
        onConfirm(urls);
        setCurrentInput('');
        setError(null);
        onClose();
    };
    
    const handleClose = () => {
        setCurrentInput('');
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={handleClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-600">
                    <h3 className="text-lg font-bold text-gray-100">Manage Attached URLs</h3>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white">&times;</button>
                </header>
                <main className="p-6 overflow-y-auto flex-1">
                    <div className="flex items-start gap-2 mb-4">
                        <input
                            type="url"
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }}
                            placeholder="https://your-post.substack.com/p/..."
                            className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-200 placeholder-gray-500"
                        />
                        <button onClick={handleAddUrl} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600" disabled={!currentInput.trim()}>
                            Add
                        </button>
                    </div>
                    {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
                    
                    <div className="space-y-2">
                        {urls.length > 0 ? (
                             <>
                                {urls.map(url => (
                                    <div key={url} className="flex items-center justify-between p-2 rounded-md bg-gray-900/50">
                                        <span className="text-sm text-gray-200 truncate" title={url}>{url}</span>
                                        <button onClick={() => handleRemoveUrl(url)} className="ml-2 text-gray-400 hover:text-white flex-shrink-0">
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                             </>
                        ) : (
                            <p className="text-center text-gray-500 pt-8">No URLs attached. Paste a link above to get started.</p>
                        )}
                    </div>

                </main>
                <footer className="flex justify-end gap-4 p-4 bg-gray-900/50 border-t border-gray-700">
                    <button onClick={handleClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancel</button>
                    <button onClick={handleConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500">
                        Confirm ({urls.length})
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default UrlPickerModal;

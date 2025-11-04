import React from 'react';
import { GeminiFile } from '../types';

interface FileInfoModalProps {
    file: GeminiFile | null;
    isFetching: boolean;
    onClose: () => void;
}

const FileInfoModal: React.FC<FileInfoModalProps> = ({ file, isFetching, onClose }) => {
    if (!file && !isFetching) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-600">
                    <h3 className="text-lg font-bold text-gray-100">File Metadata</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </header>
                <main className="p-4 overflow-auto">
                    {isFetching ? (
                        <p className="text-gray-300">Fetching full details...</p>
                    ) : (
                        <pre className="text-xs text-gray-200 whitespace-pre-wrap break-all bg-gray-900 p-4 rounded-md">
                            {JSON.stringify(file, null, 2)}
                        </pre>
                    )}
                </main>
            </div>
        </div>
    );
};

export default FileInfoModal;


import React, { useState, useEffect, useCallback } from 'react';
import * as geminiFileService from '../services/geminiFileService';
import { GeminiFile } from '../types';
import InformationCircleIcon from './icons/InformationCircleIcon';
import { log } from '../services/loggingService';
import * as dbService from '../services/dbService';

const formatBytes = (bytesStr: string | number, decimals = 2) => {
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
    if (isNaN(bytes) || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
};

interface FilePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFilesSelected: (files: GeminiFile[]) => void;
    existingFiles: GeminiFile[];
}

const FilePickerModal: React.FC<FilePickerModalProps> = ({ isOpen, onClose, onFilesSelected, existingFiles }) => {
    const [allFiles, setAllFiles] = useState<GeminiFile[]>([]);
    const [selectedFileNames, setSelectedFileNames] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadFiles = useCallback(async () => {
        log.info('FilePickerModal: fetchFiles triggered');
        setIsLoading(true);
        setError(null);
        try {
            const apiFiles = await geminiFileService.listFilesFromApi();
            
            const allKnownLocalFiles = await dbService.getAll<GeminiFile>('files');
            const localFileMap = new Map(allKnownLocalFiles.map(f => [f.name, f]));
            const processedFiles = await Promise.all(
                apiFiles.map(file => geminiFileService.processFileMetadata(file, localFileMap.get(file.name)))
            );
            
            setAllFiles(processedFiles.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()));
        } catch (err: any) {
            setError(err.message || 'Failed to fetch files.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadFiles();
        }
    }, [isOpen, loadFiles]);
    
    useEffect(() => {
        if (isOpen) {
            setSelectedFileNames(new Set());
        }
    }, [isOpen])

    const handleToggleSelection = (fileName: string) => {
        log.info(`FilePickerModal: handleToggleSelection for "${fileName}"`);
        setSelectedFileNames(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileName)) {
                newSet.delete(fileName);
            } else {
                newSet.add(fileName);
            }
            return newSet;
        });
    };

    const handleConfirm = () => {
        log.info('FilePickerModal: handleConfirm', { selectedFileNames });
        const selected = allFiles.filter(f => selectedFileNames.has(f.name));
        onFilesSelected(selected);
        onClose();
    };

    if (!isOpen) return null;
    
    const existingFileNames = new Set(existingFiles.map(f => f.name));

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-600">
                    <h3 className="text-lg font-bold text-gray-100">Attach Existing Files</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </header>
                <main className="p-4 overflow-y-auto flex-1">
                    {isLoading ? (
                        <p className="text-gray-300">Loading files...</p>
                    ) : error ? (
                        <p className="text-red-400">{error}</p>
                    ) : allFiles.length === 0 ? (
                        <p className="text-gray-400">No files found in storage. Use the "File Management" tool to upload files.</p>
                    ) : (
                        <ul className="space-y-2">
                            {allFiles.map(file => {
                                const isAlreadyAttached = existingFileNames.has(file.name);
                                const displayName = file.cachedDisplayName || file.displayName;
                                return (
                                    <li key={file.name} className={`flex items-center p-2 rounded-md transition-colors ${isAlreadyAttached ? 'bg-gray-700/50 opacity-60' : 'bg-gray-900/50 hover:bg-gray-700/50'}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedFileNames.has(file.name)}
                                            onChange={() => handleToggleSelection(file.name)}
                                            disabled={isAlreadyAttached}
                                            aria-label={`Select file ${displayName}`}
                                            className="mr-3 h-4 w-4 rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500 disabled:opacity-50"
                                        />
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-medium text-gray-200 truncate" title={displayName}>
                                                {displayName}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate" title={file.name}>
                                                {file.name}
                                            </p>
                                        </div>
                                        <div className="text-right text-xs text-gray-400 ml-2">
                                            <p>{formatBytes(file.sizeBytes)}</p>
                                            <p>Created: {formatDate(file.createTime)}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </main>
                <footer className="flex justify-end gap-4 p-4 bg-gray-900/50 border-t border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancel</button>
                    <button onClick={handleConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500" disabled={selectedFileNames.size === 0}>
                        Attach ({selectedFileNames.size}) Files
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default FilePickerModal;

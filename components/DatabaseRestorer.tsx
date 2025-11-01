
import React, { useState, useRef, useCallback, useContext } from 'react';
import JSZip from 'jszip';
import { log } from '../services/loggingService';
import * as dbService from '../services/dbService';
import { DataContext } from '../contexts/DataContext';
import { ContentContext } from '../contexts/ContentContext';
import { GeminiCorpusContext } from '../contexts/GeminiCorpusContext';

interface DatabaseRestorerProps {
    onClose: () => void;
}

const DatabaseRestorer: React.FC<DatabaseRestorerProps> = ({ onClose }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const dataContext = useContext(DataContext);
    const contentContext = useContext(ContentContext);
    const geminiCorpusContext = useContext(GeminiCorpusContext);

    const restoreAndRefresh = useCallback(async (file: File) => {
        setIsLoading(true);
        setError(null);
        setProgressMessage('Reading backup file...');

        try {
            const zip = await JSZip.loadAsync(file);
            const backupFile = zip.file('database_backup.json');

            if (!backupFile) {
                throw new Error('Invalid backup archive: "database_backup.json" not found inside the ZIP file.');
            }
            
            setProgressMessage('Parsing backup data...');
            const fileContent = await backupFile.async('text');
            const jsonData = JSON.parse(fileContent);
            
            setProgressMessage('Restoring database...');
            await dbService.importDB(jsonData);
            
            setProgressMessage('Refreshing application state...');
            await dataContext.loadCorpus();
            await contentContext.loadContext();
            
            setProgressMessage('Syncing files with remote store...');
            await geminiCorpusContext.refreshSyncedFiles();

            setProgressMessage('Restore complete!');
            
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (e: any) {
            log.error('Database restore failed:', e);
            setError(`Restore failed: ${e.message}. The file may be corrupted or invalid.`);
            setProgressMessage('');
            setIsLoading(false);
        }
    }, [dataContext, contentContext, geminiCorpusContext, onClose]);
    
    const processFile = useCallback((file: File) => {
        if (!file || !file.type.includes('zip')) {
            setError('Please select a valid .zip backup file.');
            setSelectedFile(null);
            return;
        }
        setError(null);
        setProgressMessage('');
        setSelectedFile(file);
    }, []);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) {
            setSelectedFile(file);
            restoreAndRefresh(file);
        }
    }, [restoreAndRefresh]);

    const handleRestoreClick = () => {
        if (!selectedFile) {
            setError('No file selected.');
            return;
        }
        restoreAndRefresh(selectedFile);
    };

    const onAreaClick = () => {
        fileInputRef.current?.click();
    };

    const handleReset = () => {
        setSelectedFile(null);
        setError(null);
        setProgressMessage('');
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className="animate-fade-in-up space-y-6">
            <div className="p-4 bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-md">
                <strong className="font-bold">Warning:</strong> Restoring from a backup will completely overwrite all current data in this application. This action cannot be undone.
            </div>

            <div
                onClick={onAreaClick}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ${isDragging ? 'border-blue-500 bg-gray-700/50' : 'border-gray-600 hover:border-gray-500'}`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    onChange={handleFileChange}
                    className="hidden"
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-500 mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                </svg>
                <p className="text-gray-300">
                    <span className="font-semibold text-blue-400">Click to select backup file</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">Accepts .zip backup files</p>
            </div>

            {selectedFile && !isLoading && (
                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 flex justify-between items-center">
                    <p className="text-sm text-gray-200">
                        Selected file: <span className="font-semibold">{selectedFile.name}</span>
                    </p>
                    <button onClick={handleReset} className="text-sm text-gray-400 hover:text-white">&times; Clear</button>
                </div>
            )}
            
            {error && (
                <div className="p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-md" role="alert">
                    {error}
                </div>
            )}
            
            {progressMessage && (
                <div className="p-4 bg-blue-900/50 border border-blue-700 text-blue-300 rounded-md" role="alert">
                    {progressMessage}
                </div>
            )}

            <button
                onClick={handleRestoreClick}
                disabled={!selectedFile || isLoading}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
            >
                {isLoading ? (
                     <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Restoring...
                    </>
                ) : 'Restore From Backup'}
            </button>
        </div>
    );
};

export default DatabaseRestorer;
import React, { useState, useRef } from 'react';
import { FILE_PURPOSES, buildInternalFileName } from '../config/file_naming_config';
import FolderOpenIcon from './icons/FolderOpenIcon';
import { log } from '../services/loggingService';

interface FileUploadPanelProps {
    onUpload: (file: File, displayName: string, purpose: string) => Promise<void>;
}

const FileUploadPanel: React.FC<FileUploadPanelProps> = ({ onUpload }) => {
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [selectedPurpose, setSelectedPurpose] = useState<string>('general-global');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        log.info('FileUploadPanel: handleFileSelect', file);
        if (file) {
            setUploadFile(file);
            setDisplayName(file.name);
            setUploadError(null);
        }
    };

    const handleUploadClick = async () => {
        if (!uploadFile) return;
        log.info('FileUploadPanel: handleUpload initiated', { displayName, file: uploadFile, purpose: selectedPurpose });
        setIsUploading(true);
        setUploadError(null);
        try {
            await onUpload(uploadFile, displayName, selectedPurpose);
            setUploadFile(null);
            setDisplayName('');
            setSelectedPurpose('general-global');
            if(fileInputRef.current) fileInputRef.current.value = "";
        } catch (err: any) {
            setUploadError(err.message || "Failed to register and sync file.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Upload a New File</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="file-upload-button" className="block text-sm font-medium text-gray-300 mb-1">Choose File</label>
                    <input ref={fileInputRef} id="file-upload" type="file" onChange={handleFileSelect} className="hidden" />
                    <button
                        id="file-upload-button"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full text-left p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400 hover:border-blue-500 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center text-sm"
                    >
                        <FolderOpenIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span className="truncate">{uploadFile ? uploadFile.name : 'Select a file...'}</span>
                    </button>
                    <p className="mt-1 text-xs text-gray-400">Select a file from your device.</p>
                </div>

                <div>
                     <label htmlFor="display-name" className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
                    <input
                        id="display-name"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Display Name"
                        maxLength={256}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 placeholder-gray-500 text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-400">Name to display in menus and the application.</p>
                </div>
                
                <div>
                    <label htmlFor="file-purpose" className="block text-sm font-medium text-gray-300 mb-1">Purpose</label>
                    <select 
                        id="file-purpose" 
                        value={selectedPurpose} 
                        onChange={e => setSelectedPurpose(e.target.value)}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-gray-200 focus:ring-1 focus:ring-blue-500"
                    >
                        {FILE_PURPOSES.filter(p => !p.id.startsWith('corpus-') && p.id !== 'reg-test').map(purpose => (
                            <option key={purpose.id} value={purpose.id}>{purpose.label}</option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-400">Classifies the file for the AI.</p>
                </div>
            </div>
            <div className="flex justify-between items-center mt-6">
                <div className="flex-1 pr-4">
                    {uploadError && (
                        <div className="p-2 bg-red-900/50 border border-red-700 text-red-300 rounded-md text-sm truncate" title={uploadError}>
                            {uploadError.split('\n')[0]}
                        </div>
                    )}
                </div>
                <button onClick={handleUploadClick} disabled={isUploading || !uploadFile} className="flex-shrink-0 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center">
                    {isUploading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                    {isUploading ? 'Registering...' : 'Register File'}
                </button>
            </div>
        </div>
    );
};

export default FileUploadPanel;

import React, { useState, useEffect, useCallback, useRef, useMemo, useContext } from 'react';
import * as geminiFileService from '../services/geminiFileService';
import { GeminiFile } from '../types';
import InformationCircleIcon from './icons/InformationCircleIcon';
import ConfirmationModal from './ConfirmationModal';
import { log } from '../services/loggingService';
import { FILE_PURPOSES, buildInternalFileName } from '../config/file_naming_config';
import LockClosedIcon from './icons/LockClosedIcon';
import { GeminiCorpusContext } from '../contexts/GeminiCorpusContext';
import { ContentContext } from '../contexts/ContentContext';
import * as dbService from '../services/dbService';
import FolderOpenIcon from './icons/FolderOpenIcon';

type SortableColumn = keyof GeminiFile;
type SortDirection = 'asc' | 'desc';

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

const FileManagementPanel: React.FC = () => {
    const { refreshSyncedFiles, forceResync } = useContext(GeminiCorpusContext);
    const { addContextDocument, removeContextDocument } = useContext(ContentContext);
    
    const [files, setFiles] = useState<GeminiFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const [isUploading, setIsUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [selectedPurpose, setSelectedPurpose] = useState<string>('general-global');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: SortableColumn; direction: SortDirection } | null>({ key: 'createTime', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    
    const [infoModalFile, setInfoModalFile] = useState<GeminiFile | null>(null);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
    const [isForceResyncModalOpen, setIsForceResyncModalOpen] = useState(false);

    const loadFiles = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiFiles = await geminiFileService.listGeminiFiles();
            const allKnownLocalFiles = await dbService.getAll<GeminiFile>('files');
            
            const combinedFilesMap = new Map<string, GeminiFile>();
    
            // Add all local files first
            for (const localFile of allKnownLocalFiles) {
                const processedLocal = await geminiFileService.processFileMetadata(localFile);
                combinedFilesMap.set(processedLocal.name, processedLocal);
            }
    
            // Add or update with API files
            for (const apiFile of apiFiles) {
                const processedApi = await geminiFileService.processFileMetadata(apiFile, combinedFilesMap.get(apiFile.name));
                combinedFilesMap.set(processedApi.name, processedApi);
            }
            
            setFiles(Array.from(combinedFilesMap.values()));
        } catch (err: any) {
            setError(err.message || 'Failed to load files.');
            setFiles([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);
    
    const sortedFiles = useMemo(() => {
        let sortableFiles = [...files];
        if (sortConfig !== null) {
            sortableFiles.sort((a, b) => {
                // Primary sort key: user-editable files first.
                // Protected (corpus) files are not user-editable.
                const aIsEditable = a.context !== 'corpus';
                const bIsEditable = b.context !== 'corpus';

                if (aIsEditable && !bIsEditable) return -1; // a comes first
                if (!aIsEditable && bIsEditable) return 1;  // b comes first

                // Secondary sort key: user-selected column
                const { key, direction } = sortConfig;
                const aValue = a[key];
                const bValue = b[key];
                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;
                
                let comparison = 0;
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    if (key === 'createTime' || key === 'updateTime' || key === 'expirationTime') {
                        comparison = new Date(aValue).getTime() - new Date(bValue).getTime();
                    } else if (key === 'sizeBytes') {
                        comparison = parseInt(aValue, 10) - parseInt(bValue, 10);
                    } else {
                        comparison = aValue.localeCompare(bValue);
                    }
                } else {
                    comparison = String(aValue).localeCompare(String(bValue));
                }
                
                return direction === 'asc' ? comparison : -comparison;
            });
        }
        return sortableFiles;
    }, [files, sortConfig]);

    const paginatedFiles = useMemo(() => {
        if (rowsPerPage === -1) return sortedFiles;
        const startIndex = (currentPage - 1) * rowsPerPage;
        return sortedFiles.slice(startIndex, startIndex + rowsPerPage);
    }, [sortedFiles, currentPage, rowsPerPage]);
    
    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            const selectableFiles = paginatedFiles.filter(f => f.context !== 'corpus');
            const selectableFileNames = new Set(selectableFiles.map(f => f.name));
            
            if (selectableFileNames.size === 0) {
                selectAllCheckboxRef.current.checked = false;
                selectAllCheckboxRef.current.indeterminate = false;
                return;
            }
            const selectedVisibleCount = Array.from(selectedFiles).filter(name => selectableFileNames.has(name)).length;

            if (selectedVisibleCount === selectableFileNames.size) {
                selectAllCheckboxRef.current.checked = true;
                selectAllCheckboxRef.current.indeterminate = false;
            } else if (selectedVisibleCount > 0) {
                selectAllCheckboxRef.current.checked = false;
                selectAllCheckboxRef.current.indeterminate = true;
            } else {
                selectAllCheckboxRef.current.checked = false;
                selectAllCheckboxRef.current.indeterminate = false;
            }
        }
    }, [selectedFiles, paginatedFiles]);

    const requestSort = (key: SortableColumn) => {
        log.info(`FileManagementPanel: requestSort for key "${key}"`);
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.target.checked;
        log.info(`FileManagementPanel: handleSelectAll for current page - checked: ${isChecked}`);
        
        setSelectedFiles(prevSelected => {
            const newSelecteds = new Set(prevSelected);
            const selectableFileNames = paginatedFiles
                .filter(f => f.context !== 'corpus')
                .map(f => f.name);

            if (isChecked) {
                selectableFileNames.forEach(name => newSelecteds.add(name));
            } else {
                selectableFileNames.forEach(name => newSelecteds.delete(name));
            }
            return newSelecteds;
        });
    };

    const handleSelectOne = (name: string) => {
        log.info(`FileManagementPanel: handleSelectOne for name "${name}"`);
        const newSelecteds = new Set(selectedFiles);
        if (newSelecteds.has(name)) {
            newSelecteds.delete(name);
        } else {
            newSelecteds.add(name);
        }
        setSelectedFiles(newSelecteds);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        log.info('FileManagementPanel: handleFileSelect', file);
        if (file) {
            setUploadFile(file);
            setDisplayName(file.name);
            setUploadError(null);
        }
    };

    const handleUpload = async () => {
        if (!uploadFile) return;
        log.info('FileManagementPanel: handleUpload initiated', { displayName, file: uploadFile, purpose: selectedPurpose });
        setIsUploading(true);
        setUploadError(null);
        try {
            const internalName = buildInternalFileName(displayName, selectedPurpose);
            
            await geminiFileService.registerLocalFile(internalName, displayName, uploadFile);
            
            // If it's a context document, add it to the ContentContext as well
            const purpose = FILE_PURPOSES.find(p => p.id === selectedPurpose);
            if (purpose && ['content', 'instrux', 'reference'].includes(purpose.contextPrefix)) {
                await addContextDocument(uploadFile, internalName);
            }
            
            setUploadFile(null);
            setDisplayName('');
            setSelectedPurpose('general-global');
            if(fileInputRef.current) fileInputRef.current.value = "";
            setSelectedFiles(new Set());
            await refreshSyncedFiles(); // Trigger a sync to upload the new file
            await loadFiles(); // Refresh the panel to show the new file
        } catch (err: any) {
            setUploadError(err.message || "Failed to register and sync file.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = (names: string[]) => {
        log.info('FileManagementPanel: handleDelete initiated for names:', names);
        if (names.length > 0) {
            setFilesToDelete(names);
            setIsConfirmModalOpen(true);
        }
    };
    
    const handleConfirmDelete = async () => {
        log.info('FileManagementPanel: handleConfirmDelete for names:', filesToDelete);
        setIsConfirmModalOpen(false);
        setError(null);
    
        try {
            const deletionPromises = filesToDelete.map(async (fileName) => {
                const isLocal = fileName.startsWith('local/');
                const fileMetadata = files.find(f => f.name === fileName);
    
                if (isLocal) {
                    // It's a local-only file, just delete it from the DB
                    await geminiFileService.deleteLocalFile(fileName);
                } else {
                    // It's an API-synced file
                    try {
                        await geminiFileService.deleteFileFromApiOnly(fileName);
                    } catch (apiError: any) {
                        // If the file is not found on the API, we can still proceed to delete it locally.
                        if (!apiError.message.includes('404')) {
                            throw apiError; // Re-throw if it's not a 'Not Found' error
                        }
                        log.info(`File ${fileName} not found on API, proceeding with local deletion.`);
                    }
                    // Always try to delete the local record as well, using the API name as the key
                    await dbService.del('files', fileName);
                }
    
                // If it was a context document, remove it from the context
                if (fileMetadata?.context && ['content', 'instrux', 'reference'].includes(fileMetadata.context)) {
                    await removeContextDocument(fileMetadata.cachedDisplayName || fileMetadata.displayName);
                }
            });
    
            await Promise.all(deletionPromises);
        } catch (err: any) {
            setError(err.message || 'An error occurred during deletion.');
        } finally {
            setFilesToDelete([]);
            setSelectedFiles(new Set());
            await loadFiles(); 
            await refreshSyncedFiles();
        }
    };
    
    const handleConfirmForceResync = async () => {
        log.info('FileManagementPanel: handleConfirmForceResync triggered');
        setIsForceResyncModalOpen(false);
        setError(null);
        try {
            await forceResync();
        } catch (err: any) {
            setError(err.message || 'An error occurred during force resync.');
        } finally {
            await loadFiles();
        }
    };

    const handleShowInfo = async (file: GeminiFile) => {
        log.info('FileManagementPanel: handleShowInfo triggered for file:', file);
        if (file.name.startsWith('local/')) {
            log.info('File is local-only, displaying cached metadata without API call.');
            setInfoModalFile(file); // Display the local data directly
            return;
        }
        
        setIsFetchingDetails(true);
        setInfoModalFile(null);
        try {
            const fullDetails = await geminiFileService.getFile(file.name);
            setInfoModalFile(fullDetails);
        } catch (e: any) {
            setError(e.message || "Could not fetch file details.");
            setInfoModalFile(null);
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const renderSortArrow = (columnKey: SortableColumn) => {
        if (sortConfig?.key !== columnKey) return null;
        return <span>{sortConfig.direction === 'desc' ? ' ↓' : ' ↑'}</span>;
    };
    
    const TableHeader: React.FC<{columnKey: SortableColumn, label: string, className?: string}> = ({columnKey, label, className}) => (
        <th scope="col" className={`px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer ${className}`} onClick={() => requestSort(columnKey)}>
            {label} {renderSortArrow(columnKey)}
        </th>
    );
    
    const totalPages = rowsPerPage > 0 ? Math.ceil(sortedFiles.length / rowsPerPage) : 1;

    const renderTableRows = () => {
        const rows: React.ReactNode[] = [];
        let lastGroup: 'user' | 'application' | null = null;
    
        paginatedFiles.forEach((file: GeminiFile) => {
            const isProtected = file.context === 'corpus';
            const currentGroup = isProtected ? 'application' : 'user';
    
            if (currentGroup !== lastGroup) {
                const headerText = currentGroup === 'user' ? 'User-managed files' : 'Application-managed files';
                rows.push(
                    <tr key={`header-${currentGroup}`} className="bg-gray-700/80">
                        <td colSpan={9} className="px-4 py-2 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            {headerText}
                        </td>
                    </tr>
                );
                lastGroup = currentGroup;
            }
    
            rows.push(
                <tr key={file.name} className={`hover:bg-gray-700/50 transition-colors ${selectedFiles.has(file.name) ? 'bg-gray-700/30' : ''} ${isProtected ? 'opacity-70' : ''}`}>
                    <td className="pl-4 pr-2 py-4"><input type="checkbox" checked={selectedFiles.has(file.name)} onChange={() => handleSelectOne(file.name)} className="rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500" disabled={isProtected} /></td>
                    <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-200">
                            {file.cachedDisplayName || file.displayName}
                        </div>
                        <div className="text-xs text-gray-500" title={file.displayName}>
                            API: {file.displayName.length > 30 ? `${file.displayName.substring(0, 30)}...` : file.displayName}
                        </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{file.mimeType}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">{file.context || '—'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">{file.scope || '—'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{formatBytes(file.sizeBytes)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{formatDate(file.createTime)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{formatDate(file.updateTime)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium space-x-3 text-right">
                        <button onClick={() => handleShowInfo(file)} className="text-blue-400 hover:text-blue-300" title="View file metadata"><InformationCircleIcon className="w-5 h-5 inline" /></button>
                        {isProtected ? (
                            <span title="This file is managed by the Content Corpus and cannot be deleted individually.">
                                <LockClosedIcon className="w-5 h-5 inline text-blue-400" />
                            </span>
                        ) : (
                            <button onClick={() => handleDelete([file.name])} disabled={isLoading} className="text-red-400 hover:text-red-300 disabled:opacity-50" title="Delete file"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 inline"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
                        )}
                    </td>
                </tr>
            );
        });
        return rows;
    };


    return (
        <div className="space-y-8 animate-fade-in">
            {/* --- Upload Panel --- */}
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
                    <button onClick={handleUpload} disabled={isUploading || !uploadFile} className="flex-shrink-0 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center">
                        {isUploading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {isUploading ? 'Registering...' : 'Register File'}
                    </button>
                </div>
            </div>
            
            {/* --- Files Table Panel --- */}
            <div className="bg-gray-800 rounded-lg border border-gray-700">
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 className="text-lg font-bold text-gray-100">Managed Files ({files.length})</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsForceResyncModalOpen(true)} disabled={isLoading} className="px-3 py-1 bg-yellow-600 text-sm text-white rounded-md hover:bg-yellow-500 disabled:opacity-50 transition-colors">Force Resync</button>
                        <button onClick={loadFiles} disabled={isLoading} className="px-3 py-1 bg-gray-700 text-sm text-gray-300 rounded-md hover:bg-gray-600 disabled:opacity-50 transition-colors">Refresh</button>
                    </div>
                </header>
                {error && <div className="m-4 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-md whitespace-pre-wrap">{error}</div>}
                
                 {/* Bulk Actions Bar */}
                {selectedFiles.size > 0 && (
                    <div className="p-3 bg-gray-700/50 border-b border-gray-700 flex items-center gap-4">
                        <span className="text-sm font-semibold text-gray-200">{selectedFiles.size} selected</span>
                        <button onClick={() => handleDelete(Array.from(selectedFiles))} className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 rounded-md text-white disabled:bg-gray-500" disabled={isLoading}>Delete Selected</button>
                    </div>
                )}
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th scope="col" className="pl-4 pr-2 py-3"><input type="checkbox" ref={selectAllCheckboxRef} onChange={handleSelectAll} className="rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500" /></th>
                                <TableHeader columnKey="cachedDisplayName" label="Name" />
                                <TableHeader columnKey="mimeType" label="Type" />
                                <TableHeader columnKey="context" label="Context" />
                                <TableHeader columnKey="scope" label="Scope" />
                                <TableHeader columnKey="sizeBytes" label="Size" />
                                <TableHeader columnKey="createTime" label="Created" />
                                <TableHeader columnKey="updateTime" label="Updated" />
                                <th scope="col" className="relative px-4 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {isLoading ? (
                                <tr><td colSpan={9} className="text-center p-8 text-gray-400">Loading files from API...</td></tr>
                            ) : paginatedFiles.length === 0 && !error ? (
                                <tr><td colSpan={9} className="text-center p-8 text-gray-400">No files found.</td></tr>
                            ) : (
                                renderTableRows()
                            )}
                        </tbody>
                    </table>
                </div>
                 {/* Pagination Controls */}
                <div className="p-4 flex items-center justify-between text-sm text-gray-400 border-t border-gray-700">
                    <div>
                        <label htmlFor="rows-per-page" className="mr-2">Rows per page:</label>
                        <select id="rows-per-page" value={rowsPerPage} onChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setCurrentPage(1); }} className="bg-gray-700 border border-gray-600 rounded-md p-1 focus:ring-1 focus:ring-blue-500 focus:outline-none">
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={-1}>All</option>
                        </select>
                    </div>
                    {rowsPerPage !== -1 && (
                        <>
                        {totalPages > 0 && (
                            <span>Page {currentPage} of {totalPages}</span>
                        )}
                        <div className="space-x-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 bg-gray-600 rounded disabled:opacity-50">Previous</button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-3 py-1 bg-gray-600 rounded disabled:opacity-50">Next</button>
                        </div>
                        </>
                    )}
                </div>
            </div>

             {/* Info Modal */}
            {(infoModalFile || isFetchingDetails) && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={() => setInfoModalFile(null)}>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <header className="flex items-center justify-between p-4 border-b border-gray-600">
                            <h3 className="text-lg font-bold text-gray-100">File Metadata</h3>
                            <button onClick={() => setInfoModalFile(null)} className="text-gray-400 hover:text-white">&times;</button>
                        </header>
                        <main className="p-4 overflow-auto">
                            {isFetchingDetails ? (
                                <p className="text-gray-300">Fetching full details...</p>
                            ) : (
                                <pre className="text-xs text-gray-200 whitespace-pre-wrap break-all bg-gray-900 p-4 rounded-md">
                                    {JSON.stringify(infoModalFile, null, 2)}
                                </pre>
                            )}
                        </main>
                    </div>
                </div>
            )}
            
            {/* Confirmation Modal for Deletion */}
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
                message={
                    filesToDelete.length > 1
                        ? `Are you sure you want to delete ${filesToDelete.length} files? This action will remove them from the Gemini API and, if tracked locally, from the application's database.`
                        : `Are you sure you want to delete the selected file? This action will remove it from the Gemini API and, if tracked locally, from the application's database.`
                }
                confirmButtonText="Confirm Delete"
                confirmButtonClassName="bg-red-600 hover:bg-red-500 focus:ring-red-500"
            />
            
            {/* Confirmation Modal for Force Resync */}
            <ConfirmationModal
                isOpen={isForceResyncModalOpen}
                onClose={() => setIsForceResyncModalOpen(false)}
                onConfirm={handleConfirmForceResync}
                title="Confirm Force Resync"
                message="Are you sure you want to force a resync? This will make the remote file store an exact mirror of your current local database. It will permanently delete any application-managed files (__cc_*) on the server that do not exist on this device."
                confirmButtonText="Confirm Sync"
                confirmButtonClassName="bg-yellow-600 hover:bg-yellow-500 focus:ring-yellow-500"
            />
        </div>
    );
};

export default FileManagementPanel;
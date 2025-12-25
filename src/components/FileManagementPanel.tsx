import React, { useState, useEffect, useCallback, useContext } from 'react';
import * as geminiFileService from '../services/geminiFileService';
import { GeminiFile } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { log } from '../services/loggingService';
import { FILE_PURPOSES, buildInternalFileName } from '../config/file_naming_config';
import { geminiCorpusContext } from '../contexts/GeminiCorpusContext';
import { ContentContext } from '../contexts/ContentContext';
import * as dbService from '../services/dbService';
import FileUploadPanel from './FileUploadPanel';
import FilesTable from './FilesTable';
import FileInfoModal from './FileInfoModal';
import FileActions from './FileActions';

type SortableColumn = keyof GeminiFile;
type SortDirection = 'asc' | 'desc';

const FileManagementPanel: React.FC = () => {
    const { contextFiles, syncCorpus, forceResync, status } = useContext(geminiCorpusContext);
    const { addContextDocument, removeContextDocument } = useContext(ContentContext);

    const [files, setFiles] = useState<GeminiFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: SortableColumn; direction: SortDirection } | null>({ key: 'createTime', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [infoModalFile, setInfoModalFile] = useState<GeminiFile | null>(null);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
    const [isForceResyncModalOpen, setIsForceResyncModalOpen] = useState(false);
    const [isPurgeConfirmModalOpen, setIsPurgeConfirmModalOpen] = useState(false);

    useEffect(() => {
        setIsLoading(status === 'SYNCING');
        if (status === 'READY') {
            const fileArray = Array.from(contextFiles.values());
            setFiles(fileArray);
            setError(null);
        } else if (status === 'ERROR') {
            setError('Failed to synchronize files. Please check the console for details.');
            setFiles([]);
        }
    }, [contextFiles, status]);

    const handleRefresh = useCallback(() => {
        syncCorpus();
    }, [syncCorpus]);

    const handleConfirmPurge = async () => {
        log.info('FileManagementPanel: Purge confirmed. Deleting all remote application files and entire local database.');
        setIsPurgeConfirmModalOpen(false);
        setIsLoading(true);
        setError(null);

        try {
            const remoteFiles = await geminiFileService.listGeminiFiles();
            const appFilesToDelete = remoteFiles.filter(f => f.displayName?.startsWith('__cc_'));
            log.info(`Found ${appFilesToDelete.length} application-managed files to delete from the remote server.`);

            if (appFilesToDelete.length > 0) {
                const deletionPromises = appFilesToDelete.map(file =>
                    geminiFileService.deleteFileFromCorpus(file.name)
                );
                const results = await Promise.allSettled(deletionPromises);
                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        log.error(`Failed to delete remote file ${appFilesToDelete[index].name}:`, result.reason);
                    }
                });
            }

            await dbService.purgeDatabase();
            window.location.reload();
        } catch (error) {
            log.error('Failed to purge databases', error);
            setError('Failed to purge databases. Check console for details.');
            setIsLoading(false);
        }
    };

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
            const selectableFileNames = files
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

    const handleUpload = async (uploadFile: File, displayName: string, selectedPurpose: string) => {
        const internalName = buildInternalFileName(displayName, selectedPurpose);
        await geminiFileService.registerLocalFile(internalName, displayName, uploadFile);

        const purpose = FILE_PURPOSES.find(p => p.id === selectedPurpose);
        if (purpose && ['content', 'instrux', 'reference'].includes(purpose.contextPrefix)) {
            await addContextDocument(uploadFile, internalName);
        }

        setSelectedFiles(new Set());
        await syncCorpus(); // Trigger a sync after upload
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
                const fileMetadata = files.find(f => f.name === fileName);

                if (fileMetadata) {
                     await geminiFileService.deleteFileFromCorpus(fileMetadata.name);

                    if (fileMetadata.context && ['content', 'instrux', 'reference'].includes(fileMetadata.context)) {
                        await removeContextDocument(fileMetadata.cachedDisplayName || fileMetadata.displayName);
                    }
                } else {
                    log.info(`Could not find metadata for file to delete: ${fileName}. Attempting remote deletion only.`);
                    await geminiFileService.deleteFileFromCorpus(fileName);
                }
            });

            await Promise.all(deletionPromises);
        } catch (err: any) {
            setError(err.message || 'An error occurred during deletion.');
        } finally {
            setFilesToDelete([]);
            setSelectedFiles(new Set());
            await syncCorpus(); // Re-sync after deletion
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
        }
    };

    const handleShowInfo = async (file: GeminiFile) => {
        log.info('FileManagementPanel: handleShowInfo triggered for file:', file);
        if (file.status === 'local_only') {
            log.info('File is local-only, displaying cached metadata without API call.');
            setInfoModalFile(file);
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

    return (
        <div className="space-y-8 animate-fade-in">
            <FileUploadPanel onUpload={handleUpload} />

            <div className="bg-gray-800 rounded-lg border border-gray-700">
                <FileActions
                    isLoading={isLoading}
                    onPurge={() => setIsPurgeConfirmModalOpen(true)}
                    onForceResync={() => setIsForceResyncModalOpen(true)}
                    onRefresh={handleRefresh}
                    fileCount={files.length}
                />
                <FilesTable
                    files={files}
                    isLoading={isLoading}
                    error={error}
                    selectedFiles={selectedFiles}
                    sortConfig={sortConfig}
                    currentPage={currentPage}
                    rowsPerPage={rowsPerPage}
                    onSort={requestSort}
                    onSelectAll={handleSelectAll}
                    onSelectOne={handleSelectOne}
                    onDelete={handleDelete}
                    onShowInfo={handleShowInfo}
                    onPageChange={setCurrentPage}
                    onRowsPerPageChange={(rows) => { setRowsPerPage(rows); setCurrentPage(1); }}
                />
            </div>

            <FileInfoModal
                file={infoModalFile}
                isFetching={isFetchingDetails}
                onClose={() => setInfoModalFile(null)}
            />

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

            <ConfirmationModal
                isOpen={isForceResyncModalOpen}
                onClose={() => setIsForceResyncModalOpen(false)}
                onConfirm={handleConfirmForceResync}
                title="Confirm Force Resync"
                message="Are you sure you want to force a resync? This will make the remote file store an exact mirror of your current local database. It will permanently delete any application-managed files (__cc_*) on the server that do not exist on this device."
                confirmButtonText="Confirm Sync"
                confirmButtonClassName="bg-yellow-600 hover:bg-yellow-500 focus:ring-yellow-500"
            />

            <ConfirmationModal
                isOpen={isPurgeConfirmModalOpen}
                onClose={() => setIsPurgeConfirmModalOpen(false)}
                onConfirm={handleConfirmPurge}
                title="Confirm Databases Purge"
                message="Are you sure you want to permanently delete all application-managed files from the Gemini API and then purge the entire local database? This will remove all cached files, context documents, and other application data. This action cannot be undone."
                confirmButtonText="Purge Database"
                confirmButtonClassName="bg-red-600 hover:bg-red-500 focus:ring-red-500"
            />
        </div>
    );
};

export default FileManagementPanel;

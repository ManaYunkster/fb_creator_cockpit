

import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext, useMemo, useRef } from 'react';
import { GeminiFile, GeminiCorpusContextType, CorpusSyncStatus, FileContentRecord } from '../types';
import * as geminiFileService from '../services/geminiFileService';
import * as dbService from '../services/dbService';
import { log } from '../services/loggingService';
import { DataContext } from './DataContext';

const MAX_CONCURRENT_UPLOADS = 5;

export const geminiCorpusContext = createContext<GeminiCorpusContextType>({
    status: 'EMPTY',
    contextFiles: new Map(),
    syncCorpus: async () => {},
    forceResync: async () => {},
    syncStatus: 'awaiting-sync',
});

interface GeminiCorpusProviderProps {
    children: ReactNode;
}

export const GeminiCorpusProvider: React.FC<GeminiCorpusProviderProps> = ({ children }) => {
    const { isCorpusReady } = useContext(DataContext);
    const [status, setStatus] = useState<CorpusSyncStatus>('EMPTY');
    const [contextFiles, setContextFiles] = useState<Map<string, GeminiFile>>(new Map());
    const [syncStatus, setSyncStatus] = useState('awaiting-sync');
    const isSyncing = useRef(false);

    const loadFromCache = useCallback(async () => {
        log.info('GeminiCorpusContext: Loading files from cache.');
        const files = await geminiFileService.loadFilesFromCache();
        setContextFiles(files);
        if (files.size > 0) {
            setStatus('READY');
            log.info(`GeminiCorpusContext: Loaded ${files.size} files from cache. Status set to READY.`);
        } else {
            setStatus('EMPTY');
            log.info('GeminiCorpusContext: No files found in cache. Status set to EMPTY.');
        }
    }, []);

    const syncCorpus = useCallback(async (isForced = false) => {
        if (isSyncing.current) {
            log.info('GeminiCorpusContext: Sync already in progress.');
            return;
        }
        isSyncing.current = true;
        setSyncStatus(isForced ? 'force-resync-start' : 'sync-started');
        setStatus('SYNCING');
        log.info(`GeminiCorpusContext: Starting corpus synchronization (Forced: ${isForced})...`);

        try {
            // Step 1: Sanitize database to remove invalid content records.
            await dbService.sanitizeFileContentStore();

            // Step 2: Sanitize database to remove stale 'local/' metadata records.
            log.info('GeminiCorpusContext: Sanitizing stale local file metadata...');
            const allMetadata = await dbService.getAll<GeminiFile>('files');
            const localRecords = allMetadata.filter(f => f.name.startsWith('local/'));
            const remoteRecords = allMetadata.filter(f => f.name.startsWith('files/'));
            const remoteDisplayNameSet = new Set(remoteRecords.map(f => f.displayName));
            
            let staleCount = 0;
            for (const localRecord of localRecords) {
                if (remoteDisplayNameSet.has(localRecord.displayName)) {
                    await dbService.del('files', localRecord.name);
                    staleCount++;
                }
            }
            if (staleCount > 0) {
                log.info(`Sanitized ${staleCount} stale local file metadata records.`);
            }

            const allLocalContent: FileContentRecord[] = await dbService.getAll('file_contents');
            const allLocalMetadata = await dbService.getAll<GeminiFile>('files');
            const localMetadataDisplayNames = new Set(allLocalMetadata.map(m => m.displayName));

            // Use the metadata store ('files') as the source of truth for what should exist.
            // Filter the content store to only include files that have a corresponding metadata entry.
            const localFiles = allLocalContent.filter(lc => localMetadataDisplayNames.has(lc.internalName));
            
            const rawRemoteFiles = await geminiFileService.listGeminiFiles();
            const cachedFiles = await dbService.getAll<GeminiFile>('files');
            const cachedFilesMap = new Map(cachedFiles.map(f => [f.name, f]));

            const processedRemoteFiles = await Promise.all(rawRemoteFiles.map(rf => 
                geminiFileService.processFileMetadata(rf, cachedFilesMap.get(rf.name))
            ));
            const remoteFilesMap = new Map(processedRemoteFiles.map(f => [f.displayName, f]));

            log.info(`Found ${localFiles.length} local files and ${remoteFilesMap.size} remote files (after processing).`);
            setSyncStatus('analyzing-diff');

            if (isForced) {
                // The 'files' metadata table is the source of truth for what the application is managing.
                const localFileDisplayNames = new Set(allLocalMetadata.map(m => m.displayName));
                const remoteAppFiles = processedRemoteFiles.filter(rf => rf.displayName?.startsWith('__cc_'));
                
                // A remote file is an orphan if it's not in our definitive list of managed files.
                const filesToDelete = remoteAppFiles.filter(rf => !localFileDisplayNames.has(rf.displayName));

                if (filesToDelete.length > 0) {
                    log.info(`Force Resync: Found ${filesToDelete.length} orphaned application-managed files on remote to delete.`);
                    log.debug('Orphaned files to delete:', filesToDelete.map(f => ({ name: f.name, displayName: f.displayName })))
                    setSyncStatus(`deleting ${filesToDelete.length} orphaned files`);
                    await Promise.all(filesToDelete.map(f => geminiFileService.deleteFileFromCorpus(f.name)));
                    log.info('Force Resync: Finished deleting remote orphaned files.');
                } else {
                    log.info('Force Resync: No orphaned application-managed files found on remote to delete.');
                }
            }

            interface UploadTask {
                fileRecord: FileContentRecord;
                oldRemoteFileToDelete?: GeminiFile;
            }

            const uploadTasks: UploadTask[] = [];
            localFiles.forEach(lf => {
                const remoteFile = remoteFilesMap.get(lf.internalName);
                let shouldUpload = false;
                let reason = '';
                let oldRemoteFileToDelete: GeminiFile | undefined = undefined;

                if (isForced) {
                    shouldUpload = true;
                    reason = 'Forced resync';
                    if (remoteFile) {
                        oldRemoteFileToDelete = remoteFile;
                    }
                                } else if (!remoteFile) {
                                    shouldUpload = true;
                                    reason = 'File is new or missing from remote';
                                } else {
                                    const localDate = new Date(lf.modified);
                                    const remoteDate = new Date(remoteFile.updateTime);
                                    if (localDate.getTime() > remoteDate.getTime()) {
                                        shouldUpload = true;
                                        reason = `Local file is newer (${localDate.toISOString()} > ${remoteDate.toISOString()})`;
                                        oldRemoteFileToDelete = remoteFile;
                                    } else {
                                        shouldUpload = false;
                                        reason = `Local file is not newer (${localDate.toISOString()} <= ${remoteDate.toISOString()})`;
                                    }
                                }

                log.debug(`Sync check for "${lf.internalName}":`, {
                    shouldUpload,
                    reason,
                    localFile: { name: lf.name, modified: new Date(lf.modified).toISOString() },
                    remoteFile: remoteFile ? { name: remoteFile.name, displayName: remoteFile.displayName, updateTime: new Date(remoteFile.updateTime).toISOString() } : 'N/A',
                });

                if (shouldUpload) {
                    uploadTasks.push({ fileRecord: lf, oldRemoteFileToDelete });
                }
            });
            
            log.info(`${uploadTasks.length} files to upload.`);

            if (uploadTasks.length > 0) {
                setSyncStatus(`uploading ${uploadTasks.length} files`);
                const batches: UploadTask[][] = [];
                for (let i = 0; i < uploadTasks.length; i += MAX_CONCURRENT_UPLOADS) {
                    batches.push(uploadTasks.slice(i, i + MAX_CONCURRENT_UPLOADS));
                }

                for (let i = 0; i < batches.length; i++) {
                    log.info(`Uploading batch ${i + 1}/${batches.length}...`);
                    await Promise.all(batches[i].map(async (task) => {
                        const { fileRecord, oldRemoteFileToDelete } = task;
                        try {
                            const file = new File([fileRecord.content], fileRecord.name, { type: fileRecord.mimeType });
                            await geminiFileService.uploadFileToCorpus(file, fileRecord.internalName);
                            log.info(`Successfully uploaded: ${fileRecord.internalName}`);

                            if (oldRemoteFileToDelete) {
                                log.info(`Deleting old remote version of ${fileRecord.internalName} (name: ${oldRemoteFileToDelete.name})`);
                                await geminiFileService.deleteFileFromCorpus(oldRemoteFileToDelete.name);
                                log.info(`Successfully deleted old remote version of ${fileRecord.internalName}`);
                            }
                        } catch (uploadError) {
                            log.error(`Failed to upload and process ${fileRecord.internalName}:`, uploadError);
                            // Optional: Decide if one failure should halt the entire sync.
                            // For now, we log the error and continue.
                        }
                    }));
                }
            }
            
            setSyncStatus('verifying');
            const finalRawRemoteFiles = await geminiFileService.listGeminiFiles();
            const finalCachedFiles = await dbService.getAll<GeminiFile>('files');
            const finalCachedFilesMap = new Map(finalCachedFiles.map(f => [f.name, f]));
            const finalProcessedFiles = await Promise.all(finalRawRemoteFiles.map(rf => 
                geminiFileService.processFileMetadata(rf, finalCachedFilesMap.get(rf.name))
            ));
            const finalFilesMap = new Map(finalProcessedFiles.map(f => [f.displayName, f]));
            
            setContextFiles(finalFilesMap);
            await geminiFileService.cacheFiles(finalFilesMap);
            setStatus('READY');
            setSyncStatus('sync-complete');
            log.info('GeminiCorpusContext: Corpus synchronization complete.');

        } catch (error) {
            log.error('Corpus synchronization failed:', error);
            setStatus('ERROR');
            setSyncStatus('error');
        } finally {
            isSyncing.current = false;
            setSyncStatus('awaiting-sync');
        }
    }, []);

    const forceResync = useCallback(async () => {
        log.info('User initiated a force resync.');
        await syncCorpus(true);
    }, [syncCorpus]);

    useEffect(() => {
        loadFromCache();
    }, [loadFromCache]);

    useEffect(() => {
        if (isCorpusReady) {
            log.info('GeminiCorpusContext: Data corpus is ready, initiating standard sync.');
            syncCorpus(false);
        }
    }, [isCorpusReady, syncCorpus]);
    
    const value = useMemo(() => ({
        status,
        contextFiles,
        syncCorpus: () => syncCorpus(false),
        forceResync,
        syncStatus
    }), [status, contextFiles, syncCorpus, forceResync, syncStatus]);

    return (
        <geminiCorpusContext.Provider value={value}>
            {children}
        </geminiCorpusContext.Provider>
    );
};

export default GeminiCorpusProvider;

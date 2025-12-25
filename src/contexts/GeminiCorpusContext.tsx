
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
            // Step 1: Gather all data sources
            let allLocalMetadata = await dbService.getAll<GeminiFile>('files');
            const allLocalContent = await dbService.getAll<FileContentRecord>('file_contents');
            const contentMap = new Map(allLocalContent.map(c => [c.internalName, c]));

            // Step 2: Purge stale local records where a synced version exists
            log.info('Sanitizing for stale local records...');
            const filesByName = new Map<string, { local?: GeminiFile, synced?: GeminiFile }>();
            allLocalMetadata.forEach(file => {
                if (!file.displayName) return;
                const entry = filesByName.get(file.displayName) || {};
                if (file.name.startsWith('local/')) {
                    entry.local = file;
                } else if (file.name.startsWith('files/')) {
                    entry.synced = file;
                }
                filesByName.set(file.displayName, entry);
            });

            const staleLocalRecordsToDelete = new Set<string>();
            for (const [displayName, files] of filesByName.entries()) {
                if (files.local && files.synced && !files.local.isPermanent) {
                    log.info(`Found stale local record for already-synced file "${displayName}". Deleting ${files.local.name}.`);
                    staleLocalRecordsToDelete.add(files.local.name);
                }
            }
            if (staleLocalRecordsToDelete.size > 0) {
                for (const name of staleLocalRecordsToDelete) {
                    await dbService.del('files', name);
                }
                allLocalMetadata = await dbService.getAll<GeminiFile>('files');
            } else {
                log.info('No stale local records found.');
            }
            
            // Step 3: Perform local-first cleanup based on displayName collisions
            log.info('Sanitizing local metadata for displayName collisions...');
            const localFilesByDisplayName = new Map<string, GeminiFile[]>();
            allLocalMetadata.forEach(file => {
                if (file.displayName) {
                    const group = localFilesByDisplayName.get(file.displayName) || [];
                    group.push(file);
                    localFilesByDisplayName.set(file.displayName, group);
                }
            });

            let staleCollisionRecordsToDelete = new Set<string>();

            for (const [displayName, files] of localFilesByDisplayName.entries()) {
                if (files.length <= 1) continue;

                log.info(`Found ${files.length} local records for "${displayName}". Resolving canonical version.`);

                files.sort((a, b) => new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime());

                const syncedRecords = files.filter(f => f.name.startsWith('files/'));
                const localOnlyRecords = files.filter(f => f.name.startsWith('local/'));

                let canonical: GeminiFile | null = null;

                const latestSynced = syncedRecords[0] || null;
                const latestLocalOnly = localOnlyRecords[0] || null;
                const latestLocalContent = latestLocalOnly ? contentMap.get(latestLocalOnly.displayName) : null;

                if (latestSynced && latestLocalContent) {
                    const syncedTime = new Date(latestSynced.updateTime).getTime();
                    const localContentTime = new Date(latestLocalContent.modified).getTime();
                    if (localContentTime > syncedTime) {
                        canonical = latestLocalOnly;
                        log.info(`Local content for "${displayName}" is newer. Prioritizing local version.`);
                    } else {
                        canonical = latestSynced;
                    }
                } else if (latestSynced) {
                    canonical = latestSynced;
                } else if (latestLocalOnly) {
                    canonical = latestLocalOnly;
                }

                if (canonical) {
                    log.info(`Canonical local record for "${displayName}" is ${canonical.name}.`);
                    files.forEach(f => {
                        if (f.name !== canonical!.name && !f.isPermanent) {
                            staleCollisionRecordsToDelete.add(f.name);
                        } else if (f.name !== canonical!.name && f.isPermanent) {
                            log.info(`Skipping deletion of non-canonical but permanent file: ${f.name}`);
                        }
                    });
                } else {
                    log.info(`Could not determine canonical record for "${displayName}". Skipping cleanup for this group.`);
                }
            }
            
            if (staleCollisionRecordsToDelete.size > 0) {
                log.info(`Deleting ${staleCollisionRecordsToDelete.size} stale local metadata records from collisions.`);
                for (const name of staleCollisionRecordsToDelete) {
                    await dbService.del('files', name);
                    log.info(`Deleted stale local record: ${name}`);
                }
            } else {
                log.info('No local displayName collisions found to clean up.');
            }

            // Step 4: Sanitize content store and get fresh data
            await dbService.sanitizeFileContentStore();
            const freshLocalMetadata = await dbService.getAll<GeminiFile>('files');
            const freshLocalContent = await dbService.getAll<FileContentRecord>('file_contents');
            
            // Step 5: Full remote sync and reconciliation
            const rawRemoteFiles = await geminiFileService.listGeminiFiles();
            const appRemoteFiles = rawRemoteFiles.filter(file => file.displayName?.startsWith('__cc_'));
            log.info(`Deduplicating ${appRemoteFiles.length} app-managed remote files by displayName...`);
            const remoteFilesByDisplayName = new Map<string, GeminiFile[]>();
            appRemoteFiles.forEach(file => {
                if (file.displayName) {
                    const group = remoteFilesByDisplayName.get(file.displayName) || [];
                    group.push(file);
                    remoteFilesByDisplayName.set(file.displayName, group);
                }
            });

            let canonicalRemoteFiles: GeminiFile[] = [];
            for (const [displayName, files] of remoteFilesByDisplayName.entries()) {
                if (files.length > 1) {
                    log.info(`Found ${files.length} remote duplicates for "${displayName}".`);
                    files.sort((a, b) => new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime());
                    const canonical = files.shift()!;
                    canonicalRemoteFiles.push(canonical);
                    log.info(`Canonical remote for "${displayName}" is ${canonical.name}.`);
                    for (const duplicate of files) {
                        if (duplicate.displayName && duplicate.displayName.startsWith('__cc_sys')) {
                            log.info(`Skipping deletion of suspected permanent system file on remote: ${duplicate.name}`);
                            continue;
                        }
                        log.info(`Deleting remote duplicate: ${duplicate.name} (displayName: "${displayName}")`);
                        await geminiFileService.deleteFileFromCorpus(duplicate.name);
                    }
                } else {
                    canonicalRemoteFiles.push(files[0]);
                }
            }
            log.info('Remote deduplication complete.');
            
            const remoteFilesMap = new Map(canonicalRemoteFiles.map(f => [f.displayName, f]));
            
            // Step 6: Clean up local records that point to non-existent remote files
            log.info('Checking for stale local records pointing to deleted remote files...');
            let staleRemotePointersToDelete: string[] = [];
            const currentLocalMetadata = await dbService.getAll<GeminiFile>('files'); // Re-fetch for safety
            currentLocalMetadata.forEach(localMeta => {
                if (localMeta.isPermanent) {
                    log.info(`Skipping deletion check for permanent file: ${localMeta.displayName}`);
                    return;
                }
                if (!localMeta.displayName?.startsWith('__cc_')) {
                    return;
                }
                if (localMeta.name.startsWith('files/') && !remoteFilesMap.has(localMeta.displayName)) {
                    log.info(`Found stale local record for deleted remote file: ${localMeta.name} (displayName: "${localMeta.displayName}")`);
                    staleRemotePointersToDelete.push(localMeta.name);
                }
            });

            if (staleRemotePointersToDelete.length > 0) {
                log.info(`Deleting ${staleRemotePointersToDelete.length} stale remote pointers.`);
                for (const name of staleRemotePointersToDelete) {
                    await dbService.del('files', name);
                    log.info(`Deleted stale remote pointer: ${name}`);
                }
            }

            // Step 7: Determine files to upload
            const finalLocalMetadata = await dbService.getAll<GeminiFile>('files');
            const finalLocalMetadataMap = new Map(finalLocalMetadata.map(f => [f.displayName, f]));
            const localFilesToSync = freshLocalContent.filter(lc => finalLocalMetadataMap.has(lc.internalName));
            
            log.info(`Found ${localFilesToSync.length} local files to sync and ${remoteFilesMap.size} remote files.`);
            setSyncStatus('analyzing-diff');

            if (isForced) {
                const localFileDisplayNames = new Set(finalLocalMetadata.map(m => m.displayName));
                const remoteAppFiles = canonicalRemoteFiles.filter(rf => rf.displayName?.startsWith('__cc_'));
                const remoteOrphans = remoteAppFiles.filter(rf => !rf.displayName?.startsWith('__cc_sys') && !localFileDisplayNames.has(rf.displayName));

                if (remoteOrphans.length > 0) {
                    log.info(`Force Resync: Found ${remoteOrphans.length} orphaned remote files to delete.`);
                    for (const orphan of remoteOrphans) {
                        log.info(`Deleting remote orphan: ${orphan.name} (displayName: "${orphan.displayName}")`);
                        await geminiFileService.deleteFileFromCorpus(orphan.name);
                    }
                }
            }

            const uploadTasks: { fileRecord: FileContentRecord; oldRemoteFileToDelete?: GeminiFile }[] = [];
            localFilesToSync.forEach(lf => {
                const remoteFile = remoteFilesMap.get(lf.internalName);
                let shouldUpload = false;
                if (isForced) {
                    shouldUpload = true;
                } else if (!remoteFile) {
                    shouldUpload = true;
                } else {
                    const localDate = new Date(lf.modified);
                    const remoteDate = new Date(remoteFile.updateTime);
                    if (localDate.getTime() > remoteDate.getTime()) {
                        shouldUpload = true;
                    }
                }

                if (shouldUpload) {
                    uploadTasks.push({ fileRecord: lf, oldRemoteFileToDelete: remoteFile });
                }
            });
            
            log.info(`${uploadTasks.length} files to upload.`);
            if (uploadTasks.length > 0) {
                setSyncStatus(`uploading ${uploadTasks.length} files`);
                for (let i = 0; i < uploadTasks.length; i += MAX_CONCURRENT_UPLOADS) {
                    const batch = uploadTasks.slice(i, i + MAX_CONCURRENT_UPLOADS);
                    await Promise.all(batch.map(async (task) => {
                        try {
                            const file = new File([task.fileRecord.content], task.fileRecord.name, { type: task.fileRecord.mimeType });
                            if (task.oldRemoteFileToDelete) {
                                log.info(`Deleting old remote version of ${task.fileRecord.internalName}`);
                                await geminiFileService.deleteFileFromCorpus(task.oldRemoteFileToDelete.name).catch(e => log.error('Old file deletion failed, proceeding with upload', e));
                            }
                            await geminiFileService.uploadFileToCorpus(file, task.fileRecord.internalName);
                            log.info(`Successfully uploaded: ${task.fileRecord.internalName}`);
                        } catch (uploadError) {
                            log.error(`Failed to upload ${task.fileRecord.internalName}:`, uploadError);
                        }
                    }));
                }
            }
            
            // Final verification and state merge step
            setSyncStatus('verifying');
            const finalRemoteFilesList = (await geminiFileService.listGeminiFiles())
                .filter(file => file.displayName?.startsWith('__cc_'));
            const finalLocalFiles = await dbService.getAll<GeminiFile>('files');
            const finalFilesMap = new Map<string, GeminiFile>();

            // Process local files first
            for (const localFile of finalLocalFiles) {
                const processed = await geminiFileService.processFileMetadata(localFile, localFile);
                processed.status = 'local_only';
                finalFilesMap.set(processed.displayName, processed);
            }

            // Process remote files, overwriting local entries with synced data
            for (const remoteFile of finalRemoteFilesList) {
                const processed = await geminiFileService.processFileMetadata(remoteFile, finalFilesMap.get(remoteFile.displayName));
                processed.status = 'synced';
                finalFilesMap.set(processed.displayName, processed);
            }

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
            setSyncStatus(prev => (prev === 'sync-complete' || prev === 'error') ? prev : 'awaiting-sync');
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



import React, { createContext, useState, ReactNode, useCallback, useContext, useEffect } from 'react';
import { GeminiCorpusState, GeminiCorpusContextType, GeminiFile, FileContentRecord } from '../types';
import * as geminiCorpusService from '../services/geminiCorpusService';
import * as geminiFileService from '../services/geminiFileService';
import { log } from '../services/loggingService';
import { TestModeContext } from './TestModeContext';
import { buildInternalFileName } from '../config/file_naming_config';
import * as dbService from '../services/dbService';
import { DataContext } from './DataContext';
import { ContentContext } from './ContentContext';

const initialState: GeminiCorpusState = {
    status: 'EMPTY',
    allFiles: [],
    corpusFiles: new Map(),
    contextFiles: new Map(),
    error: null,
};

export const GeminiCorpusContext = createContext<GeminiCorpusContextType>({
    ...initialState,
    resetCorpus: () => {},
    refreshSyncedFiles: async () => {},
    forceResync: async () => {},
});

export const GeminiCorpusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<GeminiCorpusState>(initialState);
    const { isTestMode, activeTests } = useContext(TestModeContext);
    const dataContext = useContext(DataContext);
    const contentContext = useContext(ContentContext);

    const refreshSyncedFiles = useCallback(async () => {
        log.info('GeminiCorpusContext: Starting DB-first file synchronization...');
        setState(s => ({ ...s, status: 'SYNCING', error: null }));
        try {
            // 1. Fetch from both sources: DB (desired truth) and API (current state)
            const localFiles = await dbService.getAll<GeminiFile>('files');
            const remoteFiles = await geminiFileService.listFilesFromApi();

            const localFilesMap = new Map(localFiles.map(f => [f.displayName, f]));
            const remoteFilesMap = new Map(remoteFiles.map(f => [f.displayName, f]));

            const filesToUpload = new Map<string, GeminiFile>();
            const filesToDelete = new Map<string, GeminiFile>();
            const metadataToUpdateLocally = new Map<string, GeminiFile>();
            const filesToAddLocally: GeminiFile[] = [];

            // --- Pass 1: Check local state against remote state ---
            for (const localFile of localFiles) {
                const remoteMatch = remoteFilesMap.get(localFile.displayName);
                if (localFile.name.startsWith('local/')) {
                    if (remoteMatch) {
                        // This local file is a placeholder, but a remote file with the same name now exists.
                        // Update the local record with the remote data instead of re-uploading.
                        metadataToUpdateLocally.set(localFile.name, remoteMatch);
                    } else {
                        // This is a new local file that needs to be uploaded.
                        filesToUpload.set(localFile.displayName, localFile);
                    }
                } else if (remoteMatch && localFile.name !== remoteMatch.name) {
                    // Local file has a stale API name. Update it with the authoritative remote one.
                    metadataToUpdateLocally.set(localFile.name, remoteMatch);
                } else if (!remoteMatch) {
                    // File exists locally with a real API name, but is not on the API. Re-queue for upload.
                    filesToUpload.set(localFile.displayName, localFile);
                }
            }
            
            // --- Pass 2: Check remote state against local state ---
            for (const remoteFile of remoteFiles) {
                if (!localFilesMap.has(remoteFile.displayName)) {
                    // This remote file is an orphan OR from another device.
                    if (remoteFile.displayName.startsWith('__cc')) {
                        // It's a managed file, and it's an orphan. Delete it.
                        filesToDelete.set(remoteFile.displayName, remoteFile);
                    } else {
                        // It's a user-managed file from another device. Add its metadata locally.
                        filesToAddLocally.push(remoteFile);
                    }
                }
            }

            log.info(`Sync Plan: ${filesToUpload.size} to upload, ${filesToDelete.size} to delete, ${metadataToUpdateLocally.size} to update locally, ${filesToAddLocally.length} to add locally.`);

            // --- Execute Sync Plan ---
            if (metadataToUpdateLocally.size > 0) {
                log.info('Executing metadata updates...');
                for (const [localId, remoteFile] of metadataToUpdateLocally.entries()) {
                    await dbService.del('files', localId);
                    await dbService.put('files', remoteFile);
                    log.info(`Updated local record for "${remoteFile.displayName}" with new remote data from "${remoteFile.name}".`);
                }
            }
            
            if (filesToUpload.size > 0) {
                log.info('Executing uploads...');
                const uploadPromises = Array.from(filesToUpload.values()).map(async (localFileMeta) => {
                    const contentRecord = await dbService.get<FileContentRecord>('file_contents', localFileMeta.displayName);
                    if (contentRecord?.content) {
                        const fileToUpload = new File([contentRecord.content], localFileMeta.cachedDisplayName || localFileMeta.displayName, { type: contentRecord.mimeType });
                        return geminiFileService.uploadFile(fileToUpload, {
                            displayName: localFileMeta.displayName,
                            cacheAs: localFileMeta.cachedDisplayName,
                        });
                    }
                });
                await Promise.all(uploadPromises);
            }

            if (filesToDelete.size > 0) {
                log.info('Executing deletions...');
                const deletePromises = Array.from(filesToDelete.values()).map(file => geminiFileService.deleteFileFromApiOnly(file.name));
                await Promise.all(deletePromises);
            }

            if (filesToAddLocally.length > 0) {
                log.info(`Sync: Adding ${filesToAddLocally.length} remote file(s) to local DB.`);
                await dbService.bulkPut('files', filesToAddLocally);
            }


            // --- Finalize and update state ---
            const finalFiles = await geminiFileService.listFiles();
            const corpusFiles = new Map<string, GeminiFile>();
            const contextFiles = new Map<string, GeminiFile>();

            finalFiles.forEach(file => {
                if (file.context === 'corpus') {
                    corpusFiles.set(file.cachedDisplayName || file.displayName, file);
                }
                if (['content', 'instrux', 'reference'].includes(file.context || '')) {
                    contextFiles.set(file.displayName, file);
                }
            });

            setState({ status: 'READY', allFiles: finalFiles, corpusFiles, contextFiles, error: null });
            log.info('GeminiCorpusContext: Synchronization complete.');
        } catch (e: any) {
            log.error('Error during corpus synchronization:', e);
            setState(s => ({ ...s, status: 'ERROR', error: e.message }));
            throw e;
        }
    }, []);

    const forceResync = useCallback(async () => {
        log.info('GeminiCorpusContext: Starting FORCE RESYNC from local DB...');
        setState(s => ({ ...s, status: 'SYNCING', error: null }));

        try {
            // 1. Clear the remote API of managed files only
            log.info('FORCE RESYNC: Deleting managed files from the Gemini API...');
            const remoteFiles = await geminiFileService.listFilesFromApi();
            const managedRemoteFiles = remoteFiles.filter(file => file.displayName.startsWith('__cc'));
            
            const deletePromises = managedRemoteFiles.map(file => geminiFileService.deleteFileFromApiOnly(file.name));
            await Promise.all(deletePromises);
            log.info(`FORCE RESYNC: Deleted ${managedRemoteFiles.length} managed files from API.`);

            // 2. Get all local files from the DB (the source of truth)
            const localFileRecords = await dbService.getAll<GeminiFile>('files');
            log.info(`FORCE RESYNC: Found ${localFileRecords.length} file records in local DB.`);

            // 3. Filter for records that have content and re-upload them.
            const validFilesToUpload: { meta: GeminiFile, content: FileContentRecord }[] = [];
            for (const record of localFileRecords) {
                const contentRecord = await dbService.get<FileContentRecord>('file_contents', record.displayName);
                if (contentRecord?.content) {
                    validFilesToUpload.push({ meta: record, content: contentRecord });
                } else {
                    log.info(`FORCE RESYNC: Skipping upload for "${record.displayName}" because its content blob is missing from the local DB. This may be an orphaned record from a previous session.`);
                }
            }
            log.info(`FORCE RESYNC: Found ${validFilesToUpload.length} valid files with content to upload.`);

            // 4. Re-upload all valid local files
            const uploadPromises = validFilesToUpload.map(async ({ meta, content }) => {
                const fileToUpload = new File(
                    [content.content],
                    meta.cachedDisplayName || meta.displayName,
                    { type: content.mimeType }
                );
                return geminiFileService.uploadFile(fileToUpload, {
                    displayName: meta.displayName,
                    cacheAs: meta.cachedDisplayName,
                });
            });
            await Promise.all(uploadPromises);
            log.info(`FORCE RESYNC: Finished re-uploading ${validFilesToUpload.length} files.`);

            // 5. Finalize state - fetch the now-consistent state
            const finalFiles = await geminiFileService.listFiles();
            const corpusFiles = new Map<string, GeminiFile>();
            const contextFiles = new Map<string, GeminiFile>();

            finalFiles.forEach(file => {
                if (file.context === 'corpus') {
                    corpusFiles.set(file.cachedDisplayName || file.displayName, file);
                }
                if (['content', 'instrux', 'reference'].includes(file.context || '')) {
                    contextFiles.set(file.displayName, file);
                }
            });

            setState({ status: 'READY', allFiles: finalFiles, corpusFiles, contextFiles, error: null });
            log.info('GeminiCorpusContext: FORCE RESYNC complete.');
        } catch (e: any) {
            log.error('Error during force resync:', e);
            setState(s => ({ ...s, status: 'ERROR', error: e.message }));
        }
    }, []);

    const resetCorpus = useCallback(async () => {
        log.info('GeminiCorpusContext: resetCorpus triggered');
        await geminiCorpusService.purgeAllLocalFiles();
        setState(initialState);
    }, []);

    useEffect(() => {
        const performInitialSync = async () => {
            log.info('GeminiCorpusContext orchestrator: Data and context are ready, triggering initial sync.');
            
            await geminiCorpusService.registerCorpusAssetsLocally(
                dataContext.posts,
                dataContext.deliveryRecords,
                dataContext.openRecords,
                dataContext.subscriberRecords
            );
            await geminiCorpusService.registerContextAssetsLocally(contentContext.contextDocuments);
            
            if (isTestMode && activeTests.has('NAME_CACHE_TEST')) {
                const testFileResponse = await fetch('/src/reg_test/cache_test.txt');
                const testFileContent = await testFileResponse.text();
                const testFile = new File([testFileContent], 'cache_test.txt', { type: 'text/plain' });
                const internalName = buildInternalFileName('cache_test.txt', 'reg-test');
                await geminiFileService.registerLocalFile(internalName, 'cache_test.txt', testFile);
            }
            
            await refreshSyncedFiles();
        };

        if (dataContext.isCorpusReady && contentContext.isContextReady && state.status === 'EMPTY' && (dataContext.posts.length > 0 || contentContext.contextDocuments.length > 0)) {
            performInitialSync();
        }
    }, [
        dataContext.isCorpusReady,
        contentContext.isContextReady,
        state.status,
        dataContext.posts,
        dataContext.deliveryRecords,
        dataContext.openRecords,
        dataContext.subscriberRecords,
        contentContext.contextDocuments,
        isTestMode,
        activeTests,
        refreshSyncedFiles
    ]);
    
    return (
        <GeminiCorpusContext.Provider value={{
            ...state,
            resetCorpus,
            refreshSyncedFiles,
            forceResync,
        }}>
            {children}
        </GeminiCorpusContext.Provider>
    );
};
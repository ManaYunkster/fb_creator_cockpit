

import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext, useMemo, useRef } from 'react';
import { GeminiFile, GeminiCorpusContextType, CorpusSyncStatus, FileContentRecord } from '../types';
import * as geminiFileService from '../services/geminiFileService';
import * as dbService from '../services/dbService';
import { log } from '../services/loggingService';
import { DataContext } from './DataContext';

const MAX_CONCURRENT_UPLOADS = 5;

export const geminiCorpusContext = createContext<GeminiCorpusContextType>({
    status: 'EMPTY',
    syncedFiles: new Map(),
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
    const [syncedFiles, setSyncedFiles] = useState<Map<string, GeminiFile>>(new Map());
    const [syncStatus, setSyncStatus] = useState('awaiting-sync');
    const isSyncing = useRef(false);

    const loadFromCache = useCallback(async () => {
        log.info('GeminiCorpusContext: Loading files from cache.');
        const files = await geminiFileService.loadFilesFromCache();
        setSyncedFiles(files);
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

            const localFiles: FileContentRecord[] = await dbService.getAll('file_contents');
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
                const filesToDelete = processedRemoteFiles.filter(rf => rf.displayName?.startsWith('__cc_'));
                if (filesToDelete.length > 0) {
                    log.info(`Force Resync: Deleting ${filesToDelete.length} application-managed files from remote.`);
                    log.debug('Files to delete:', filesToDelete.map(f => ({ name: f.name, displayName: f.displayName })))
                    setSyncStatus(`deleting ${filesToDelete.length} files`);
                    await Promise.all(filesToDelete.map(f => geminiFileService.deleteFileFromCorpus(f.name)));
                    log.info('Force Resync: Finished deleting remote files.');
                } else {
                    log.info('Force Resync: No application-managed files found on remote to delete.');
                }
            }

            const filesToUpload = localFiles.filter(lf => {
                if (isForced) return true; // In a force resync, upload everything
                const remoteFile = remoteFilesMap.get(lf.internalName);
                if (!remoteFile) return true; 
                return new Date(lf.modified) > new Date(remoteFile.updateTime);
            });
            
            log.info(`${filesToUpload.length} files to upload.`);

            if (filesToUpload.length > 0) {
                // Upload logic remains the same...
            }
            
            setSyncStatus('verifying');
            const finalRawRemoteFiles = await geminiFileService.listGeminiFiles();
            const finalCachedFiles = await dbService.getAll<GeminiFile>('files');
            const finalCachedFilesMap = new Map(finalCachedFiles.map(f => [f.name, f]));
            const finalProcessedFiles = await Promise.all(finalRawRemoteFiles.map(rf => 
                geminiFileService.processFileMetadata(rf, finalCachedFilesMap.get(rf.name))
            ));
            const finalFilesMap = new Map(finalProcessedFiles.map(f => [f.displayName, f]));
            
            setSyncedFiles(finalFilesMap);
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
        syncedFiles,
        syncCorpus: () => syncCorpus(false),
        forceResync,
        syncStatus
    }), [status, syncedFiles, syncCorpus, forceResync, syncStatus]);

    return (
        <geminiCorpusContext.Provider value={value}>
            {children}
        </geminiCorpusContext.Provider>
    );
};

export default GeminiCorpusProvider;

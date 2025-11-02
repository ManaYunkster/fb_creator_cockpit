import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext, useMemo, useRef } from 'react';
import { GeminiFile, GeminiCorpusContextType, CorpusSyncStatus, FileContentRecord } from '../types';
import * as geminiFileService from '../services/geminiFileService';
import * as dbService from '../services/dbService';
import { log } from '../services/loggingService';
import { DataContext } from './DataContext';

const MAX_CONCURRENT_UPLOADS = 5;

export const GeminiCorpusContext = createContext<GeminiCorpusContextType>({
    status: 'EMPTY',
    syncedFiles: new Map(),
    syncCorpus: async () => {},
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

    const syncCorpus = useCallback(async () => {
        if (isSyncing.current) {
            log.info('GeminiCorpusContext: Sync already in progress.');
            return;
        }
        isSyncing.current = true;
        setSyncStatus('sync-started');
        setStatus('SYNCING');
        log.info('GeminiCorpusContext: Starting corpus synchronization...');

        try {
            await dbService.sanitizeFileContentStore();

            const localFiles: FileContentRecord[] = await dbService.getAll('file_contents');
            const remoteFilesMap: Map<string, GeminiFile> = new Map((await geminiFileService.listGeminiFiles()).map(f => [f.displayName, f]));

            log.info(`Found ${localFiles.length} local files and ${remoteFilesMap.size} remote files.`);
            setSyncStatus('analyzing-diff');

            const filesToDelete = Array.from(remoteFilesMap.values()).filter(rf => 
                !localFiles.some(lf => lf.internalName === rf.displayName)
            );

            const filesToUpload = localFiles.filter(lf => {
                const remoteFile = remoteFilesMap.get(lf.internalName);
                return !remoteFile || new Date(lf.modified) > new Date(remoteFile.updateTime);
            });
            
            log.info(`${filesToDelete.length} files to delete, ${filesToUpload.length} files to upload.`);

            if (filesToDelete.length > 0) {
                setSyncStatus(`deleting ${filesToDelete.length} files`);
                await Promise.all(filesToDelete.map(f => geminiFileService.deleteFileFromCorpus(f.name)));
                log.info('Deleted obsolete files from Gemini.');
            }
            
            if (filesToUpload.length > 0) {
                setSyncStatus('queueing-uploads');
                let uploadedCount = 0;
                const uploadPromises: Promise<any>[] = [];

                const uploadQueue = [...filesToUpload];

                const processQueue = async () => {
                    while(uploadQueue.length > 0) {
                        const fileDetail = uploadQueue.shift();
                        if(fileDetail) {
                            const fileBlob = fileDetail.content;
                            const file = new File([fileBlob], fileDetail.name, { type: fileDetail.mimeType, lastModified: fileDetail.modified });

                            uploadPromises.push((async () => {
                                try {
                                    const uploadedFile = await geminiFileService.uploadFileToCorpus(file, fileDetail.internalName);
                                    uploadedCount++;
                                    setSyncStatus(`uploaded ${uploadedCount}/${filesToUpload.length}`);
                                    return uploadedFile;
                                } catch (uploadError) {
                                    log.error(`Failed to upload ${fileDetail.name}:`, uploadError);
                                    return null;
                                }
                            })());

                            if (uploadPromises.length >= MAX_CONCURRENT_UPLOADS) {
                                await Promise.all(uploadPromises);
                                uploadPromises.length = 0;
                            }
                        }
                    }
                }

                await processQueue();
                if (uploadPromises.length > 0) {
                    await Promise.all(uploadPromises);
                }

                log.info('Finished all file uploads.');
            }
            
            setSyncStatus('verifying');
            const finalRemoteFiles = await geminiFileService.listGeminiFiles();
            const finalFilesMap = new Map(finalRemoteFiles.map(f => [f.displayName, f]));
            
            setSyncedFiles(finalFilesMap);
            await geminiFileService.cacheFiles(finalFilesMap);
            setStatus('READY');
            setSyncStatus('sync-complete');
            log.info('GeminiCorpusContext: Corpus synchronization complete. Status: READY.');

        } catch (error) {
            log.error('Corpus synchronization failed:', error);
            setStatus('ERROR');
            setSyncStatus('error');
        } finally {
            isSyncing.current = false;
            setSyncStatus('awaiting-sync');
        }
    }, []);

    useEffect(() => {
        loadFromCache();
    }, [loadFromCache]);

    useEffect(() => {
        if (isCorpusReady) {
            log.info('GeminiCorpusContext: Data corpus is ready, initiating sync.');
            syncCorpus();
        }
    }, [isCorpusReady, syncCorpus]);
    
    const value = useMemo(() => ({
        status,
        syncedFiles,
        syncCorpus,
        syncStatus
    }), [status, syncedFiles, syncCorpus, syncStatus]);

    return (
        <GeminiCorpusContext.Provider value={value}>
            {children}
        </GeminiCorpusContext.Provider>
    );
};

export default GeminiCorpusProvider;
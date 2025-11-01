// FIX: Imported React to resolve namespace errors for React.DragEvent.
import React, { useState, useCallback, useContext } from 'react';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { DataContext } from '../contexts/DataContext';
import { GeminiCorpusContext } from '../contexts/GeminiCorpusContext';
import { ContentContext } from '../contexts/ContentContext';
import * as corpusProcessingService from '../services/corpusProcessingService';
import { log } from '../services/loggingService';
import * as dbService from '../services/dbService';
import { buildInternalFileName } from '../config/file_naming_config';
import * as geminiFileService from '../services/geminiFileService';
import { ContextDocument } from '../types';

interface CorpusProcessorOptions {
  onProcessSuccess?: () => void;
}

export const useCorpusProcessor = (options: CorpusProcessorOptions = {}) => {
    const [filesList, setFilesList] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const { setPosts, resetData, setDeliveryRecords, setOpenRecords, setSubscriberRecords, setIsCorpusReady } = useContext(DataContext);
    const { refreshSyncedFiles } = useContext(GeminiCorpusContext);
    const { loadContext } = useContext(ContentContext);

    const resetState = useCallback(async () => {
        log.info('useCorpusProcessor: resetState triggered');
        setFilesList([]);
        setIsLoading(false);
        setError(null);
        setSuccessMessage(null);
        await resetData();
    }, [resetData]);

    const processZipFile = useCallback(async (file: File) => {
        log.info('useCorpusProcessor: processZipFile triggered for targeted replacement', { file });
        if (!file || !file.type.includes('zip')) {
            setError('Please upload a valid .zip file.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setFilesList([]);
        setSuccessMessage(null);
        await resetData(); // Clear existing processed data from DB (posts, subscribers, context_docs, etc.)

        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            const filePaths = Object.keys(zip.files).filter(name => !zip.files[name].dir);
            
            const newFileContents = new Map<string, string>();
            for (const path of filePaths) {
                const fileData = zip.file(path);
                if (fileData) {
                    try {
                        const content = await fileData.async('text');
                        newFileContents.set(path, content);
                    } catch (err) {
                        log.error(`Could not read file '${path}' as text, skipping.`, err);
                    }
                }
            }
            
            setFilesList(Array.from(newFileContents.keys()));

            // Use the centralized service to process the file contents
            const processedData = corpusProcessingService.processCorpusData(newFileContents);
            
            if (processedData.error) {
                throw new Error(processedData.error);
            }

            setPosts(processedData.posts);
            setDeliveryRecords(processedData.deliveryRecords);
            setOpenRecords(processedData.openRecords);
            setSubscriberRecords(processedData.subscriberRecords);

            // Save new corpus data to IndexedDB
            log.info('useCorpusProcessor: Saving new corpus data to IndexedDB.');
            const fileContentsForDb = Array.from(newFileContents.entries()).map(([path, content]) => ({ path, content }));
            await Promise.all([
                dbService.bulkPut('posts', processedData.posts),
                dbService.bulkPut('subscribers', processedData.subscriberRecords),
                dbService.bulkPut('opens', processedData.openRecords),
                dbService.bulkPut('deliveries', processedData.deliveryRecords),
                dbService.bulkPut('corpus_files', fileContentsForDb)
            ]);
            
            // Register generated corpus files in the DB so they can be synced
            const csvOptions = { quotes: true, header: true };
            const corpusAssetsToRegister = [
                { name: 'all_posts.json', content: JSON.stringify(processedData.posts.map(p => ({...p, html_content: newFileContents.get(`posts/${p.post_id}.html`) || ''})), null, 2), type: 'application/json', purpose: 'corpus-posts' },
                { name: 'all_subscribers.json', content: JSON.stringify(processedData.subscriberRecords, null, 2), type: 'application/json', purpose: 'corpus-subscribers' },
                { name: 'all_opens.json', content: JSON.stringify(processedData.openRecords, null, 2), type: 'application/json', purpose: 'corpus-opens' },
                { name: 'all_delivers.json', content: JSON.stringify(processedData.deliveryRecords, null, 2), type: 'application/json', purpose: 'corpus-delivers' },
                { name: 'all_posts_metadata.csv', content: Papa.unparse(processedData.posts, csvOptions), type: 'text/csv', purpose: 'corpus-posts' },
            ];
            
            const newCorpusAssetNames = new Set<string>();
            for (const asset of corpusAssetsToRegister) {
                const internalName = buildInternalFileName(asset.name, asset.purpose);
                newCorpusAssetNames.add(internalName);
                const assetFile = new File([asset.content], asset.name, { type: asset.type });
                await geminiFileService.registerLocalFile(internalName, asset.name, assetFile);
            }
            log.info(`useCorpusProcessor: Registered ${corpusAssetsToRegister.length} generated corpus assets in the local DB for future sync.`);
            
            // Re-load context documents into memory. Since they weren't cleared from the DB, this will be fast.
            await loadContext();
            
            // --- Targeted remote file replacement for CORPUS assets only ---
            log.info('useCorpusProcessor: Starting targeted remote file replacement for corpus assets...');
            
            const namesToDelete = newCorpusAssetNames;
            log.info('useCorpusProcessor: Identifying remote corpus files for deletion.', { namesToDelete });
            
            const remoteFiles = await geminiFileService.listFilesFromApi();
            const filesToDelete = remoteFiles.filter(remoteFile => namesToDelete.has(remoteFile.displayName));
            
            if (filesToDelete.length > 0) {
                log.info(`useCorpusProcessor: Found ${filesToDelete.length} remote corpus files to delete.`);
                const deletionPromises = filesToDelete.map(file => geminiFileService.deleteFileFromApiOnly(file.name));
                await Promise.all(deletionPromises);
                log.info('useCorpusProcessor: Remote corpus deletion complete.');
            } else {
                log.info('useCorpusProcessor: No matching remote corpus files found for deletion.');
            }

            // Trigger a sync which will upload the newly registered local files
            await refreshSyncedFiles();

            setIsCorpusReady(true);
            setSuccessMessage(`Corpus processed: ${processedData.posts.length} posts and ${newFileContents.size} total files loaded! Sync initiated.`);
            options.onProcessSuccess?.();

        } catch (e: any) {
            log.error('Error processing zip file', e);
            setError(e.message || 'Failed to process the zip file. It may be corrupted.');
            await resetData();
        } finally {
            setIsLoading(false);
        }
    }, [resetData, setPosts, setDeliveryRecords, setOpenRecords, setSubscriberRecords, setIsCorpusReady, options.onProcessSuccess, loadContext, refreshSyncedFiles]);

    const dragHandlers = {
      onDrop: (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
      },
      onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
      },
      onDragEnter: (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
      },
      onDragLeave: (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
      },
    };
    
    return { processZipFile, isLoading, error, successMessage, filesList, isDragging, resetState, dragHandlers };
};
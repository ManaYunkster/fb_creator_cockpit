import React, { createContext, useState, ReactNode, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { Post, DeliveryRecord, OpenRecord, SubscriberRecord, DataContextType } from '../types';
import * as corpusProcessingService from '../services/corpusProcessingService';
import { log } from '../services/loggingService';
import * as dbService from '../services/dbService';

export const DataContext = createContext<DataContextType>({
    posts: [],
    deliveryRecords: [],
    openRecords: [],
    subscriberRecords: [],
    setPosts: () => {},
    setDeliveryRecords: () => {},
    setOpenRecords: () => {},
    setSubscriberRecords: () => {},
    resetData: async () => {},
    isLoadingCorpus: true,
    isCorpusReady: false,
    setIsCorpusReady: () => {},
    loadCorpus: async () => {},
});

interface DataProviderProps {
    children: ReactNode;
}

const PRELOADED_FILES: { path: string, key: string }[] = [
    { path: '/src/content_corpus/posts.csv', key: 'posts.csv' },
    { path: '/src/content_corpus/subscribers/email_list.ericduell.csv', key: 'subscribers/email_list.ericduell.csv' },
    { path: '/src/content_corpus/posts/delivers/191238962.delivers.csv', key: 'posts/delivers/191238962.delivers.csv' },
    { path: '/src/content_corpus/posts/opens/191238962.opens.csv', key: 'posts/opens/191238962.opens.csv' },
    { path: '/src/content_corpus/posts/191238962.building-in-public-the-creator-cockpit.html', key: 'posts/191238962.building-in-public-the-creator-cockpit.html' },
    { path: '/src/content_corpus/posts/191285273.a-new-way-to-write-hooks.html', key: 'posts/191285273.a-new-way-to-write-hooks.html' },
];


export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [deliveryRecords, setDeliveryRecords] = useState<DeliveryRecord[]>([]);
    const [openRecords, setOpenRecords] = useState<OpenRecord[]>([]);
    const [subscriberRecords, setSubscriberRecords] = useState<SubscriberRecord[]>([]);
    const [isLoadingCorpus, setIsLoadingCorpus] = useState(true);
    const [isCorpusReady, setIsCorpusReady] = useState(false);

    const loadCorpus = useCallback(async () => {
        setIsLoadingCorpus(true);
        setIsCorpusReady(false);
        try {
            // 1. Try to load from IndexedDB
            const dbPosts = await dbService.getAll<Post>('posts');
            
            if (dbPosts && dbPosts.length > 0) {
                log.info('DataContext: Loading corpus from IndexedDB.');
                const [dbSubscribers, dbOpens, dbDeliveries] = await Promise.all([
                    dbService.getAll<SubscriberRecord>('subscribers'),
                    dbService.getAll<OpenRecord>('opens'),
                    dbService.getAll<DeliveryRecord>('deliveries'),
                ]);

                setPosts(dbPosts);
                setSubscriberRecords(dbSubscribers);
                setOpenRecords(dbOpens);
                setDeliveryRecords(dbDeliveries);
                
                log.info('DataContext: Pre-loaded corpus from IndexedDB processed successfully.');

            } else {
                log.info('DataContext: IndexedDB is empty. Falling back to fetch pre-loaded files.');
                let newFileContents = new Map<string, string>();
                
                // --- Attempt 1: Load from ZIP in /src/corpus_stage/ ---
                const zipResponse = await fetch('/src/corpus_stage/corpus.zip');
                if (zipResponse.ok) {
                    log.info('DataContext: Found pre-loaded zip in /src/corpus_stage/. Processing...');
                    const arrayBuffer = await zipResponse.arrayBuffer();
                    const zip = await JSZip.loadAsync(arrayBuffer);
                    const filePaths = Object.keys(zip.files).filter(name => !zip.files[name].dir);
                    
                    for (const path of filePaths) {
                        const fileData = zip.file(path);
                        if (fileData) {
                            try {
                                const content = await fileData.async('text');
                                newFileContents.set(path, content);
                            } catch (err) {
                                log.error(`Could not read file '${path}' as text from zip, skipping.`, err);
                            }
                        }
                    }
                } else {
                    log.info('DataContext: Pre-loaded zip not found at /src/corpus_stage/corpus.zip. Attempting fallback to individual files.');
                    
                    // --- Attempt 2: Fallback to individual files ---
                    for (const file of PRELOADED_FILES) {
                        const response = await fetch(file.path);
                        if (!response.ok) throw new Error(`Failed to fetch preloaded file: ${file.path}`);
                        const content = await response.text();
                        newFileContents.set(file.key, content);
                    }
                }

                const processedData = corpusProcessingService.processCorpusData(newFileContents);
                if(processedData.error) throw new Error(processedData.error);
                
                setPosts(processedData.posts);
                setDeliveryRecords(processedData.deliveryRecords);
                setOpenRecords(processedData.openRecords);
                setSubscriberRecords(processedData.subscriberRecords);
                
                log.info('DataContext: Saving fetched corpus to IndexedDB for next session.');
                const fileContentsForDb = Array.from(newFileContents.entries()).map(([path, content]) => ({ path, content }));
                await Promise.all([
                    dbService.bulkPut('posts', processedData.posts),
                    dbService.bulkPut('subscribers', processedData.subscriberRecords),
                    dbService.bulkPut('opens', processedData.openRecords),
                    dbService.bulkPut('deliveries', processedData.deliveryRecords),
                    dbService.bulkPut('corpus_files', fileContentsForDb)
                ]);
                log.info('DataContext: Pre-loaded corpus from files processed and saved to DB successfully.');
            }

        } catch (error) {
            log.error("Could not pre-load development corpus from any source:", error);
        } finally {
            setIsLoadingCorpus(false);
            setIsCorpusReady(true);
        }
    }, []);

    useEffect(() => {
        loadCorpus();
    }, [loadCorpus]);

    const resetData = useCallback(async () => {
        setPosts([]);
        setDeliveryRecords([]);
        setOpenRecords([]);
        setSubscriberRecords([]);
        setIsLoadingCorpus(false); 
        setIsCorpusReady(false);
        try {
            log.info('DataContext: Clearing all corpus stores from IndexedDB.');
            await Promise.all([
                dbService.clearStore('posts'),
                dbService.clearStore('subscribers'),
                dbService.clearStore('opens'),
                dbService.clearStore('deliveries'),
                dbService.clearStore('corpus_files'),
                // FIX: Context documents are part of the app's static assets and should not be cleared when the user's corpus data is reset.
                // dbService.clearStore('context_documents'),
            ]);
        } catch(e) {
            log.error('DataContext: Failed to clear IndexedDB stores on reset.', e);
        }
    }, []);

    return (
        <DataContext.Provider value={{
            posts, setPosts,
            deliveryRecords, setDeliveryRecords,
            openRecords, setOpenRecords,
            subscriberRecords, setSubscriberRecords,
            resetData,
            isLoadingCorpus,
            isCorpusReady,
            setIsCorpusReady,
            loadCorpus
        }}>
            {children}
        </DataContext.Provider>
    );
};

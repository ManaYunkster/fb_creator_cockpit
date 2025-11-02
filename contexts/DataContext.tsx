import React, { createContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import { Post, DeliveryRecord, OpenRecord, SubscriberRecord, DataContextType } from '../types';
import * as corpusProcessingService from '../services/corpusProcessingService';
import { log } from '../services/loggingService';
import * as dbService from '../services/dbService';
import { APP_CONFIG } from '../config/app_config';

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
        let corpusLoadedSuccessfully = false;

        try {
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
                corpusLoadedSuccessfully = true;
            } else {
                log.info('DataContext: IndexedDB is empty. Loading from preloaded assets.');
                const assetsToLoad = APP_CONFIG.PRELOADED_ASSETS.filter(a => a.loader === 'DataContext' && a.loadOnStartup);
                const fileContents = new Map<string, string>();
                let zipLoaded = false;

                const zipAsset = assetsToLoad.find(a => a.type === 'zip');
                if (zipAsset) {
                    try {
                        const response = await fetch(zipAsset.path);
                        if (response.ok && response.headers.get('Content-Type')?.includes('application/zip')) {
                            log.info(`DataContext: Loading corpus from zip file: ${zipAsset.path}`);
                            const arrayBuffer = await response.arrayBuffer();
                            const zip = await JSZip.loadAsync(arrayBuffer);
                            const filePaths = Object.keys(zip.files).filter(name => !zip.files[name].dir);
                            for (const path of filePaths) {
                                const fileData = zip.file(path);
                                if (fileData) {
                                    const content = await fileData.async('text');
                                    fileContents.set(path, content);
                                }
                            }
                            zipLoaded = true;
                        } else {
                            if (zipAsset.required) {
                                throw new Error(`Required zip file not found or is not a valid zip file: ${zipAsset.path}`);
                            }
                            log.info(`DataContext: Optional zip file not found at ${zipAsset.path}, skipping.`);
                        }
                    } catch (error) {
                        if (zipAsset.required) throw error;
                        log.error(`DataContext: Failed to process zip file: ${zipAsset.path}`, error);
                    }
                }

                if (!zipLoaded) {
                    const otherAssets = assetsToLoad.filter(a => a.type !== 'zip');
                    for (const asset of otherAssets) {
                        try {
                            const response = await fetch(asset.path);
                            if (response.ok) {
                                const content = await response.text();
                                fileContents.set(asset.key, content);
                            } else if (asset.required) {
                                throw new Error(`Required asset not found at: ${asset.path}`);
                            }
                        } catch (error) {
                            if (asset.required) throw error;
                            log.info(`DataContext: Optional asset not found or failed to load: ${asset.path}`);
                        }
                    }
                }

                if (fileContents.size > 0) {
                    const processedData = await corpusProcessingService.processCorpusData(fileContents);
                    if (processedData.error) throw new Error(processedData.error);
                    
                    setPosts(processedData.posts);
                    setDeliveryRecords(processedData.deliveryRecords);
                    setOpenRecords(processedData.openRecords);
                    setSubscriberRecords(processedData.subscriberRecords);
                    
                    await Promise.all([
                        dbService.bulkPut('posts', processedData.posts),
                        dbService.bulkPut('subscribers', processedData.subscriberRecords),
                        dbService.bulkPut('opens', processedData.openRecords),
                        dbService.bulkPut('deliveries', processedData.deliveryRecords),
                    ]);
                    corpusLoadedSuccessfully = true;
                }
            }

            if (corpusLoadedSuccessfully) {
                setIsCorpusReady(true);
                log.info('DataContext: Corpus loaded successfully.');
            } else {
                log.info('DataContext: No corpus data loaded (this may be expected).');
                setIsCorpusReady(true);
            }

        } catch (error) {
            log.error("Could not pre-load development corpus from any source:", error);
        } finally {
            setIsLoadingCorpus(false);
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
                dbService.clearStore('file_contents'),
            ]);
        } catch(e) {
            log.error('DataContext: Failed to clear IndexedDB stores on reset.', e);
        }
    }, []);
    
    const value = useMemo(() => ({
        posts, setPosts,
        deliveryRecords, setDeliveryRecords,
        openRecords, setOpenRecords,
        subscriberRecords, setSubscriberRecords,
        resetData,
        isLoadingCorpus,
        isCorpusReady,
        setIsCorpusReady,
        loadCorpus
    }), [posts, deliveryRecords, openRecords, subscriberRecords, resetData, isLoadingCorpus, isCorpusReady, loadCorpus]);

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

export default DataProvider;

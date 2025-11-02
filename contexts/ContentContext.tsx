// Note: The Vite-specific `import.meta.glob` was removed for compatibility.
// We are now manually fetching a known list of context documents.
// /// <reference types="vite/client" />

import React, { createContext, useState, useEffect, ReactNode, useMemo, useContext, useRef, useCallback } from 'react';
import { Type } from '@google/genai';
import { ContextDocument, ContentContextType, GeminiFile, PreloadedAsset } from '../types';
import { AI_PROMPTS, initPrompts } from '../services/promptService';
import { log } from '../services/loggingService';
import * as geminiFileService from '../services/geminiFileService';
import { APP_CONFIG } from '../config/app_config';
import { parseInternalFileName, getProfileFromId } from '../config/file_naming_config';
import { GeminiCorpusContext } from './GeminiCorpusContext';
import * as dbService from '../services/dbService';

export const ContentContext = createContext<ContentContextType>({
    contextDocuments: [],
    isLoading: true,
    isContextReady: false,
    loadContext: async () => {},
    addContextDocument: async () => {},
    removeContextDocument: async () => {},
});

export const ContentProvider = ({ children }: { children: ReactNode }) => {
    const [contextDocuments, setContextDocuments] = useState<ContextDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isContextReady, setIsContextReady] = useState(false);
    const { contextFiles, status: geminiStatus } = useContext(GeminiCorpusContext);
    const rawDocsRef = useRef<ContextDocument[]>([]);

    const loadContext = useCallback(async () => {
        log.info('ContentContext: Starting document load process...');
        setIsLoading(true);
        setIsContextReady(false);
        let contextLoadedSuccessfully = false;

        try {
            await initPrompts();
            
            const cachedDocs = await dbService.getAll<ContextDocument>('context_documents');
            if (cachedDocs && cachedDocs.length > 0) {
                log.info('ContentContext: Loading context documents from IndexedDB cache.');
                rawDocsRef.current = cachedDocs;
                setContextDocuments(cachedDocs);
                contextLoadedSuccessfully = true;
            } else {
                log.info('ContentContext: No cached context documents found. Fetching from network and classifying.');
                
                const assetsToLoad = APP_CONFIG.PRELOADED_ASSETS.filter(a => a.loader === 'ContentContext' && a.loadOnStartup);
                const modelConfigString = window.localStorage.getItem('modelConfig');
                const modelConfig = modelConfigString ? { ...APP_CONFIG.DEFAULT_MODEL_CONFIG, ...JSON.parse(modelConfigString) } : APP_CONFIG.DEFAULT_MODEL_CONFIG;
                const classificationSystemInstruction = AI_PROMPTS.CONTEXT_CLASSIFICATION.SYSTEM_INSTRUCTION;

                const classificationPromises = assetsToLoad.map(async (asset: PreloadedAsset) => {
                    const id = asset.path.split('/').pop() || asset.key;
                    const profile = getProfileFromId(id);
                    let content = '';

                    try {
                        const response = await fetch(asset.path);
                        if (!response.ok) {
                            if (asset.required) {
                                throw new Error(`Required asset not found at: ${asset.path}`);
                            }
                            log.info(`ContentContext: Optional asset not found, skipping: ${asset.path}`);
                            return null;
                        }
                        content = await response.text();
                        
                        const originalName = parseInternalFileName(id)?.originalName || id;
                        const file = new File([content], originalName, { type: 'text/markdown' });
                        await geminiFileService.registerLocalFile(id, originalName, file);

                        const classificationResponse = await geminiFileService.generateContent({
                          model: 'gemini-2.5-flash',
                          contents: content,
                          config: {
                             systemInstruction: classificationSystemInstruction,
                             responseMimeType: 'application/json',
                             responseSchema: {
                                type: Type.OBJECT,
                                properties: {
                                  classification: { type: Type.STRING },
                                  summary: { type: Type.STRING },
                                },
                              },
                              safetySettings: modelConfig.safetySettings,
                           },
                        });
                        
                        if (!classificationResponse?.text) {
                            throw new Error(`AI classification for ${id} returned an empty response.`);
                        }
                        const jsonStr = classificationResponse.text.trim();
                        const result = JSON.parse(jsonStr);

                        return { id, content, classification: result.classification || 'General', summary: result.summary || 'No summary available.', profile };
                    } catch (classificationError) {
                         log.error(`Failed to fetch or classify document: ${id}`, classificationError);
                         if (asset.required) throw classificationError;
                         return null;
                    }
                });
                
                const results = await Promise.all(classificationPromises);
                const classifiedDocs = results.filter((doc): doc is ContextDocument => doc !== null);

                if (classifiedDocs.length > 0) {
                    await dbService.bulkPut('context_documents', classifiedDocs);
                    log.info('ContentContext: Saved classified documents to IndexedDB.');
                    rawDocsRef.current = classifiedDocs;
                    setContextDocuments(classifiedDocs);
                }
                contextLoadedSuccessfully = true;
            }

            if (contextLoadedSuccessfully) {
                setIsContextReady(true);
                log.info('ContentContext: Context loaded successfully.');
            }
        } catch (error) {
            log.error("Failed to load or process context documents:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    const addContextDocument = useCallback(async (file: File, internalName: string) => {
        try {
            await initPrompts();
            
            const content = await file.text();
            const profile = getProfileFromId(internalName);
            log.info(`ContentContext: Classifying and adding new document "${internalName}"`);
            
            const modelConfigString = window.localStorage.getItem('modelConfig');
            const modelConfig = modelConfigString ? { ...APP_CONFIG.DEFAULT_MODEL_CONFIG, ...JSON.parse(modelConfigString) } : APP_CONFIG.DEFAULT_MODEL_CONFIG;
            const classificationSystemInstruction = AI_PROMPTS.CONTEXT_CLASSIFICATION.SYSTEM_INSTRUCTION;

            const classificationResponse = await geminiFileService.generateContent({
              model: 'gemini-2.5-flash',
              contents: content,
              config: {
                 systemInstruction: classificationSystemInstruction,
                 responseMimeType: 'application/json',
                 responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      classification: { type: Type.STRING },
                      summary: { type: Type.STRING },
                    },
                  },
                  safetySettings: modelConfig.safetySettings,
               },
            });
            
            if (!classificationResponse?.text) {
                throw new Error(`AI classification for ${internalName} returned an empty response.`);
            }
            const jsonStr = classificationResponse.text.trim();
            const result = JSON.parse(jsonStr);

            const newDoc: ContextDocument = {
                id: internalName,
                content,
                classification: result.classification || 'General',
                summary: result.summary || 'No summary available.',
                profile,
            };

            await dbService.put('context_documents', newDoc);
            setContextDocuments(prev => [...prev.filter(d => d.id !== internalName), newDoc]);
            log.info(`ContentContext: Successfully added new context document "${internalName}"`);
        } catch (e) {
            log.error(`ContentContext: Failed to add new context document "${internalName}"`, e);
        }
    }, []);

    const removeContextDocument = useCallback(async (internalName: string) => {
        try {
            await dbService.del('context_documents', internalName);
            setContextDocuments(prev => prev.filter(d => d.id !== internalName));
            log.info(`ContentContext: Removed context document "${internalName}"`);
        } catch (e) {
            log.error(`ContentContext: Failed to remove context document "${internalName}"`, e);
        }
    }, []);

    useEffect(() => {
        loadContext();
    }, [loadContext]);

    useEffect(() => {
        if (geminiStatus === 'READY') {
            log.info('ContentContext: Gemini corpus is READY. Filtering documents against synced files.');
            const syncedFileDisplayNames = new Set([...contextFiles.values()].map(f => f.displayName));
            const finalDocs = rawDocsRef.current.filter(doc => syncedFileDisplayNames.has(doc.id));
            
            if (rawDocsRef.current.length !== finalDocs.length) {
                log.info(`ContentContext: Filtering complete. Kept ${finalDocs.length} of ${rawDocsRef.current.length} documents.`);
            }
            
            setContextDocuments(finalDocs);
        } else if (geminiStatus === 'ERROR') {
            setContextDocuments([]);
        }
    }, [geminiStatus, contextFiles]);

    const value = useMemo(() => ({
        contextDocuments,
        isLoading,
        isContextReady,
        loadContext,
        addContextDocument,
        removeContextDocument,
    }), [contextDocuments, isLoading, isContextReady, loadContext, addContextDocument, removeContextDocument]);

    return (
        <ContentContext.Provider value={value}>
            {children}
        </ContentContext.Provider>
    );
}
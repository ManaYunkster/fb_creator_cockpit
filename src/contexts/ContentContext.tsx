// Note: The Vite-specific `import.meta.glob` was removed for compatibility.
// We are now manually fetching a known list of context documents.
// /// <reference types="vite/client" />

import React, { createContext, useState, useEffect, ReactNode, useMemo, useContext, useRef, useCallback } from 'react';
import { Type } from '@google/genai';
import { ContextDocument, ContentContextType, PreloadedAsset, GeminiFile } from '../types';
import { AI_PROMPTS, initPrompts } from '../services/promptService';
import { log } from '../services/loggingService';
import * as geminiFileService from '../services/geminiFileService';
import { APP_CONFIG } from '../config/app_config';
import { parseInternalFileName, getProfileFromId } from '../config/file_naming_config';
import * as dbService from '../services/dbService';

export const ContentContext = createContext<ContentContextType>({
    contextDocuments: [],
    isLoading: true,
    isContextReady: false,
    loadContext: async () => {},
    addContextDocument: async () => {},
    removeContextDocument: async () => {},
});

interface ContentProviderProps {
    children: ReactNode;
}

export const ContentProvider: React.FC<ContentProviderProps> = ({ children }) => {
    const [contextDocuments, setContextDocuments] = useState<ContextDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isContextReady, setIsContextReady] = useState(false);

    const loadContext = useCallback(async () => {
        log.info('ContentContext: Starting document load process...');
        setIsLoading(true);
        setIsContextReady(false);

        try {
            await initPrompts();
            
            let docs = await dbService.getAll<ContextDocument>('permanent_documents');
            
            if (docs.length > 0) {
                log.info(`ContentContext: Loading ${docs.length} permanent documents from IndexedDB.`);
            } else {
                log.info('ContentContext: No permanent documents found in DB. Seeding from initial assets...');
                
                const assetsToSeed = APP_CONFIG.PRELOADED_ASSETS.filter(a => a.loader === 'ContentContext' && a.loadOnStartup);
                if (assetsToSeed.length > 0) {
                    const modelConfigString = window.localStorage.getItem('modelConfig');
                    const modelConfig = modelConfigString ? { ...APP_CONFIG.DEFAULT_MODEL_CONFIG, ...JSON.parse(modelConfigString) } : APP_CONFIG.DEFAULT_MODEL_CONFIG;
                    const classificationSystemInstruction = AI_PROMPTS.CONTEXT_CLASSIFICATION.SYSTEM_INSTRUCTION;

                    const classificationPromises = assetsToSeed.map(async (asset: PreloadedAsset) => {
                        const id = asset.path.split('/').pop() || asset.key;
                        const profile = getProfileFromId(id);
                        
                        try {
                            const response = await fetch(asset.path);
                            if (!response.ok) {
                                if (asset.required) throw new Error(`Required asset not found: ${asset.path}`);
                                log.info(`Optional asset not found, skipping: ${asset.path}`);
                                return null;
                            }
                            const content = await response.text();
                            if (!content.trim()) {
                                log.info(`Asset content for ${asset.path} is empty, skipping.`);
                                return null;
                            }

                            const classificationResponse = await geminiFileService.generateContent({
                                model: modelConfig.model,
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
                            const result = JSON.parse(classificationResponse.text.trim());

                            return { id, content, classification: result.classification || 'General', summary: result.summary || 'No summary available.', profile };
                        } catch (error) {
                            log.error(`Failed to fetch or classify seed document: ${id}`, error);
                            if (asset.required) throw error;
                            return null;
                        }
                    });
                    
                    const seededDocs = await Promise.all(classificationPromises);
                    const validDocs = seededDocs.filter((doc): doc is ContextDocument => doc !== null);

                    if (validDocs.length > 0) {
                        await dbService.bulkPut('permanent_documents', validDocs);
                        log.info(`ContentContext: Saved ${validDocs.length} seeded documents to the 'permanent_documents' store.`);
                        docs = validDocs;
                    }
                }
            }
            
            if (docs.length > 0) {
                setContextDocuments(docs);

                const existingFiles = await dbService.getAll<GeminiFile>('files');
                const existingFileDisplayNames = new Set(existingFiles.map(f => f.displayName));

                log.info('ContentContext: Verifying and registering permanent documents...');
                for (const doc of docs) {
                    if (existingFileDisplayNames.has(doc.id)) {
                        log.info(`- "${doc.id}" already exists. Skipping registration.`);
                        continue;
                    }
                    
                    log.info(`- Registering new permanent document: "${doc.id}"`);
                    const originalName = parseInternalFileName(doc.id)?.originalName || doc.id;
                    const file = new File([doc.content], originalName, { type: 'text/markdown' });
                    await geminiFileService.registerLocalFile(doc.id, originalName, file, true);
                }
            }

            setIsContextReady(true);
            log.info('ContentContext: Context is ready.');

        } catch (error) {
            log.error("A critical error occurred in ContentContext during load and seed:", error);
            setContextDocuments([]);
            setIsContextReady(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadContext();
    }, [loadContext]);

    const addContextDocument = useCallback(async (file: File, internalName: string) => {
        // This function will be implemented later to add new permanent documents
    }, []);

    const removeContextDocument = useCallback(async (internalName: string) => {
        // This function will be implemented later to remove permanent documents
    }, []);

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
};

export default ContentProvider;

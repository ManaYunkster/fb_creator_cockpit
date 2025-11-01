// Note: The Vite-specific `import.meta.glob` was removed for compatibility.
// We are now manually fetching a known list of context documents.
// /// <reference types="vite/client" />

import React, { createContext, useState, useEffect, ReactNode, useMemo, useContext, useRef, useCallback } from 'react';
import { Type } from '@google/genai';
import { ContextDocument, ContentContextType, GeminiFile } from '../types';
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

const CONTEXT_DOCUMENT_PATHS = [
    '/src/context_documents/__cc_content_global__brand-brief.md',
    '/src/context_documents/__cc_content_global__author-bio.md',
    '/src/context_documents/__cc_content_global__author-origin-story.md',
    '/src/context_documents/__cc_instrux_spa__instructions.md',
    '/src/context_documents/__cc_reference_spa__writing-hooks.md',
];

export const ContentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [contextDocuments, setContextDocuments] = useState<ContextDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isContextReady, setIsContextReady] = useState(false);
    const { contextFiles, status: geminiStatus } = useContext(GeminiCorpusContext);

    // Store the raw loaded docs in a ref to have a persistent, unfiltered list.
    const rawDocsRef = useRef<ContextDocument[]>([]);

    const loadContext = useCallback(async () => {
        log.info('ContentContext: Starting document load process...');
        setIsLoading(true);
        setIsContextReady(false);
        
        try {
            // FIX: Ensure prompts are loaded before attempting to use them for classification.
            await initPrompts();
            
            // 1. Try to load from cache
            const cachedDocs = await dbService.getAll<ContextDocument>('context_documents');
            if (cachedDocs && cachedDocs.length > 0) {
                log.info('ContentContext: Loading context documents from IndexedDB cache.');
                rawDocsRef.current = cachedDocs;
                setContextDocuments(cachedDocs);
            } else {
                log.info('ContentContext: No cached context documents found. Fetching from network and classifying.');
                
                const modelConfigString = window.localStorage.getItem('modelConfig');
                const modelConfig = modelConfigString ? { ...APP_CONFIG.DEFAULT_MODEL_CONFIG, ...JSON.parse(modelConfigString) } : APP_CONFIG.DEFAULT_MODEL_CONFIG;
                const safetySettings = modelConfig.safetySettings;
                // FIX: Changed from getSystemInstruction() to direct property access.
                const classificationSystemInstruction = AI_PROMPTS.CONTEXT_CLASSIFICATION.SYSTEM_INSTRUCTION;

                const classificationPromises = CONTEXT_DOCUMENT_PATHS.map(async (path) => {
                    const id = path.split('/').pop() || 'unknown-file';
                    const profile = getProfileFromId(id);
                    
                    log.info(`ContentContext: Fetching and classifying document "${id}" with profile "${profile}"`);

                    let content = '';
                    try {
                        const response = await fetch(path);
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
                              safetySettings,
                           },
                        });
                        
                        const jsonStr = classificationResponse.text.trim();
                        const result = JSON.parse(jsonStr);

                        return { id, content, classification: result.classification || 'General', summary: result.summary || 'No summary available.', profile };
                    } catch (classificationError) {
                         log.error(`Failed to fetch or classify document: ${id}`, classificationError);
                         return { id, content: content || `Failed to load content for ${id}.`, classification: 'Unclassified', summary: 'AI classification failed for this document.', profile };
                    }
                });
                
                const classifiedDocs = await Promise.all(classificationPromises);
                
                await dbService.bulkPut('context_documents', classifiedDocs);
                log.info('ContentContext: Saved classified documents to IndexedDB.');

                rawDocsRef.current = classifiedDocs;
                setContextDocuments(classifiedDocs);
            }
        } catch (error) {
            log.error("Failed to load or process context documents:", error);
        } finally {
            setIsLoading(false);
            setIsContextReady(true);
        }
    }, []);
    
    const addContextDocument = useCallback(async (file: File, internalName: string) => {
        try {
            // FIX: Ensure prompts are loaded before attempting to use them for classification.
            await initPrompts();
            
            const content = await file.text();
            const profile = getProfileFromId(internalName);

            log.info(`ContentContext: Classifying and adding new document "${internalName}"`);
            
            const modelConfigString = window.localStorage.getItem('modelConfig');
            const modelConfig = modelConfigString ? { ...APP_CONFIG.DEFAULT_MODEL_CONFIG, ...JSON.parse(modelConfigString) } : APP_CONFIG.DEFAULT_MODEL_CONFIG;
            // FIX: Changed from getSystemInstruction() to direct property access.
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

    // Effect 1: Load and classify local documents ONCE on mount.
    useEffect(() => {
        loadContext();
    }, [loadContext]);

    // Effect 2: React to the Gemini sync status to filter the displayed documents.
    useEffect(() => {
        if (geminiStatus === 'READY') {
            log.info('ContentContext: Gemini corpus is READY. Filtering documents against synced files.');
            // FIX: Explicitly typed 'f' as GeminiFile to resolve type inference issues.
            const syncedFileDisplayNames = new Set(Array.from(contextFiles.values()).map((f: GeminiFile) => f.displayName));
            const finalDocs = rawDocsRef.current.filter(doc => syncedFileDisplayNames.has(doc.id));
            
            if (rawDocsRef.current.length !== finalDocs.length) {
                log.info(`ContentContext: Filtering complete. Kept ${finalDocs.length} of ${rawDocsRef.current.length} documents.`);
            }
            
            setContextDocuments(finalDocs);
        } else if (geminiStatus === 'ERROR') {
            setContextDocuments([]);
        }
        // When status is 'EMPTY' or 'SYNCING', we do nothing here, preserving the initial full list.
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
};

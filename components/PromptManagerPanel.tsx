
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { SYSTEM_INSTRUCTIONS, USER_PROMPT_TEMPLATES } from '../config/prompts_config';
import { ContentContext } from '../contexts/ContentContext';
import { PromptTemplate } from '../types';
import ConfirmationModal from './ConfirmationModal';
import * as dbService from '../services/dbService';
import { log } from '../services/loggingService';
import { initPrompts, getPromptContent } from '../services/promptService';

interface PromptManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const PromptManagerPanel: React.FC<PromptManagerPanelProps> = ({ isOpen, onClose }) => {
    // STATE
    const [activeTab, setActiveTab] = useState<'prompts' | 'documents'>('prompts');
    const [copyButtonText, setCopyButtonText] = useState('Copy');
    const [isPurgeConfirmModalOpen, setIsPurgeConfirmModalOpen] = useState(false);
    const [promptsInitialized, setPromptsInitialized] = useState(false);

    // PROMPTS STATE & DATA
    const promptList = useMemo(() => [
        ...Object.values(SYSTEM_INSTRUCTIONS),
        ...Object.values(USER_PROMPT_TEMPLATES)
    ] as PromptTemplate[], []);
    const [selectedPromptId, setSelectedPromptId] = useState<string>(promptList[0]?.id || '');
    const selectedPrompt = useMemo(() => promptList.find(p => p.id === selectedPromptId), [selectedPromptId, promptList]);

    // DOCUMENTS STATE & DATA
    const { contextDocuments, isLoading: isLoadingContext } = useContext(ContentContext);
    const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
    const selectedDocument = useMemo(() => contextDocuments.find(d => d.id === selectedDocumentId), [selectedDocumentId, contextDocuments]);

    // EFFECTS
    useEffect(() => {
        // Set initial document selection when context is loaded
        if (!selectedDocumentId && contextDocuments.length > 0) {
            setSelectedDocumentId(contextDocuments[0].id);
        }
    }, [contextDocuments, selectedDocumentId]);
    
    useEffect(() => {
        if (isOpen && !promptsInitialized) {
            initPrompts().then(() => {
                setPromptsInitialized(true);
                log.info('Prompt Inspector: Prompt service initialized.');
            });
        }
    }, [isOpen, promptsInitialized]);

    if (!isOpen) return null;

    // HANDLERS
    const handleCopy = () => {
        let contentToCopy = '';
        if (activeTab === 'prompts' && selectedPrompt && promptsInitialized) {
            contentToCopy = getPromptContent(selectedPrompt.id);
        } else if (activeTab === 'documents' && selectedDocument) {
            contentToCopy = selectedDocument.content;
        }

        if (contentToCopy) {
            navigator.clipboard.writeText(contentToCopy);
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy'), 2000);
        }
    };
    
    const handleConfirmPurge = async () => {
        log.info('PromptManagerPanel: Purge confirmed. Deleting entire database.');
        setIsPurgeConfirmModalOpen(false);
        try {
            await dbService.purgeDatabase();
            // Force a full reload to reset all application state
            window.location.reload();
        } catch (error) {
            log.error('Failed to purge database', error);
            // You might want to show an error message to the user here
        }
    };

    // RENDER HELPERS
    const PromptTypeLabel: React.FC<{ type: 'SYSTEM_INSTRUCTION' | 'USER_PROMPT' }> = ({ type }) => {
        const isSystem = type === 'SYSTEM_INSTRUCTION';
        const label = isSystem ? 'System Instruction' : 'User Prompt';
        const classes = isSystem 
            ? 'bg-green-800 text-green-200' 
            : 'bg-blue-800 text-blue-200';
        return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${classes}`}>{label}</span>;
    };

    const TabButton: React.FC<{ tabId: 'prompts' | 'documents'; label: string }> = ({ tabId, label }) => {
        const isActive = activeTab === tabId;
        return (
            <button
                onClick={() => setActiveTab(tabId)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
                {label}
            </button>
        );
    };

    // MAIN RENDER
    return (
        <>
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
                <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <header className="flex items-center justify-between p-4 border-b border-gray-600">
                        <h3 className="text-lg font-bold text-gray-100">Prompt Inspector</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                    </header>
                    <main className="p-6 flex-1 flex flex-col gap-4 overflow-hidden">
                        {/* Tabs */}
                        <div className="flex items-center gap-2">
                            <TabButton tabId="prompts" label={`Prompts (${promptList.length})`} />
                            <TabButton tabId="documents" label={`Context Documents (${contextDocuments.length})`} />
                        </div>

                        {/* Content Area */}
                        {activeTab === 'prompts' && (
                            <>
                                <div>
                                    <label htmlFor="prompt-select" className="block text-sm font-medium text-gray-300 mb-2">Select a Prompt</label>
                                    <select
                                        id="prompt-select"
                                        value={selectedPromptId}
                                        onChange={e => setSelectedPromptId(e.target.value)}
                                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-gray-200 focus:ring-1 focus:ring-blue-500"
                                    >
                                        {promptList.map(prompt => (
                                            <option key={prompt.id} value={prompt.id}>{prompt.name}</option>
                                        ))}
                                    </select>
                                    {selectedPrompt && (
                                        <div className="mt-2 space-y-2">
                                            <div className="flex items-center gap-3">
                                                <PromptTypeLabel type={selectedPrompt.type} />
                                                <p className="text-xs text-gray-500">{selectedPrompt.description}</p>
                                            </div>
                                            <div className="text-xs text-gray-400 p-2 bg-gray-900/80 rounded-md border border-gray-700">
                                                <span className="font-semibold text-gray-300">Source File:</span> <code className="text-blue-400">{selectedPrompt.filePath}</code>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-auto bg-gray-900 p-4 rounded-md border border-gray-700">
                                    {selectedPrompt ? (
                                        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans">
                                            {promptsInitialized ? getPromptContent(selectedPrompt.id) : 'Loading prompt content...'}
                                        </pre>
                                    ) : (
                                        <p className="text-gray-500">Select a prompt to see its content.</p>
                                    )}
                                </div>
                            </>
                        )}

                        {activeTab === 'documents' && (
                            <>
                                 <div>
                                    <label htmlFor="document-select" className="block text-sm font-medium text-gray-300 mb-2">Select a Document</label>
                                    <select
                                        id="document-select"
                                        value={selectedDocumentId}
                                        onChange={e => setSelectedDocumentId(e.target.value)}
                                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-gray-200 focus:ring-1 focus:ring-blue-500"
                                        disabled={isLoadingContext || contextDocuments.length === 0}
                                    >
                                        {isLoadingContext ? (
                                            <option>Loading documents...</option>
                                        ) : (
                                            contextDocuments.map(doc => (
                                                <option key={doc.id} value={doc.id}>{doc.id}</option>
                                            ))
                                        )}
                                    </select>
                                    {selectedDocument && (
                                        <div className="mt-2 space-y-2 text-xs">
                                            <div className="p-2 bg-gray-900/80 rounded-md border border-gray-700">
                                                <p><span className="font-semibold text-gray-300">Classification:</span> <span className="text-gray-400">{selectedDocument.classification}</span></p>
                                                <p><span className="font-semibold text-gray-300">Summary:</span> <span className="text-gray-400">{selectedDocument.summary}</span></p>
                                            </div>
                                            <div className="p-2 bg-gray-900/80 rounded-md border border-gray-700">
                                                <span className="font-semibold text-gray-300">Source File:</span> <code className="text-blue-400">{`/src/context_documents/${selectedDocument.id}`}</code>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-auto bg-gray-900 p-4 rounded-md border border-gray-700">
                                    {selectedDocument ? (
                                        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans">
                                            {selectedDocument.content}
                                        </pre>
                                    ) : (
                                        <p className="text-gray-500">{isLoadingContext ? 'Loading...' : 'No context documents available.'}</p>
                                    )}
                                </div>
                            </>
                        )}
                    </main>
                     <footer className="flex justify-between items-center gap-4 p-4 bg-gray-900/50 border-t border-gray-700">
                         <div>
                            <button
                                onClick={() => setIsPurgeConfirmModalOpen(true)}
                                className="px-4 py-2 bg-red-800 text-white rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-600"
                            >
                                Purge Database
                            </button>
                         </div>
                         <div className="flex gap-4">
                            <button
                                onClick={handleCopy}
                                disabled={activeTab === 'prompts' ? !selectedPrompt : !selectedDocument}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-600"
                            >
                                {copyButtonText}
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                            >
                                Close
                            </button>
                        </div>
                    </footer>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isPurgeConfirmModalOpen}
                onClose={() => setIsPurgeConfirmModalOpen(false)}
                onConfirm={handleConfirmPurge}
                title="Confirm Database Purge"
                message="Are you sure you want to permanently delete the entire local database? This will remove all cached files, context documents, and other application data. This action cannot be undone."
                confirmButtonText="Purge Database"
                confirmButtonClassName="bg-red-600 hover:bg-red-500 focus:ring-red-500"
            />
        </>
    );
};

export default PromptManagerPanel;

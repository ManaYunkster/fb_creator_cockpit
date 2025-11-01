import React, { useState, useCallback, useRef, useContext, useEffect } from 'react';
// FIX: Removed `GeminiFile as ApiGeminiFile` from this import because `@google/genai` does not export `GeminiFile`.
import { GoogleGenAI, GenerateContentResponse, Chat } from '@google/genai';
import { SettingsContext } from '../contexts/SettingsContext';
import { GeminiCorpusContext } from '../contexts/GeminiCorpusContext';
import { ContentContext } from '../contexts/ContentContext';
import { AI_PROMPTS } from '../services/promptService';
import { GeminiFile } from '../types';
import { log } from '../services/loggingService';
import * as geminiFileService from '../services/geminiFileService';
import FilePickerModal from './FilePickerModal';
import UrlPickerModal from './UrlPickerModal';
import FolderOpenIcon from './icons/FolderOpenIcon';
import LinkIcon from './icons/LinkIcon';
import XMarkIcon from './icons/XMarkIcon';
import { parseInternalFileName } from '../config/file_naming_config';
import InformationCircleIcon from './icons/InformationCircleIcon';
import RefreshIcon from './icons/RefreshIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import StopIcon from './icons/StopIcon';
import PaperclipIcon from './icons/PaperclipIcon';


interface Message {
  role: 'user' | 'model';
  parts: { text: string; files?: GeminiFile[] }[];
}

const ChatAssistantPanel: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [attachedFiles, setAttachedFiles] = useState<GeminiFile[]>([]);
    const [attachedUrls, setAttachedUrls] = useState<string[]>([]);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isUrlPickerOpen, setIsUrlPickerOpen] = useState(false);
    const [isFileUploading, setIsFileUploading] = useState(false);
    const [activeProfiles, setActiveProfiles] = useState<Set<string>>(new Set(['Brand Voice', 'Author Persona']));
    
    const [activeCorpusPills, setActiveCorpusPills] = useState<Set<string>>(new Set());
    const [hasContextChanged, setHasContextChanged] = useState(false);
    const [copyStatus, setCopyStatus] = useState<Record<number, boolean>>({});

    const { modelConfig } = useContext(SettingsContext);
    const { contextFiles, corpusFiles } = useContext(GeminiCorpusContext);
    const { contextDocuments } = useContext(ContentContext);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isGeneratingRef = useRef(false);
    
    useEffect(() => {
        // If a chat session exists and the context changes, show a warning.
        if (chatRef.current) {
            setHasContextChanged(true);
        }
    }, [activeProfiles, activeCorpusPills]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);
    
    const relevantDocs = contextDocuments.filter(doc => {
        const parsed = parseInternalFileName(doc.id);
        if (!parsed) return false;
        return parsed.scope === 'global' || parsed.scope === 'chat';
    });

    const grouped = relevantDocs.reduce<Record<string, number>>((acc, doc) => {
        if (doc.profile && doc.profile !== 'Tool Instruction' && doc.profile !== 'General') {
            acc[doc.profile] = (acc[doc.profile] || 0) + 1;
        }
        return acc;
    }, {});
    const contextProfiles = Object.entries(grouped).map(([name, count]) => ({ name, count }));
    
    const handleProfileToggle = (profileName: string) => {
        setActiveProfiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(profileName)) {
                newSet.delete(profileName);
            } else {
                newSet.add(profileName);
            }
            return newSet;
        });
    };
    
    const handleCorpusPillToggle = (fileName: string) => {
        setActiveCorpusPills(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileName)) {
                newSet.delete(fileName);
            } else {
                newSet.add(fileName);
            }
            return newSet;
        });
    };

    const generateProfileTooltip = (profileName: string): string => {
        const docsInProfile = relevantDocs.filter(doc => doc.profile === profileName);
        if (docsInProfile.length === 0) {
            return `Profile: ${profileName}\nNo synced files found for this profile.`;
        }

        const fileDetails = docsInProfile.map(doc => {
            const geminiFile = contextFiles.get(doc.id);
            if (geminiFile) {
                return `- ${geminiFile.cachedDisplayName || geminiFile.displayName}\n  (API ID: ${geminiFile.name})`;
            }
            return `- ${doc.id} (Not synced)`;
        }).join('\n');

        return `Profile: ${profileName}\n\nFiles:\n${fileDetails}`;
    };
    
    const formatCorpusPillName = (fileName: string): string => {
        const extensionMatch = fileName.match(/\.(json|csv)$/);
        const extension = extensionMatch ? extensionMatch[1].toUpperCase() : '';

        const baseName = fileName.replace(/\.(json|csv)$/, '');

        const formattedName = baseName
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        return `${formattedName} (${extension})`;
    };

    const handleStop = () => {
        log.info('ChatAssistantPanel: Stop generation requested by user.');
        isGeneratingRef.current = false;
    };

    const handleSendMessage = async () => {
        if (!currentInput.trim() && attachedFiles.length === 0 && attachedUrls.length === 0) return;

        setIsLoading(true);
        setError(null);
        isGeneratingRef.current = true;

        // 1. Prepare user message for UI (optimistic update)
        const userMessageText = currentInput.trim();
        const allTurnFiles = [...attachedFiles];
        const userMessage: Message = { role: 'user', parts: [{ text: userMessageText, files: allTurnFiles }] };
        setMessages(prev => [...prev, userMessage]);
        setCurrentInput('');
        setAttachedFiles([]);
        setAttachedUrls([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const parts: any[] = [];
            const combinedMessageText = `${userMessageText} ${attachedUrls.join(' ')}`.trim();
            if (combinedMessageText) {
                parts.push({ text: combinedMessageText });
            }

            // Add files attached for this specific turn
            allTurnFiles.forEach(file => {
                parts.push({ fileData: { mimeType: file.mimeType, fileUri: file.uri } });
            });

            // 2. Handle session creation and first message with persistent context
            if (!chatRef.current) {
                // This is the FIRST message. Attach persistent context files here.
                setHasContextChanged(false);
                
                const documentsForPrompt = contextDocuments.filter(doc => {
                    const parsed = parseInternalFileName(doc.id);
                    if (!parsed) return false;
                    if (parsed.scope === 'global' && activeProfiles.has(doc.profile)) return true;
                    if (parsed.context === 'instrux' && parsed.scope === 'chat') return true;
                    if (parsed.context === 'reference' && parsed.scope === 'chat' && activeProfiles.has(doc.profile)) return true;
                    return false;
                });

                const contextDocIds = new Set(documentsForPrompt.map(d => d.id));
                // FIX: Explicitly typed 'f' as GeminiFile to resolve type inference issues.
                const geminiFilesForPrompt = Array.from(contextFiles.values()).filter((f: GeminiFile) => contextDocIds.has(f.displayName));
                
                // Add active corpus files
                const activeCorpusFileObjects = Array.from(activeCorpusPills)
                    .map(fileName => corpusFiles.get(fileName))
                    .filter((file): file is GeminiFile => !!file);
                
                const allPersistentFiles = [...geminiFilesForPrompt, ...activeCorpusFileObjects];
                // FIX: Explicitly typed 'f' as GeminiFile to resolve type inference issues.
                const uniqueFiles = Array.from(new Map(allPersistentFiles.map((f: GeminiFile) => [f.name, f])).values());

                // FIX: Explicitly typed 'file' as GeminiFile to resolve type inference issues.
                uniqueFiles.forEach((file: GeminiFile) => {
                    parts.push({ fileData: { mimeType: file.mimeType, fileUri: file.uri } });
                });
                
                const systemInstruction = AI_PROMPTS.CHAT_SYSTEM_BASE.getSystemInstruction();

                // Create the new chat session
                chatRef.current = ai.chats.create({
                    model: modelConfig.model,
                    config: {
                        systemInstruction,
                        temperature: modelConfig.temperature,
                        safetySettings: modelConfig.safetySettings,
                    },
                });
            }

            if (parts.length === 0) {
                 throw new Error("Cannot send an empty message.");
            }

            // 3. Send the message to the API
            const stream = await chatRef.current.sendMessageStream({ message: parts });

            // 4. Handle streaming response for the UI
            let fullResponse = '';
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: '' }] }]);

            for await (const chunk of stream) {
                if (!isGeneratingRef.current) {
                    log.info('ChatAssistantPanel: Generation stopped by signal.');
                    break;
                }
                fullResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage && lastMessage.role === 'model') {
                        lastMessage.parts[0].text = fullResponse;
                    }
                    return newMessages;
                });
            }
            
        } catch (e: any) {
            log.error('Chat Assistant Error:', e);
            setError(e.message || 'An error occurred while communicating with the AI.');
            // On error, remove the optimistic user message and the empty model bubble
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
            isGeneratingRef.current = false;
        }
    };
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsFileUploading(true);
        setError(null);

        try {
            // FIX: Explicitly typed 'file' as File to resolve type inference issues.
            const uploadPromises = Array.from(files).map((file: File) => 
                geminiFileService.uploadFileToApiOnly(file, { displayName: file.name })
            );
            const uploadedFiles = await Promise.all(uploadPromises);
            setAttachedFiles(prev => [...prev, ...uploadedFiles]);
        } catch (err: any) {
            setError(err.message || "Failed to upload file(s).");
        } finally {
            setIsFileUploading(false);
            if (e.target) e.target.value = ''; // Reset file input
        }
    };

    const handleFilesSelected = (files: GeminiFile[]) => {
        const newFiles = files.filter(f => !attachedFiles.some(af => af.name === f.name));
        setAttachedFiles(prev => [...prev, ...newFiles]);
    };
    
    const handleUrlsSelected = (urls: string[]) => {
        setAttachedUrls(urls);
    };

    const handleRemoveFile = (fileName: string) => {
        setAttachedFiles(prev => prev.filter(f => f.name !== fileName));
    };

    const handleNewChat = () => {
        setMessages([]);
        chatRef.current = null;
        setError(null);
        setHasContextChanged(false);
    };

    const handleCopy = (htmlContent: string, index: number) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        navigator.clipboard.writeText(tempDiv.textContent || tempDiv.innerText || "");
        setCopyStatus({ [index]: true });
        setTimeout(() => {
            setCopyStatus(prev => {
                const newState = { ...prev };
                delete newState[index];
                return newState;
            });
        }, 2000);
    };

    return (
        <div className="flex flex-col h-[75vh] bg-gray-800 animate-fade-in-up">
            <FilePickerModal isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} onFilesSelected={handleFilesSelected} existingFiles={attachedFiles} />
            <UrlPickerModal isOpen={isUrlPickerOpen} onClose={() => setIsUrlPickerOpen(false)} onConfirm={handleUrlsSelected} initialUrls={attachedUrls} />

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`relative group ${msg.role === 'user' ? 'max-w-xl' : 'w-full'}`}>
                            <div className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                                {msg.parts.map((part, partIndex) => (
                                    <div key={partIndex}>
                                        <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: part.text }} />
                                        {part.files && part.files.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {part.files.map(file => (
                                                    <div key={file.name} className="bg-blue-500/80 p-1.5 rounded-md text-xs">
                                                        Attached File: {file.cachedDisplayName || file.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {msg.role === 'model' && msg.parts.some(p => p.text) && (
                                <div className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleCopy(msg.parts.map(p => p.text).join('\n'), index)}
                                        className="flex items-center gap-1.5 text-xs px-2 py-1 bg-gray-800/80 backdrop-blur-sm border border-gray-600 hover:bg-gray-700 rounded-md text-gray-300 transition-colors"
                                        title="Copy Response Text"
                                    >
                                        <ClipboardIcon className="w-3.5 h-3.5" />
                                        {copyStatus[index] ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== 'model' && (
                    <div className="flex justify-start">
                         <div className="max-w-xl p-3 rounded-lg bg-gray-700 text-gray-200">
                             <div className="flex items-center gap-2">
                                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                             </div>
                         </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 border-t border-gray-700 bg-gray-800">
                {error && <div className="p-2 mb-2 text-sm bg-red-900/50 border border-red-700 text-red-300 rounded-md whitespace-pre-wrap">{error}</div>}
                
                {(attachedFiles.length > 0 || attachedUrls.length > 0) && (
                    <div className="mb-2 flex flex-wrap gap-2">
                        {attachedFiles.map(file => (
                            <div key={file.name} className="flex items-center gap-1.5 text-xs px-2 py-1 bg-gray-700 rounded-full">
                                <span>{file.cachedDisplayName || file.name}</span>
                                <button onClick={() => handleRemoveFile(file.name)} className="text-gray-400 hover:text-white"><XMarkIcon className="w-3 h-3" /></button>
                            </div>
                        ))}
                         {attachedUrls.map(url => (
                            <div key={url} className="flex items-center gap-1.5 text-xs px-2 py-1 bg-gray-700 rounded-full">
                                <span className="truncate max-w-xs">{url}</span>
                                <button onClick={() => setAttachedUrls(urls => urls.filter(u => u !== url))} className="text-gray-400 hover:text-white"><XMarkIcon className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="relative">
                    <textarea
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder="Type your message..."
                        className="w-full p-3 pr-40 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 placeholder-gray-500 resize-none"
                        rows={1}
                        disabled={isLoading}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button onClick={() => document.getElementById('chat-file-upload')?.click()} title="Upload File" disabled={isFileUploading}>
                            {isFileUploading ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <FolderOpenIcon className="w-5 h-5 text-gray-400 hover:text-white" />}
                        </button>
                        <input type="file" id="chat-file-upload" multiple className="hidden" onChange={handleFileUpload} />
                        <button onClick={() => setIsPickerOpen(true)} title="Attach Existing File"><PaperclipIcon className="w-5 h-5 text-gray-400 hover:text-white" /></button>
                        <button onClick={() => setIsUrlPickerOpen(true)} title="Attach URL"><LinkIcon className="w-5 h-5 text-gray-400 hover:text-white" /></button>
                        {isLoading ? (
                            <button
                                onClick={handleStop}
                                className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-500 text-sm flex items-center gap-2"
                                title="Stop generating response"
                            >
                                <StopIcon className="w-4 h-4" />
                                Stop
                            </button>
                        ) : (
                            <button
                                onClick={handleSendMessage}
                                disabled={!currentInput.trim() && attachedFiles.length === 0 && attachedUrls.length === 0}
                                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600 text-sm"
                            >
                                Send
                            </button>
                        )}
                    </div>
                </div>
                 <div className="mt-4 flex items-start justify-between gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-gray-400">Context Profiles:</span>
                            {contextProfiles.map(profile => (
                                <button
                                    key={profile.name}
                                    onClick={() => handleProfileToggle(profile.name)}
                                    title={generateProfileTooltip(profile.name)}
                                    className={`px-2 py-1 text-xs font-semibold rounded-full border transition-all duration-200 ${
                                        activeProfiles.has(profile.name)
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                    }`}
                                >
                                    {profile.name} ({profile.count})
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-gray-400">Corpus Data:</span>
                            {/* FIX: Explicitly typed 'fileName' as string to resolve type inference issues. */}
                            {Array.from(corpusFiles.keys())
                                .filter((fileName: string) => fileName.endsWith('.json') || fileName.endsWith('.csv'))
                                .map(fileName => {
                                    const file = corpusFiles.get(fileName);
                                    if (!file) return null;
                                    const tooltip = `File: ${file.cachedDisplayName || 'N/A'}\nAPI ID: ${file.name}`;
                                    return (
                                        <button
                                            key={fileName}
                                            onClick={() => handleCorpusPillToggle(fileName)}
                                            title={tooltip}
                                            className={`px-2 py-1 text-xs font-semibold rounded-full border transition-all duration-200 ${
                                                activeCorpusPills.has(fileName)
                                                ? 'bg-teal-600 border-teal-500 text-white'
                                                : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                            }`}
                                        >
                                            {formatCorpusPillName(fileName)}
                                        </button>
                                    );
                            })}
                        </div>
                    </div>
                    <div className="flex-shrink-0">
                         <button
                            onClick={handleNewChat}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-500 transition-colors text-sm"
                            title="Start a new chat session"
                        >
                            <RefreshIcon className="w-4 h-4" />
                            New Chat
                        </button>
                    </div>
                </div>
                {hasContextChanged && (
                    <div className="mt-3 p-2 text-xs bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-md flex items-center gap-2">
                        <InformationCircleIcon className="w-4 h-4 flex-shrink-0" />
                        <span>Context has changed. <strong>Start a new chat</strong> for these changes to take effect.</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatAssistantPanel;
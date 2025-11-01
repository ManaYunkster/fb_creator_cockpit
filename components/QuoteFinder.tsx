import React, { useState, useContext, useMemo, useEffect } from 'react';
import { Type } from '@google/genai';
import { GeminiCorpusContext } from '../contexts/GeminiCorpusContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { ContentContext } from '../contexts/ContentContext';
import * as geminiFileService from '../services/geminiFileService';
import { AI_PROMPTS } from '../services/promptService';
import { log } from '../services/loggingService';
import ClipboardIcon from './icons/ClipboardIcon';
import XCircleIcon from './icons/XCircleIcon';
import RefreshIcon from './icons/RefreshIcon';
import { parseInternalFileName } from '../config/file_naming_config';
import ChevronDownIcon from './icons/ChevronDownIcon';
// FIX: Imported the shared CallbackResult type.
import { CallbackResult, GeminiFile } from '../types';
import { VENUE_UTM_CONFIG } from '../config/social_post_config';

type Mode = 'quote' | 'callback';
type InputMode = 'url' | 'text' | 'file';

interface QuoteResult {
    topicHeader: string;
    quote: string;
    sourceTitle: string;
    sourceUrl: string;
    sourceDate: string;
    whyItMatched: string;
}

// FIX: Removed local interface definition for CallbackResult as it is now imported from `types.ts`.

type Result = QuoteResult | CallbackResult;

// A processed version of the result with UTM tags applied
interface ProcessedCallbackResult extends CallbackResult {
    processedCallbackSentence: string;
}
type ProcessedResult = QuoteResult | ProcessedCallbackResult;


const safeJsonParse = (jsonString: string) => {
    try {
        // First, try to parse it directly
        return JSON.parse(jsonString);
    } catch (e) {
        // If it fails, check for markdown fences
        log.info('QuoteFinder: Initial JSON.parse failed, checking for markdown fences.', e);
        const match = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
            log.info('QuoteFinder: Found markdown fence, attempting to parse content within.');
            try {
                // If we found a block, try parsing that
                return JSON.parse(match[1]);
            } catch (innerError) {
                // If even the inner block fails, throw a more informative error
                log.error("Failed to parse JSON even after extracting from markdown fence:", { innerError, extracted: match[1] });
                throw new Error("AI returned malformed JSON content inside a markdown block.");
            }
        }
        // If no markdown fence, re-throw the original error
        log.error("Failed to parse JSON and no markdown fence found:", { originalError: e, content: jsonString });
        throw new Error("AI returned a non-JSON response or malformed JSON.");
    }
};

const slugify = (text: string) => {
    if (!text) return '';
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

const QuoteFinder: React.FC = () => {
    const [mode, setMode] = useState<Mode>('callback');
    const [inputMode, setInputMode] = useState<InputMode>('url');
    
    // State for each input mode
    const [urlInput, setUrlInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [articleTitle, setArticleTitle] = useState<string>('');

    const [results, setResults] = useState<Result[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [progressMessage, setProgressMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [activeProfiles, setActiveProfiles] = useState<Set<string>>(new Set(['Brand Voice', 'Author Persona']));
    
    // Status tracking for individual cards/buttons
    const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
    const [rejectedIndices, setRejectedIndices] = useState<Set<number>>(new Set());
    const [editedCallbacks, setEditedCallbacks] = useState<Record<number, string>>({});
    const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

    // UTM Tagging State
    const [appendUtmTags, setAppendUtmTags] = useState(true);
    const [isUtmPanelOpen, setIsUtmPanelOpen] = useState(false);
    const [utmPreset, setUtmPreset] = useState<string>('Substack Callback');
    const [utmSource, setUtmSource] = useState('');
    const [utmMedium, setUtmMedium] = useState('');
    const [utmCampaign, setUtmCampaign] = useState('');
    const [utmTerm, setUtmTerm] = useState('');

    const { corpusFiles, contextFiles: geminiContextFiles, status: corpusStatus } = useContext(GeminiCorpusContext);
    const { modelConfig } = useContext(SettingsContext);
    const { contextDocuments } = useContext(ContentContext);

    const modeLabels: Record<Mode, string> = {
        quote: 'Quote Finder',
        callback: 'Callback Finder'
    };

    const relevantDocs = contextDocuments.filter(doc => {
        const parsed = parseInternalFileName(doc.id);
        if (!parsed) return false;
        return parsed.scope === 'global' || parsed.scope === 'qf';
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

    useEffect(() => {
        if (inputMode === 'file' && uploadedFile) {
            setArticleTitle(uploadedFile.name);
        } else if (inputMode !== 'file') {
            setArticleTitle(prev => slugify(prev) ? prev : ''); // Keep title if already set, otherwise reset
        }
    }, [inputMode, uploadedFile]);
    
    useEffect(() => {
        const utmConfig = VENUE_UTM_CONFIG[utmPreset];
        if (!utmConfig) return;

        setUtmSource(utmConfig.source);
        setUtmMedium(utmConfig.medium);
        setUtmTerm(utmConfig.term || '');

        if (utmConfig.campaign) {
            setUtmCampaign(utmConfig.campaign);
        } else if (articleTitle) {
            setUtmCampaign(slugify(articleTitle));
        } else {
            setUtmCampaign(utmConfig.defaultCampaignForCustomUrl);
        }
    }, [utmPreset, articleTitle]);
    
    const handleModeChange = (newMode: Mode) => {
        setMode(newMode);
        setResults([]);
        setError(null);
        setRejectedIndices(new Set());
        setEditedCallbacks({});
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['text/html', 'text/plain', 'text/markdown'];
        if (!allowedTypes.includes(file.type) && !file.name.endsWith('.md')) {
            setError(`Unsupported file type. Please upload a .html, .txt, or .md file.`);
            setUploadedFile(null);
            setFileContent(null);
            return;
        }
        
        setError(null);
        setUploadedFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
            setFileContent(event.target?.result as string);
        };
        reader.onerror = () => {
             setError(`Error reading file: ${file.name}`);
        };
        reader.readAsText(file);
    };
    
    const handleGenerate = async () => {
        let workingArticleContent = '';
        let fetchedTitle = '';
        setError(null);
        setResults([]);
        setRejectedIndices(new Set());
        setEditedCallbacks({});
        setIsLoading(true);

        try {
            switch (inputMode) {
                case 'url':
                    if (!urlInput.trim()) throw new Error('Please enter a valid URL.');
                    setProgressMessage('Fetching content from URL...');
                    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlInput)}`;
                    const response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error(`Failed to fetch URL. Status: ${response.status}`);
                    const htmlContent = await response.text();
                     try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(htmlContent, 'text/html');
                        fetchedTitle = doc.querySelector('title')?.textContent || '';
                        const article = doc.querySelector('article');
                        const main = doc.querySelector('main');
                        const postBody = doc.querySelector('.post-body, .post-content, .article-body, #content');

                        if (article) workingArticleContent = article.innerHTML;
                        else if (main) workingArticleContent = main.innerHTML;
                        else if (postBody) workingArticleContent = postBody.innerHTML;
                        else workingArticleContent = doc.body.innerHTML;
                    } catch (parseError) {
                        log.error("DOM parsing failed, falling back to raw content.", parseError);
                        workingArticleContent = htmlContent;
                    }
                    break;
                case 'file':
                    if (!fileContent || !uploadedFile) throw new Error('No file content is loaded.');
                    fetchedTitle = uploadedFile.name;
                    workingArticleContent = fileContent;
                    break;
                case 'text':
                    if (!textInput.trim()) throw new Error('Please paste content to analyze.');
                    fetchedTitle = '';
                    workingArticleContent = textInput;
                    break;
            }
            setArticleTitle(fetchedTitle);

            if (!workingArticleContent.trim()) {
                 throw new Error("Could not extract any content from the provided source.");
            }

            log.info('QuoteFinder: handleGenerate triggered', { mode, inputMode, activeProfiles });

            if (corpusStatus !== 'READY') {
                throw new Error('Please wait for the corpus to be synced and ready.');
            }

            setProgressMessage('Analyzing content and finding callbacks...');
            // FIX: Explicitly typed 'file' as GeminiFile to resolve type inference issues.
            const allPostsFile = Array.from(corpusFiles.values()).find((file: GeminiFile) => (file.displayName || '').endsWith('all_posts.json'));
            if (!allPostsFile) {
                throw new Error("Could not find 'all_posts.json' in the synced corpus files.");
            }

            let brandContextString: string | undefined;
            const contextFilesToInclude = [];
            
            const documentsForPrompt = contextDocuments.filter(doc => {
                const parsed = parseInternalFileName(doc.id);
                if (!parsed) return false;

                // Global content from active profiles
                if (parsed.scope === 'global' && activeProfiles.has(doc.profile)) {
                    return true;
                }
                // Tool-specific instructions for this tool (qf)
                if (parsed.context === 'instrux' && parsed.scope === 'qf') {
                    return true;
                }
                // Tool-specific reference for this tool (qf) from active profiles
                if (parsed.context === 'reference' && parsed.scope === 'qf' && activeProfiles.has(doc.profile)) {
                    return true;
                }
                return false;
            });

            if (documentsForPrompt.length > 0) {
                const contextDocIds = new Set(documentsForPrompt.map(d => d.id));
                // FIX: Explicitly typed 'f' as GeminiFile to resolve type inference issues.
                const geminiFilesForPrompt = Array.from(geminiContextFiles.values()).filter((f: GeminiFile) => contextDocIds.has(f.displayName));

                if (geminiFilesForPrompt.length > 0) {
                    contextFilesToInclude.push(...geminiFilesForPrompt);
                } else {
                    brandContextString = documentsForPrompt.map(doc => `--- Document: ${doc.id} ---\n${doc.content}`).join('\n\n---\n\n');
                }
            }
            
            const { systemInstruction, userPrompt, schema } = AI_PROMPTS.getQuoteFinderPrompt(mode, workingArticleContent, brandContextString);
            
            const filesForApi = [allPostsFile, ...contextFilesToInclude];
            
            const textPart = { text: userPrompt };
            const fileParts = filesForApi.map(file => ({
                fileData: { fileUri: file.uri, mimeType: file.mimeType },
            }));

            const geminiResponse = await geminiFileService.generateContent({
                model: modelConfig.model,
                contents: { parts: [textPart, ...fileParts] },
                config: {
                    systemInstruction,
                    temperature: modelConfig.temperature,
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                    safetySettings: modelConfig.safetySettings,
                }
            });
            
            const jsonStr = geminiResponse.text.trim();
            const parsedResults = safeJsonParse(jsonStr);

            if (!Array.isArray(parsedResults)) {
                throw new Error("AI response was not in the expected array format.");
            }
            
            setResults(parsedResults);

        } catch (e: any) {
            log.error('QuoteFinder Error:', e);
            setError(e.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    };

    // FIX: Rewrote useMemo hook to be more type-safe and resolve assignment errors.
    // The logic is now split based on the current mode, ensuring the correct types are returned.
    const processedResults: ProcessedResult[] = useMemo(() => {
        if (mode === 'quote') {
            return results as QuoteResult[];
        }

        return (results as CallbackResult[]).map((callbackRes, index) => {
            let finalCallbackHtml = editedCallbacks[index] ?? callbackRes.callbackSentence;

            if (appendUtmTags) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = finalCallbackHtml;
                const link = tempDiv.querySelector('a');

                if (link && link.href) {
                    try {
                        const url = new URL(link.href);
                        if (utmSource) url.searchParams.set('utm_source', utmSource);
                        if (utmMedium) url.searchParams.set('utm_medium', utmMedium);
                        if (utmCampaign) url.searchParams.set('utm_campaign', utmCampaign);
                        if (utmTerm) url.searchParams.set('utm_term', utmTerm);
                        link.href = url.toString();
                        finalCallbackHtml = tempDiv.innerHTML;
                    } catch (e) {
                        log.error('Failed to parse URL for UTM tagging:', link.href, e);
                    }
                }
            }
            return { ...callbackRes, processedCallbackSentence: finalCallbackHtml };
        });
    }, [results, mode, editedCallbacks, appendUtmTags, utmSource, utmMedium, utmCampaign, utmTerm]);
    
    const setCopyStatusWithTimeout = (key: string) => {
        setCopyStatus(prev => ({ ...prev, [key]: true }));
        setTimeout(() => setCopyStatus(prev => ({ ...prev, [key]: false })), 2000);
    };

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopyStatusWithTimeout(key);
    };

    const handleCopySource = (result: QuoteResult, index: number) => {
        const sourceText = `${result.sourceTitle} (${result.sourceUrl})`;
        navigator.clipboard.writeText(sourceText);
        setCopyStatusWithTimeout(`source_${index}`);
    };
    
    const handleCopyWithAttribution = (result: QuoteResult, index: number) => {
        const attributionText = `"${result.quote}"\n\n— Eric Duell, in "${result.sourceTitle}" for Do Good by Doing Better (Published on ${new Date(result.sourceDate).toLocaleDateString()})\nRead more: ${result.sourceUrl}`;
        navigator.clipboard.writeText(attributionText);
        setCopyStatusWithTimeout(`attr_${index}`);
    };

    const handleReject = (index: number) => setRejectedIndices(prev => new Set(prev).add(index));
    const handleCallbackSentenceChange = (index: number, newContent: string) => {
        let strippedContent = newContent;
        if (appendUtmTags) {
            try {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newContent;
                const link = tempDiv.querySelector('a');
                if (link && link.href) {
                    const url = new URL(link.href);
                    url.searchParams.delete('utm_source');
                    url.searchParams.delete('utm_medium');
                    url.searchParams.delete('utm_campaign');
                    url.searchParams.delete('utm_term');
                    link.href = url.toString();
                    strippedContent = tempDiv.innerHTML;
                }
            } catch (e) {
                log.error('Failed to strip UTMs from edited content:', e);
            }
        }
        setEditedCallbacks(prev => ({ ...prev, [index]: strippedContent }));
    };
    
    const handleRegenerate = async (index: number) => {
        log.info(`QuoteFinder: handleRegenerate for index ${index}`);
        setRegeneratingIndex(index);
        setError(null);

        try {
            const resultToRegen = results[index] as CallbackResult;

            const documentsForPrompt = contextDocuments.filter(doc => {
                const parsed = parseInternalFileName(doc.id);
                if (!parsed) return false;

                if (parsed.scope === 'global' && activeProfiles.has(doc.profile)) return true;
                if (parsed.context === 'instrux' && parsed.scope === 'qf') return true;
                if (parsed.context === 'reference' && parsed.scope === 'qf' && activeProfiles.has(doc.profile)) return true;
                
                return false;
            });
            
            let brandContextString: string | undefined;
            if (documentsForPrompt.length > 0) {
                 brandContextString = documentsForPrompt.map(doc => `--- Document: ${doc.id} ---\n${doc.content}`).join('\n\n---\n\n');
            }

            const { systemInstruction, userPrompt, schema } = AI_PROMPTS.getQuoteFinderRegenPrompt(resultToRegen, brandContextString);

            // No files are needed for regeneration; all context is in the prompt.
            const response = await geminiFileService.generateContent({
                model: modelConfig.model,
                contents: userPrompt,
                config: {
                    systemInstruction,
                    temperature: modelConfig.temperature,
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                    safetySettings: modelConfig.safetySettings,
                }
            });

            const jsonStr = response.text.trim();
            const parsedResult = safeJsonParse(jsonStr);
            const newCallbackSentence = parsedResult.newCallbackSentence;

            if (!newCallbackSentence) {
                throw new Error("AI did not return a new callback sentence.");
            }

            setResults(prevResults => {
                const newResults = [...prevResults];
                const updatedResult = { ...newResults[index], callbackSentence: newCallbackSentence };
                newResults[index] = updatedResult as Result;
                return newResults;
            });

            setEditedCallbacks(prev => {
                const newEdits = {...prev};
                delete newEdits[index];
                return newEdits;
            });

        } catch (e: any) {
            log.error('QuoteFinder Regeneration Error:', e);
            setError(e.message || 'Failed to regenerate callback.');
        } finally {
            setRegeneratingIndex(null);
        }
    };


    const handleCopyCallback = (processedCallbackHtml: string, index: number) => {
        const blob = new Blob([processedCallbackHtml], { type: 'text/html' });
        const clipboardItem = new ClipboardItem({ 'text/html': blob });
        navigator.clipboard.write([clipboardItem]);
        setCopyStatusWithTimeout(`callback_${index}`);
    };
    
    const handleCopyCallbackWithUrl = (processedCallbackHtml: string, index: number) => {
        const tempCallbackDiv = document.createElement('div');
        tempCallbackDiv.innerHTML = processedCallbackHtml;
        const link = tempCallbackDiv.querySelector('a');
        if (link) {
            const title = link.textContent || 'Source';
            const url = link.href || '#';
            link.parentNode?.replaceChild(document.createTextNode(`${title} (${url})`), link);
        }
        
        const textToCopy = tempCallbackDiv.textContent || '';
        navigator.clipboard.writeText(textToCopy);
        setCopyStatusWithTimeout(`callback_url_${index}`);
    };

    const isInputProvided = () => {
        switch (inputMode) {
            case 'url': return !!urlInput.trim();
            case 'text': return !!textInput.trim();
            case 'file': return !!fileContent;
            default: return false;
        }
    };
    
    const isGenerateDisabled = !isInputProvided() || isLoading || corpusStatus !== 'READY';

    const visibleResults = useMemo(() => {
        return processedResults.map((r, i) => ({ result: r, index: i }))
            .filter(({ index }) => !rejectedIndices.has(index));
    }, [processedResults, rejectedIndices]);
    
    const renderInputArea = () => {
        switch (inputMode) {
            case 'url':
                return (
                     <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://your-post.substack.com/p/..."
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 placeholder-gray-500"
                    />
                );
            case 'text':
                 return (
                     <div
                        onBlur={(e) => setTextInput(e.currentTarget.innerHTML)}
                        contentEditable
                        suppressContentEditableWarning
                        dangerouslySetInnerHTML={{ __html: textInput }}
                        className="w-full min-h-[10rem] p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 overflow-y-auto prose prose-invert max-w-none"
                    />
                 );
            case 'file':
                return (
                    <div>
                        <input
                            type="file"
                            onChange={handleFileChange}
                            accept=".html,.txt,.md"
                            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-gray-700 file:text-blue-300 hover:file:bg-gray-600"
                        />
                         {uploadedFile && (
                            <p className="text-xs text-gray-400 mt-2">
                                Loaded: <span className="font-semibold text-gray-300">{uploadedFile.name}</span>
                            </p>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Controls */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-center gap-2 p-1 bg-gray-900/50 rounded-lg max-w-sm mx-auto">
                    {(['quote', 'callback'] as Mode[]).map(m => (
                        <button
                            key={m}
                            onClick={() => handleModeChange(m)}
                            className={`w-full px-4 py-2 text-sm font-semibold rounded-md transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                mode === m ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700'
                            }`}
                        >
                            {modeLabels[m]}
                        </button>
                    ))}
                </div>

                <div>
                    <label htmlFor="input-mode-select" className="block text-sm font-medium text-gray-300 mb-2">
                        {mode === 'callback' ? 'Working Article Source' : 'Search Source'}
                    </label>
                    <div className="flex gap-4">
                        <select
                            id="input-mode-select"
                            value={inputMode}
                            onChange={(e) => setInputMode(e.target.value as InputMode)}
                             className="p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200"
                        >
                            <option value="url">From URL</option>
                            <option value="text">Paste Text</option>
                            <option value="file">Upload File</option>
                        </select>
                        <div className="flex-grow">
                             {renderInputArea()}
                        </div>
                    </div>
                </div>

                {mode === 'callback' && (
                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg">
                        <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setIsUtmPanelOpen(prev => !prev)}>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox" id="append-utm-toggle" checked={appendUtmTags}
                                    onChange={(e) => setAppendUtmTags(e.target.checked)}
                                    onClick={e => e.stopPropagation()}
                                    className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="append-utm-toggle" className="ml-2 text-sm font-medium text-gray-200 cursor-pointer">Append UTM Tags to Link</label>
                                <select
                                    id="utm-preset-select"
                                    value={utmPreset}
                                    onChange={e => setUtmPreset(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    className="ml-4 p-1 bg-gray-700 border border-gray-600 rounded-md text-xs text-gray-200 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                    disabled={!appendUtmTags}
                                >
                                    {Object.keys(VENUE_UTM_CONFIG).map(presetName => (
                                        <option key={presetName} value={presetName}>{presetName}</option>
                                    ))}
                                </select>
                            </div>
                            <button aria-expanded={isUtmPanelOpen} aria-controls="utm-panel" className="p-1 text-gray-400 hover:text-white" title={isUtmPanelOpen ? "Collapse" : "Expand"}>
                                <ChevronDownIcon className={`w-5 h-5 transition-transform ${isUtmPanelOpen ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                        {isUtmPanelOpen && (
                            <div id="utm-panel" className="p-4 border-t border-gray-700 space-y-3 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <label htmlFor="utm-source" className="block text-xs text-gray-400 mb-1">Source (utm_source)</label>
                                        <input type="text" id="utm-source" value={utmSource} onChange={e => setUtmSource(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
                                    </div>
                                    <div>
                                        <label htmlFor="utm-medium" className="block text-xs text-gray-400 mb-1">Medium (utm_medium)</label>
                                        <input type="text" id="utm-medium" value={utmMedium} onChange={e => setUtmMedium(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <label htmlFor="utm-campaign" className="block text-xs text-gray-400 mb-1">Campaign (utm_campaign)</label>
                                        <input type="text" id="utm-campaign" value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
                                    </div>
                                    <div>
                                        <label htmlFor="utm-term" className="block text-xs text-gray-400 mb-1">Term (utm_term)</label>
                                        <input type="text" id="utm-term" value={utmTerm} onChange={e => setUtmTerm(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between flex-wrap gap-4">
                     <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-300">Context:</span>
                        {contextProfiles.map(profile => (
                            <button
                                key={profile.name}
                                onClick={() => handleProfileToggle(profile.name)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 focus-visible:ring-blue-500 ${
                                    activeProfiles.has(profile.name)
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                {profile.name} ({profile.count})
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerateDisabled}
                        className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                {progressMessage || 'Finding...'}
                            </>
                        ) : 'Find'}
                    </button>
                </div>
                {corpusStatus !== 'READY' && <p className="text-xs text-center text-yellow-400">Corpus is not ready. Status: {corpusStatus}</p>}
            </div>

            {/* Results */}
            <div className="space-y-6">
                {error && <div className="p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-md">{error}</div>}

                {visibleResults.length > 0 && visibleResults.map(({ result, index }) => (
                    <div key={index} className="relative bg-gray-900/50 border border-gray-700 rounded-lg p-6 animate-fade-in-up flex flex-col transition-colors" style={{ animationDelay: `${index * 100}ms` }}>
                        
                        {mode === 'callback' && (
                           <div className="absolute top-4 right-4 flex items-center gap-3">
                                <button onClick={() => handleRegenerate(index)} title="Regenerate Callback" disabled={regeneratingIndex === index}>
                                    {regeneratingIndex === index 
                                        ? <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        : <RefreshIcon className="w-6 h-6 text-gray-400 hover:text-white transition-colors" />
                                    }
                                </button>
                                <button onClick={() => handleReject(index)} title="Remove Suggestion">
                                    <XCircleIcon className="w-6 h-6 text-gray-500 hover:text-red-400 transition-colors" />
                                </button>
                           </div>
                        )}

                        <h3 className="text-xl font-bold text-gray-100 mb-4 pr-20">{index + 1}. {result.topicHeader}</h3>

                        {mode === 'quote' && 'quote' in result && (
                           <>
                                <div className="flex-grow mb-4">
                                    <blockquote className="border-l-4 border-gray-600 pl-4">
                                        <p className="text-xl text-gray-200 italic">{result.quote}</p>
                                    </blockquote>
                                </div>
                                <div className="mt-auto">
                                    <p className="mt-4 text-sm text-gray-300">{result.whyItMatched}</p>
                                    <div className="mt-4 pt-4 border-t border-gray-700 space-y-1 text-sm">
                                        <p className="text-gray-400">
                                            <strong>Source:</strong> <em>{result.sourceTitle}</em> ({new Date(result.sourceDate).toLocaleDateString()})
                                        </p>
                                        <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate block">
                                            {result.sourceUrl}
                                        </a>
                                    </div>
                                    <div className="flex items-center gap-2 pt-4 flex-wrap">
                                        <button onClick={() => handleCopy(result.quote, `quote_${index}`)} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                                            <ClipboardIcon className="w-3.5 h-3.5" /> {copyStatus[`quote_${index}`] ? 'Copied!' : 'Copy Quote'}
                                        </button>
                                         <button onClick={() => handleCopyWithAttribution(result, index)} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                                            <ClipboardIcon className="w-3.5 h-3.5" /> {copyStatus[`attr_${index}`] ? 'Copied!' : 'Copy with Attribution'}
                                        </button>
                                        <button onClick={() => handleCopySource(result, index)} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                                            <ClipboardIcon className="w-3.5 h-3.5" /> {copyStatus[`source_${index}`] ? 'Copied!' : 'Copy Title with URL'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {mode === 'callback' && 'callbackSentence' in result && (
                            <>
                                <div className="space-y-6 text-sm flex-grow">
                                    <div>
                                        <strong className="text-gray-400 block mb-2">Draft with Callback</strong>
                                        <div className="p-4 bg-gray-800 rounded-md border border-gray-700 leading-relaxed text-base prose prose-invert max-w-none">
                                            <div className="opacity-70" dangerouslySetInnerHTML={{ __html: result.precedingWorkingContext || '' }} />
                                            <div className="my-2 border-y-2 border-dashed border-gray-600 py-2">
                                                <div dangerouslySetInnerHTML={{ __html: result.workingArticleAnchor }} className="text-white" />
                                                <div className="mt-2 text-base text-white bg-blue-900/50 p-3 rounded-md">
                                                    <div
                                                        contentEditable
                                                        onBlur={(e) => handleCallbackSentenceChange(index, e.currentTarget.innerHTML)}
                                                        suppressContentEditableWarning
                                                        dangerouslySetInnerHTML={{ __html: (result as ProcessedCallbackResult).processedCallbackSentence.replace(/<a /g, '<a class="text-blue-400 hover:underline" ') }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="opacity-70" dangerouslySetInnerHTML={{ __html: result.followingWorkingContext || '' }} />
                                        </div>

                                        <p className="text-gray-300 pt-3"><strong className="text-gray-400">Rationale:</strong> {result.whyItMatched}</p>
                                    </div>

                                    <div className="pt-4 border-t border-gray-700">
                                        <strong className="text-gray-400">Original callback context</strong>
                                        <p className="text-sm text-gray-400 mt-2">From: <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline"><em>{result.sourceTitle}</em></a></p>
                                        <blockquote className="mt-2 border-l-2 border-gray-600 pl-3 prose prose-sm prose-invert max-w-none">
                                            {result.precedingContext && (
                                                <div className="opacity-70" dangerouslySetInnerHTML={{ __html: '...' + result.precedingContext }} />
                                            )}
                                            <div className="my-2" dangerouslySetInnerHTML={{ __html: result.anchorQuote }} />
                                            {result.followingContext && (
                                                <div className="opacity-70" dangerouslySetInnerHTML={{ __html: result.followingContext + '...' }} />
                                            )}
                                        </blockquote>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 pt-4 flex-wrap">
                                    <button onClick={() => handleCopyCallback((result as ProcessedCallbackResult).processedCallbackSentence, index)} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                                       <ClipboardIcon className="w-3.5 h-3.5" /> {copyStatus[`callback_${index}`] ? 'Copied!' : 'Copy Callback'}
                                    </button>
                                     <button onClick={() => handleCopyCallbackWithUrl((result as ProcessedCallbackResult).processedCallbackSentence, index)} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 transition-colors">
                                       <ClipboardIcon className="w-3.5 h-3.5" /> {copyStatus[`callback_url_${index}`] ? 'Copied!' : 'Copy Callback with URL'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default QuoteFinder;
import React, { useState, useCallback, useRef, useContext, useMemo, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { DataContext } from '../contexts/DataContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { ContentContext } from '../contexts/ContentContext';
import { GeminiCorpusContext } from '../contexts/GeminiCorpusContext';
import { AI_PROMPTS } from '../services/promptService';
import { VENUE_LENGTH_CONFIG, VENUE_UTM_CONFIG } from '../config/social_post_config';
import * as geminiFileService from '../services/geminiFileService';
import * as dbService from '../services/dbService';
import SpeakerWaveIcon from './icons/SpeakerWaveIcon';
import SpeakerXMarkIcon from './icons/SpeakerXMarkIcon';
import RefreshIcon from './icons/RefreshIcon';
import { GeminiFile, ContextDocument } from '../types';
import { log } from '../services/loggingService';
import BoldIcon from './icons/BoldIcon';
import ItalicIcon from './icons/ItalicIcon';
import ListBulletIcon from './icons/ListBulletIcon';
import ListNumberedIcon from './icons/ListNumberedIcon';
import ArrowsPointingOutIcon from './icons/ArrowsPointingOutIcon';
import ArrowsPointingInIcon from './icons/ArrowsPointingInIcon';
import ClipboardModernIcon from './icons/ClipboardModernIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import XMarkIcon from './icons/XMarkIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import { parseInternalFileName } from '../config/file_naming_config';

interface InspirationBase {
    id: string;
}
interface ImageInspiration extends InspirationBase {
    type: 'image';
    file: File;
    previewUrl: string;
    base64: string;
}
interface TextInspiration extends InspirationBase {
    type: 'text';
    text: string;
}
type Inspiration = ImageInspiration | TextInspiration;

interface GeneratedPost {
  id: string;
  quote: string | null;
  imageUrl: string | null;
  rawContent: string;
  isRegenerating: boolean;
  sources?: { uri: string; title: string }[];
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const RichTextToolbar: React.FC = () => {
    const applyStyle = (command: string) => {
        document.execCommand(command, false, undefined);
    };

    const ToolButton: React.FC<{ command: string, title: string, children: React.ReactNode }> = ({ command, title, children }) => (
        <button
            onClick={() => applyStyle(command)}
            className="p-1.5 text-gray-300 hover:bg-gray-600 hover:text-white rounded-md transition-colors"
            title={title}
            onMouseDown={e => e.preventDefault()} // Prevent editor from losing focus
        >
            {children}
        </button>
    );

    return (
        <div className="flex items-center gap-1 p-1 bg-gray-700 border-b border-gray-600 rounded-t-md">
            <ToolButton command="bold" title="Bold"><BoldIcon className="w-5 h-5" /></ToolButton>
            <ToolButton command="italic" title="Italic"><ItalicIcon className="w-5 h-5" /></ToolButton>
            <ToolButton command="insertUnorderedList" title="Bulleted List"><ListBulletIcon className="w-5 h-5" /></ToolButton>
            <ToolButton command="insertOrderedList" title="Numbered List"><ListNumberedIcon className="w-5 h-5" /></ToolButton>
        </div>
    );
};

const SocialPostAssistant: React.FC = () => {
    const [url, setUrl] = useState('');
    const [useCustomUrl, setUseCustomUrl] = useState(false);
    const [inspirations, setInspirations] = useState<Inspiration[]>([]);
    const [textInspirationInput, setTextInspirationInput] = useState('');
    const [venue, setVenue] = useState<string>('LinkedIn (Personal Feed)');
    const [postLength, setPostLength] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState('');
    const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
    const [speakingPostIndex, setSpeakingPostIndex] = useState<number | null>(null);
    const [activeProfiles, setActiveProfiles] = useState<Set<string>>(new Set(['Brand Voice', 'Author Persona']));
    const [regenModalState, setRegenModalState] = useState<{ isOpen: boolean; postIndex: number | null; feedback: string }>({ isOpen: false, postIndex: null, feedback: '' });
    const [maximizedPost, setMaximizedPost] = useState<{ post: GeneratedPost & { content: string }; index: number } | null>(null);
    const [copyStatus, setCopyStatus] = useState<Record<string, string>>({});
    const [fetchedUrlContent, setFetchedUrlContent] = useState<string | null>(null);
    
    // UTM Tagging State
    const [appendUtmTags, setAppendUtmTags] = useState(true);
    const [isUtmPanelOpen, setIsUtmPanelOpen] = useState(false);
    const [utmSource, setUtmSource] = useState('');
    const [utmMedium, setUtmMedium] = useState('web');
    const [utmCampaign, setUtmCampaign] = useState('');
    const [utmTerm, setUtmTerm] = useState('');
    const [utmContent, setUtmContent] = useState('');
    const [suppressWelcomePopup, setSuppressWelcomePopup] = useState(true);
    
    const { posts } = useContext(DataContext);
    const { modelConfig } = useContext(SettingsContext);
    const { contextDocuments } = useContext(ContentContext);
    const { contextFiles: geminiContextFiles } = useContext(GeminiCorpusContext);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const availablePosts = useMemo(() => {
        return posts.filter(p => p.type !== 'adhoc_email');
    }, [posts]);
    
    const relevantDocs = contextDocuments.filter(doc => {
        const parsed = parseInternalFileName(doc.id);
        if (!parsed) return false;
        return parsed.scope === 'global' || parsed.scope === 'spa';
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
        // This hook manages setting the default URL from the dropdown,
        // or clearing it when switching to custom URL mode.
        if (useCustomUrl) {
            setUrl('');
        } else if (availablePosts.length > 0 && !url) {
            setUrl(availablePosts[0].post_url);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useCustomUrl, availablePosts]); // Deliberately omitting `url` to fix a bug where typing in the custom field would trigger this effect and clear the input.
    
    useEffect(() => {
        // This hook sets the default post length when the component mounts or the venue changes.
        const config = VENUE_LENGTH_CONFIG[venue];
        if (config) {
            setPostLength(config.default);
        }
    }, [venue]);

    useEffect(() => {
        return () => { speechSynthesis.cancel(); };
    }, []);
    
    const slugify = (text: string) => {
        if (!text) return '';
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    };
    
    useEffect(() => {
        const utmConfig = VENUE_UTM_CONFIG[venue];
        if (!utmConfig) return;

        // Set non-campaign defaults from config
        setUtmSource(utmConfig.source);
        setUtmMedium(utmConfig.medium);
        setUtmTerm(utmConfig.term || '');
        setUtmContent(utmConfig.content || '');
        setSuppressWelcomePopup(utmConfig.showWelcomeOnShare);

        // Determine the campaign name with override logic
        const matchingPost = availablePosts.find(p => p.post_url === url);
        if (utmConfig.campaign) {
            // Use explicit override from config if it exists
            setUtmCampaign(utmConfig.campaign);
        } else if (!useCustomUrl && matchingPost) {
            // Use slug of article title for corpus posts
            setUtmCampaign(slugify(matchingPost.title));
        } else {
            // Use the fallback for custom URLs
            setUtmCampaign(utmConfig.defaultCampaignForCustomUrl);
        }
    }, [venue, url, useCustomUrl, availablePosts]);

    const handleImageUpload = useCallback(async (files: FileList | null) => {
        log.info('SocialPostAssistant: handleImageUpload triggered', { fileCount: files?.length });
        if (!files || files.length === 0) return;
        
        const newImageInspirations: ImageInspiration[] = [];
        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
        
        for (const file of Array.from(files)) {
            if (inspirations.length + newImageInspirations.length >= 10) {
                setError('You can add a maximum of 10 inspirations.');
                break;
            }
            if (!allowedTypes.includes(file.type)) {
                setError('Only PNG, JPEG, and WebP files are allowed.');
                continue;
            }
            const base64 = await fileToBase64(file);
            newImageInspirations.push({
                id: `${Date.now()}-${file.name}`,
                type: 'image',
                file,
                previewUrl: URL.createObjectURL(file),
                base64,
            });
        }
        setInspirations(prev => [...prev, ...newImageInspirations]);
        setError(null);
    }, [inspirations]);

    const handleAddTextInspiration = () => {
        if (!textInspirationInput.trim() || inspirations.length >= 10) {
            if (inspirations.length >= 10) {
                setError('You can add a maximum of 10 inspirations.');
            }
            return;
        }
        const newInspiration: TextInspiration = {
            id: `${Date.now()}-text`,
            type: 'text',
            text: textInspirationInput.trim(),
        };
        setInspirations(prev => [...prev, newInspiration]);
        setTextInspirationInput('');
        setError(null);
    };

    const handleRemoveInspiration = (id: string) => {
        setInspirations(prev => prev.filter(item => item.id !== id));
    };
    
    const callGeminiForPost = async (quote: string | null, feedback?: string, fetchedContent?: string | null, documentsForPrompt?: ContextDocument[]): Promise<GenerateContentResponse> => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const matchingPost = availablePosts.find(p => p.post_url === url);
        
        const lengthLabel = VENUE_LENGTH_CONFIG[venue]?.options.find(o => o.id === postLength)?.label || '';

        let contextFilesToInclude: GeminiFile[] = [];
        let brandContextString: string | undefined;

        if (documentsForPrompt && documentsForPrompt.length > 0) {
            const contextDocIds = new Set(documentsForPrompt.map(d => d.id));
            // FIX: Explicitly typed the parameter 'f' as GeminiFile to resolve type inference issues.
            const geminiFilesForPrompt = Array.from(geminiContextFiles.values()).filter((f: GeminiFile) => contextDocIds.has(f.displayName));

            if (geminiFilesForPrompt.length > 0) {
                contextFilesToInclude = geminiFilesForPrompt;
            } else {
                brandContextString = documentsForPrompt.map(doc => `--- Document: ${doc.id} ---\nClassification: ${doc.classification}\nSummary: ${doc.summary}\n\n${doc.content}`).join('\n\n---\n\n');
            }
        }

        if (useCustomUrl) {
            if (!fetchedContent) {
                throw new Error("Custom URL was selected, but no fetched content was provided.");
            }
            const { systemInstruction, userPrompt } = await AI_PROMPTS.getSocialPostPromptWithFetchedContent(venue, lengthLabel, fetchedContent, "From Custom URL", quote, url, brandContextString, feedback);
            const prompt = { model: modelConfig.model, contents: userPrompt, config: { systemInstruction, temperature: modelConfig.temperature, safetySettings: modelConfig.safetySettings } };
            return ai.models.generateContent(prompt);
        }
        
        // This path is for corpus posts only
        if (matchingPost) {
            const htmlPath = `posts/${matchingPost.post_id}.html`;
            const corpusFileRecord = await dbService.get<{ path: string, content: string }>('corpus_files', htmlPath);
            const postHtmlContent = corpusFileRecord ? corpusFileRecord.content : '';

            if (postHtmlContent) {
                const { systemInstruction, userPrompt, files } = await AI_PROMPTS.getSocialPostPromptWithFiles(venue, lengthLabel, contextFilesToInclude, postHtmlContent, matchingPost.title, quote, url, brandContextString, feedback);
                return geminiFileService.generateContentWithFiles(userPrompt, files, modelConfig, systemInstruction);
            } else {
                throw new Error(`Could not find HTML content for corpus post ID ${matchingPost.post_id}.`);
            }
        }
        
        throw new Error("No valid article source found (neither corpus nor custom URL content).");
    };

    const handleGenerate = async () => {
        log.info('SocialPostAssistant: handleGenerate triggered', { url, venue, useCustomUrl, activeProfiles });
        if (!url) {
            setError('Please select an article or enter a custom URL.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedPosts([]);
        setFetchedUrlContent(null);

        type GroundingSource = { uri: string; title: string };

        let currentFetchedContent: string | null = null;
        if (useCustomUrl) {
            try {
                setProgressMessage('Fetching URL content...');
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch URL. Status: ${response.status}`);
                }
                const htmlContent = await response.text();

                let textContent = '';
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');
                    const article = doc.querySelector('article');
                    const main = doc.querySelector('main');
                    const postBody = doc.querySelector('.post-content, .article-body, #content');

                    if (article) textContent = article.textContent || '';
                    else if (main) textContent = main.textContent || '';
                    else if (postBody) textContent = postBody.textContent || '';
                    else textContent = doc.body.textContent || '';

                } catch (parseError) {
                    log.error("DOM parsing failed, falling back to raw content.", parseError);
                    textContent = htmlContent;
                }
                
                currentFetchedContent = textContent.replace(/\s\s+/g, ' ').trim();
                setFetchedUrlContent(currentFetchedContent);
                
            } catch(e: any) {
                setError(`Failed to fetch content from URL: ${e.message}. Please check the URL and try again.`);
                setIsLoading(false);
                setProgressMessage('');
                return;
            }
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const itemsToProcess: { quote: string | null; imageUrl: string | null }[] = [];
            const imageInspirations = inspirations.filter((i): i is ImageInspiration => i.type === 'image');
            const textInspirations = inspirations.filter((i): i is TextInspiration => i.type === 'text');

            if (imageInspirations.length > 0) {
                setProgressMessage(`Extracting text from ${imageInspirations.length} image(s)...`);
                for (let i = 0; i < imageInspirations.length; i++) {
                    setProgressMessage(`Processing image ${i + 1} of ${imageInspirations.length}...`);
                    const inspiration = imageInspirations[i];
                    const imagePart = { inlineData: { mimeType: inspiration.file.type, data: inspiration.base64 } };
                    // FIX: Replaced incorrect function call getSystemInstruction() with direct property access.
                    const ocrSystemInstruction = AI_PROMPTS.OCR.SYSTEM_INSTRUCTION;
                    const ocrPrompt = { model: modelConfig.model, contents: { parts: [imagePart] }, config: { systemInstruction: ocrSystemInstruction, temperature: modelConfig.temperature } };
                    log.prompt('OCR Request', ocrPrompt);
                    const response = await ai.models.generateContent(ocrPrompt);
                    if (response.text) {
                        itemsToProcess.push({ quote: response.text.trim(), imageUrl: inspiration.previewUrl });
                    }
                }
            }

            // FIX: Replaced for...of loop with forEach to resolve iterator type error.
            textInspirations.forEach(inspiration => {
                itemsToProcess.push({ quote: inspiration.text, imageUrl: null });
            });
            
            const finalItems = itemsToProcess.length > 0 ? itemsToProcess : [{ quote: null, imageUrl: null }];
            const finalPosts: GeneratedPost[] = [];

            const documentsForPrompt = contextDocuments.filter(doc => {
                const parsed = parseInternalFileName(doc.id);
                if (!parsed) return false;

                // Global content from active profiles
                if (parsed.scope === 'global' && activeProfiles.has(doc.profile)) {
                    return true;
                }
                // Tool-specific instructions for this tool (spa)
                if (parsed.context === 'instrux' && parsed.scope === 'spa') {
                    return true;
                }
                // Tool-specific reference for this tool (spa) from active profiles
                if (parsed.context === 'reference' && parsed.scope === 'spa' && activeProfiles.has(doc.profile)) {
                    return true;
                }
                return false;
            });

            for (const [index, item] of finalItems.entries()) {
                setProgressMessage(finalItems.length > 1 ? `Generating post ${index + 1} of ${finalItems.length}` : 'Generating social post...');
                const response = await callGeminiForPost(item.quote, undefined, currentFetchedContent, documentsForPrompt);
                
                const content = response.text;
                const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
                const sources: GroundingSource[] | undefined = groundingChunks
                    ?.map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
                    .filter((s: any): s is GroundingSource => s !== null);

                finalPosts.push({
                    id: `${Date.now()}-${index}`,
                    quote: item.quote,
                    imageUrl: item.imageUrl,
                    rawContent: content,
                    sources: (sources && sources.length > 0) ? sources : undefined,
                    isRegenerating: false,
                });
            }
            setGeneratedPosts(finalPosts);

        } catch (e: any) {
            log.error(e);
            setError(e.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    };

    const processedPosts = useMemo(() => {
        if (!appendUtmTags) {
            return generatedPosts.map(p => ({ ...p, content: p.rawContent }));
        }

        const utmParams = new URLSearchParams();
        if (utmSource) utmParams.set('utm_source', utmSource);
        if (utmMedium) utmParams.set('utm_medium', utmMedium);
        if (utmCampaign) utmParams.set('utm_campaign', utmCampaign);
        if (utmTerm) utmParams.set('utm_term', utmTerm);
        if (utmContent) utmParams.set('utm_content', utmContent);
        if (suppressWelcomePopup) {
            utmParams.set('showWelcomeOnShare', 'false');
        }
        
        const utmString = utmParams.toString();

        if (!url || !utmString) {
            return generatedPosts.map(p => ({ ...p, content: p.rawContent }));
        }
        
        try {
            // Helper to escape characters for regex
            const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Prepare the URL for matching: normalize by removing protocol and trailing slash
            const cleanUrlForMatching = url.replace(/^(https?:\/\/)/, '').replace(/\/$/, '');
            const escapedUrl = escapeRegExp(cleanUrlForMatching);
            // This regex will match the URL with or without protocol, and with or without a trailing slash.
            // It will NOT match if the URL already has a query string. This prevents double-tagging.
            const urlRegex = new RegExp(`(https?:\/\/)?${escapedUrl}\\/?(?![?])`, 'g');
            
            // Construct the final URL with UTM tags, ensuring no double slash
            const taggedUrl = `${url.replace(/\/$/, '')}?${utmString}`;

            return generatedPosts.map(post => ({
                ...post,
                content: post.rawContent.replace(urlRegex, taggedUrl)
            }));
            
        } catch (e) {
            log.error("Failed to process UTM tags due to invalid URL:", url, e);
            return generatedPosts.map(p => ({ ...p, content: p.rawContent }));
        }

    }, [generatedPosts, appendUtmTags, utmSource, utmMedium, utmCampaign, utmTerm, utmContent, url, suppressWelcomePopup]);
    
    const handleReadAloud = useCallback((text: string, index: number) => {
        const plainText = new DOMParser().parseFromString(text, 'text/html').body.textContent || "";
        if (speakingPostIndex === index) {
            speechSynthesis.cancel();
            setSpeakingPostIndex(null);
        } else {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(plainText);
            utterance.onend = () => setSpeakingPostIndex(null);
            speechSynthesis.speak(utterance);
            setSpeakingPostIndex(index);
        }
    }, [speakingPostIndex]);
    
    const handleContentChange = (newContent: string, index: number) => {
        let newRawContent = newContent;
        if (url) {
            try {
                // This logic strips any UTM tags from the canonical URL before saving,
                // ensuring that if the user changes UTM parameters later, the old ones are not preserved.
                const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const cleanUrlForMatching = url.replace(/^(https?:\/\/)/, '').replace(/\/$/, '');
                const escapedUrl = escapeRegExp(cleanUrlForMatching);
                // Matches the URL with any potential query string
                const urlWithParamsRegex = new RegExp(`(https?:\/\/)?${escapedUrl}\\/?(\\?[^\\s<]*)?`, 'g');
                // Replace any found instance with just the clean canonical URL
                const canonicalUrl = url.replace(/\/$/, '');
                newRawContent = newContent.replace(urlWithParamsRegex, canonicalUrl);
            } catch(e) {
                log.error("Failed to strip UTMs from edited content:", e);
            }
        }
        setGeneratedPosts(prev => prev.map((p, i) => i === index ? { ...p, rawContent: newRawContent } : p));
    };


    const handleCopy = (event: React.MouseEvent<HTMLButtonElement>, postId: string) => {
        const contentElement = (event.currentTarget as HTMLElement).closest('.post-panel')?.querySelector('.editable-content');
        if (contentElement) {
            navigator.clipboard.writeText((contentElement as HTMLElement).innerText);
            setCopyStatus(prev => ({ ...prev, [postId]: 'Copied!' }));
            setTimeout(() => {
                setCopyStatus(prev => {
                    const newState = { ...prev };
                    delete newState[postId];
                    return newState;
                });
            }, 2000);
        }
    };

    const handleCopyRender = (event: React.MouseEvent<HTMLButtonElement>, postId: string) => {
        log.info('SocialPostAssistant: handleCopyRender triggered');
        const contentElement = (event.currentTarget as HTMLElement).closest('.post-panel')?.querySelector('.editable-content');
        if (!contentElement) return;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentElement.innerHTML;
        
        let renderedText = '';
        
        tempDiv.childNodes.forEach(node => {
            const trimmedText = node.textContent?.trim() || '';
            if (!trimmedText && node.nodeName !== 'P') return;

            if (node.nodeName === 'P') {
                renderedText += trimmedText + '\n\n';
            } else if (node.nodeName === 'UL') {
                const ul = node as HTMLUListElement;
                Array.from(ul.children).filter(child => child.tagName === 'LI').forEach(li => {
                    renderedText += `▶︎ ${li.textContent?.trim()}\n`;
                });
                renderedText += '\n';
            } else if (node.nodeName === 'OL') {
                const ol = node as HTMLOListElement;
                Array.from(ol.children).filter(child => child.tagName === 'LI').forEach((li, index) => {
                    renderedText += `${index + 1}. ${li.textContent?.trim()}\n`;
                });
                renderedText += '\n';
            } else {
                if(trimmedText) renderedText += trimmedText + '\n\n';
            }
        });
        
        renderedText = renderedText.replace(/\n{3,}/g, '\n\n').trim();

        navigator.clipboard.writeText(renderedText);

        setCopyStatus(prev => ({ ...prev, [`${postId}_render`]: 'Copied!' }));
        setTimeout(() => {
            setCopyStatus(prev => {
                const newState = { ...prev };
                delete newState[`${postId}_render`];
                return newState;
            });
        }, 2000);
    };
    
    const regeneratePost = async (index: number, feedback?: string) => {
        const postToRegen = generatedPosts[index];
        setGeneratedPosts(prev => prev.map((p, i) => i === index ? { ...p, isRegenerating: true } : p));
        try {
            const documentsForPrompt = contextDocuments.filter(doc => {
                const parsed = parseInternalFileName(doc.id);
                if (!parsed) return false;

                if (parsed.scope === 'global' && activeProfiles.has(doc.profile)) return true;
                if (parsed.context === 'instrux' && parsed.scope === 'spa') return true;
                if (parsed.context === 'reference' && parsed.scope === 'spa' && activeProfiles.has(doc.profile)) return true;
                
                return false;
            });
            const response = await callGeminiForPost(postToRegen.quote, feedback, useCustomUrl ? fetchedUrlContent : null, documentsForPrompt);
            const newContent = response.text;
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            const newSources: { uri: string; title: string }[] | undefined = groundingChunks
                ?.map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
                .filter((s: any): s is { uri: string; title: string } => s !== null);

            setGeneratedPosts(prev => prev.map((p, i) => i === index ? { ...p, rawContent: newContent, sources: (newSources && newSources.length > 0) ? newSources : undefined, isRegenerating: false } : p));
        } catch (e: any) {
            setError(`Failed to regenerate post #${index + 1}: ${e.message}`);
            setGeneratedPosts(prev => prev.map((p, i) => i === index ? { ...p, isRegenerating: false } : p));
        }
    };
    
    const handleConfirmRegenerate = async () => {
        const { postIndex, feedback } = regenModalState;
        if (postIndex === null) return;
        setRegenModalState({ isOpen: false, postIndex: null, feedback: '' });
        await regeneratePost(postIndex, feedback);
    };

    const handleRegenerateWithEmojis = async (index: number) => {
        await regeneratePost(index, "Please regenerate this post and add relevant emojis to make it more engaging.");
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Step 1: URL Input */}
            <div>
                <label htmlFor="substack-url" className="block text-sm font-medium text-gray-300 mb-2">Step 1: Select Post</label>
                <div className="flex items-start gap-4">
                    <div className="flex-grow">
                        {useCustomUrl ? (
                            <input
                                type="url" id="substack-url" value={url} onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://yourname.substack.com/p/your-post-title"
                                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 placeholder-gray-500"
                            />
                        ) : (
                            <select
                                id="substack-url" value={url} onChange={(e) => setUrl(e.target.value)}
                                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200"
                                disabled={availablePosts.length === 0}
                            >
                                {availablePosts.length > 0 ? (
                                    availablePosts.map(post => (
                                        <option key={post.post_id} value={post.post_url}>{new Date(post.post_date).toLocaleDateString()} - {post.title}</option>
                                    ))
                                ) : (<option>No articles found in corpus</option>)}
                            </select>
                        )}
                    </div>
                    <div className="w-44 flex-shrink-0 flex flex-col items-start gap-2 pt-1">
                        <div className="flex items-center">
                            <input
                                type="checkbox" id="custom-url-toggle" checked={useCustomUrl}
                                onChange={(e) => {
                                    setUseCustomUrl(e.target.checked);
                                    if (!e.target.checked) setFetchedUrlContent(null);
                                }}
                                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="custom-url-toggle" className="ml-2 text-sm text-gray-300 whitespace-nowrap">Use Custom URL</label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step 2: Inspirations Input */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Step 2: Add Inspirations (Optional, up to 10)</label>
                <p className="text-xs text-gray-400 mb-2">Add text ideas or upload images with quotes. A separate post will be generated for each inspiration.</p>
                
                <div className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={textInspirationInput}
                        onChange={(e) => setTextInspirationInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTextInspiration(); } }}
                        placeholder="Type an idea or quote..."
                        className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 placeholder-gray-500"
                    />
                    <button
                        onClick={handleAddTextInspiration}
                        disabled={!textInspirationInput.trim() || inspirations.length >= 10}
                        className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                        Add Idea
                    </button>
                </div>

                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={(e) => { e.preventDefault(); handleImageUpload(e.dataTransfer.files); }}
                    onDragOver={(e) => e.preventDefault()}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 border-gray-600 hover:border-gray-500"
                >
                    <input
                        ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => handleImageUpload(e.target.files)} className="hidden"
                    />
                     <p className="text-gray-300"><span className="font-semibold text-blue-400">Click to upload images</span> or drag and drop</p>
                </div>
                {inspirations.length > 0 && (
                    <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Inspirations Queue:</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                            {inspirations.map((item, index) => (
                                <div key={item.id} className="relative group bg-gray-800 rounded-md border border-gray-700">
                                    {item.type === 'image' ? (
                                        <img src={item.previewUrl} alt={`preview ${index}`} className="w-full h-auto object-cover rounded-md aspect-square" />
                                    ) : (
                                        <div className="text-gray-200 text-sm p-3 rounded-md aspect-square flex items-center justify-center text-center">
                                            <p className="line-clamp-5">"{item.text}"</p>
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => handleRemoveInspiration(item.id)}
                                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        title="Remove"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Step 3: Platform, Venue & Length */}
            <div>
                 <label className="block text-sm font-medium text-gray-300 mb-2">Step 3: Choose Platform & Post Length</label>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="venue" className="block text-xs font-medium text-gray-400 mb-1">Platform & Venue</label>
                        <select id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200">
                            <option value="Substack Notes">Substack Notes</option>
                            <option value="LinkedIn (Personal Feed)">LinkedIn (Personal Feed)</option>
                            <option value="LinkedIn (The Do Good by Doing Better Page)">LinkedIn (The Do Good by Doing Better Page)</option>
                            <option value="BlueSky (Personal Feed)">BlueSky (Personal Feed)</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="post-length" className="block text-xs font-medium text-gray-400 mb-1">Post Length</label>
                        <select id="post-length" value={postLength} onChange={(e) => setPostLength(e.target.value)} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200">
                            {VENUE_LENGTH_CONFIG[venue]?.options.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                 </div>
            </div>

            {/* UTM Tagging Section */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg">
                <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setIsUtmPanelOpen(prev => !prev)}>
                    <div className="flex items-center">
                        <input
                            type="checkbox" id="append-utm-toggle" checked={appendUtmTags}
                            onChange={(e) => setAppendUtmTags(e.target.checked)}
                            onClick={e => e.stopPropagation()} // Prevent click from bubbling to the parent div
                            className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="append-utm-toggle" className="ml-2 text-sm font-medium text-gray-200 cursor-pointer">Append UTM Tags to Link</label>
                    </div>
                    <button
                        aria-expanded={isUtmPanelOpen}
                        aria-controls="utm-panel"
                        className="p-1 text-gray-400 hover:text-white"
                        title={isUtmPanelOpen ? "Collapse" : "Expand"}
                    >
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
                        <div>
                            <label htmlFor="utm-campaign" className="block text-xs text-gray-400 mb-1">Campaign (utm_campaign)</label>
                            <input type="text" id="utm-campaign" value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                                <label htmlFor="utm-term" className="block text-xs text-gray-400 mb-1">Term (utm_term)</label>
                                <input type="text" id="utm-term" value={utmTerm} onChange={e => setUtmTerm(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
                            </div>
                            <div>
                                <label htmlFor="utm-content" className="block text-xs text-gray-400 mb-1">Content (utm_content)</label>
                                <input type="text" id="utm-content" value={utmContent} onChange={e => setUtmContent(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200"/>
                            </div>
                        </div>
                        <div className="pt-2">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="suppress-welcome-toggle"
                                    checked={suppressWelcomePopup}
                                    onChange={(e) => setSuppressWelcomePopup(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="suppress-welcome-toggle" className="ml-2 text-sm text-gray-300">
                                    Suppress Substack 'Welcome' popup
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Step 4: Options & Action */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                 <div>
                    <p className="text-sm font-medium text-gray-300 mb-2">Include Context Profiles:</p>
                     <div className="flex items-center gap-2 flex-wrap">
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
                     <p className="text-xs text-gray-400 mt-2">Enrich the prompt with documents for on-brand results. Tool-specific instructions are always included.</p>
                </div>
                <button
                    onClick={handleGenerate} disabled={isLoading || !url}
                    className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            {progressMessage || 'Generating...'}
                        </>
                    ) : 'Generate Social Posts'}
                </button>
            </div>
            
            {/* Results */}
            {error && <div className="p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-md">{error}</div>}
            
            {processedPosts.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-100">Generated Posts for {venue}:</h3>
                    {processedPosts.map((post, index) => (
                         <div key={post.id} className="post-panel bg-gray-900 border border-gray-700 rounded-lg p-4">
                             <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                                <div className="flex-1">
                                    <h4 className="font-semibold text-gray-300">Post #{index + 1}</h4>
                                    {post.quote && (
                                        <p className="text-xs italic text-gray-400 mt-1">
                                            Source: "{post.quote}"
                                        </p>
                                    )}
                                </div>
                                 <div className="flex items-center gap-2 flex-shrink-0">
                                     {/* FIX: Corrected the object structure passed to setMaximizedPost to match the state's type definition. */}
                                     <button onClick={() => setMaximizedPost({ post, index })} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1" title="Enlarge Editor"><ArrowsPointingOutIcon className="w-4 h-4" /></button>
                                     <button onClick={() => setRegenModalState({ isOpen: true, postIndex: index, feedback: '' })} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1" title="Regenerate this post"><RefreshIcon className="w-4 h-4" />Regen</button>
                                     <button onClick={() => handleRegenerateWithEmojis(index)} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors" title="Regenerate with Emojis">+ Emojis</button>
                                     <button onClick={() => handleReadAloud(post.content, index)} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1" title="Read post aloud">{speakingPostIndex === index ? <SpeakerXMarkIcon className="w-4 h-4" /> : <SpeakerWaveIcon className="w-4 h-4" />}</button>
                                     <button onClick={(e) => handleCopyRender(e, post.id)} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1" title="Copy as plain text with formatting">
                                        <ClipboardModernIcon className="w-4 h-4" />
                                        {copyStatus[`${post.id}_render`] || 'Copy/Render'}
                                      </button>
                                     <button onClick={(e) => handleCopy(e, post.id)} className="px-3 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1" title="Copy displayed text">
                                        <ClipboardIcon className="w-4 h-4" />
                                        {copyStatus[post.id] || 'Copy'}
                                      </button>
                                 </div>
                             </div>
                             <div className="flex gap-4 items-start">
                                {post.imageUrl && <div className="w-1/4 flex-shrink-0"><img src={post.imageUrl} alt={`Source for post ${index + 1}`} className="rounded-md w-full object-cover"/></div>}
                                <div className={`relative flex-1 ${post.isRegenerating ? 'opacity-50' : ''}`}>
                                    {post.isRegenerating && <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-md z-10"><svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>}
                                    <div>
                                         <RichTextToolbar />
                                         <div
                                             contentEditable={!post.isRegenerating}
                                             onBlur={(e) => handleContentChange(e.currentTarget.innerHTML, index)}
                                             suppressContentEditableWarning={true}
                                             className="editable-content w-full h-96 p-3 bg-gray-800 border border-gray-600 border-t-0 rounded-b-md overflow-y-auto prose prose-sm prose-invert max-w-none focus:ring-2 focus:ring-blue-500 focus:outline-none [&_ul]:list-disc [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:my-4 [&_ul]:pl-5 [&_ol]:pl-5"
                                             dangerouslySetInnerHTML={{ __html: post.content }}
                                         />
                                    </div>
                                </div>
                             </div>
                             {post.sources && post.sources.length > 0 && (
                                <div className="mt-4 border-t border-gray-700 pt-3">
                                    <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sources Used by AI</h5>
                                    <ul className="list-disc list-inside space-y-1">
                                        {post.sources.map((source, idx) => (
                                            <li key={idx} className="text-sm">
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all" title={source.uri}>
                                                    {source.title || source.uri}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                         </div>
                    ))}
                </div>
            )}

            {/* Regeneration Modal */}
            {regenModalState.isOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={() => setRegenModalState({ isOpen: false, postIndex: null, feedback: '' })}>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <header className="p-4 border-b border-gray-600">
                            <h3 className="text-lg font-bold text-gray-100">Regenerate Post #{regenModalState.postIndex !== null ? regenModalState.postIndex + 1 : ''}</h3>
                        </header>
                        <main className="p-6">
                            <label htmlFor="regen-feedback" className="block text-sm font-medium text-gray-300 mb-2">Provide feedback for improvement (optional):</label>
                            <textarea
                                id="regen-feedback"
                                value={regenModalState.feedback}
                                onChange={(e) => setRegenModalState(s => ({ ...s, feedback: e.target.value }))}
                                placeholder="e.g., Make it shorter, add more emojis, be more professional..."
                                rows={4}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 placeholder-gray-500"
                            />
                        </main>
                        <footer className="flex justify-end gap-4 p-4 bg-gray-900/50 border-t border-gray-700">
                            <button onClick={() => setRegenModalState({ isOpen: false, postIndex: null, feedback: '' })} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors">Cancel</button>
                            <button onClick={handleConfirmRegenerate} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors">Regenerate</button>
                        </footer>
                    </div>
                </div>
            )}
            
            {/* Maximized Editor Modal */}
            {maximizedPost && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4" onClick={() => setMaximizedPost(null)}>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <header className="p-3 border-b border-gray-600 flex justify-between items-center flex-shrink-0">
                            <h3 className="text-lg font-bold text-gray-100">Editing Post #{maximizedPost.index + 1}</h3>
                            <button onClick={() => setMaximizedPost(null)} className="p-1.5 text-gray-300 hover:bg-gray-600 hover:text-white rounded-md" title="Minimize">
                                <ArrowsPointingInIcon className="w-6 h-6" />
                            </button>
                        </header>
                        <main className="p-4 flex-1 flex flex-col min-h-0">
                             <RichTextToolbar />
                             <div
                                contentEditable
                                onBlur={(e) => handleContentChange(e.currentTarget.innerHTML, maximizedPost.index)}
                                suppressContentEditableWarning={true}
                                className="editable-content w-full flex-1 p-4 bg-gray-900 border border-gray-600 border-t-0 rounded-b-md overflow-y-auto prose prose-invert max-w-none focus:ring-2 focus:ring-blue-500 focus:outline-none [&_ul]:list-disc [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:my-4 [&_ul]:pl-5 [&_ol]:pl-5"
                                dangerouslySetInnerHTML={{ __html: maximizedPost.post.content }}
                            />
                        </main>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SocialPostAssistant;
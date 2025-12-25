import React, { useState, useCallback, useRef, useContext, useMemo, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { DataContext } from '../contexts/DataContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { ContentContext } from '../contexts/ContentContext';
import { geminiCorpusContext } from '../contexts/GeminiCorpusContext';
import { AI_PROMPTS } from '../services/promptService';
import { VENUE_LENGTH_CONFIG, VENUE_UTM_CONFIG } from '../config/social_post_config';
import * as geminiFileService from '../services/geminiFileService';
import * as dbService from '../services/dbService';
import SpeakerWaveIcon from './icons/SpeakerWaveIcon';
import SpeakerXMarkIcon from './icons/SpeakerXMarkIcon';
import RefreshIcon from './icons/RefreshIcon';
import { GeminiFile, ContextDocument, Inspiration, ImageInspiration, TextInspiration, GeneratedPost, ProcessedPost } from '../types';
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
import UrlInput from './social/UrlInput';
import InspirationsInput from './social/InspirationsInput';
import PlatformSettings from './social/PlatformSettings';
import UtmPanel from './shared/UtmPanel';
import ContextProfiles from './social/ContextProfiles';
import GeneratedPostCard from './social/GeneratedPostCard';
import RegenerationModal from './social/RegenerationModal';
import MaximizedEditorModal from './social/MaximizedEditorModal';

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
    const [fetchedUrlContent, setFetchedUrlContent] = useState<string | null>(null);
    
    // UTM Tagging State
    const [appendUtmTags, setAppendUtmTags] = useState(true);
    const [utmSource, setUtmSource] = useState('');
    const [utmMedium, setUtmMedium] = useState('web');
    const [utmCampaign, setUtmCampaign] = useState('');
    const [utmTerm, setUtmTerm] = useState('');
    const [utmContent, setUtmContent] = useState('');
    const [suppressWelcomePopup, setSuppressWelcomePopup] = useState(true);
    
    const { posts } = useContext(DataContext);
    const { modelConfig } = useContext(SettingsContext);
    const { contextDocuments } = useContext(ContentContext);
    const { contextFiles } = useContext(geminiCorpusContext);

    const geminiContextFiles = useMemo(() => {
        const context = new Map<string, GeminiFile>();
        for (const [key, file] of contextFiles.entries()) {
            if (file.context !== 'corpus') {
                context.set(key, file);
            }
        }
        return context;
    }, [contextFiles]);

    const availablePosts = useMemo(() => {
        return posts
            .filter(p => p.type !== 'adhoc_email')
            .sort((a, b) => new Date(b.post_date).getTime() - new Date(a.post_date).getTime());
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
    
    const callGeminiForPost = async (quote: string | null, feedback?: string, fetchedContent?: string | null, documentsForPrompt?: ContextDocument[]): Promise<GenerateContentResponse> => {
        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
        const matchingPost = availablePosts.find(p => p.post_url === url);
        
        const lengthLabel = VENUE_LENGTH_CONFIG[venue]?.options.find(o => o.id === postLength)?.label || '';

        let contextFilesToInclude: GeminiFile[] = [];
        let brandContextString: string | undefined;

        if (documentsForPrompt && documentsForPrompt.length > 0) {
            const contextDocIds = new Set(documentsForPrompt.map(d => d.id));
            // FIX: Explicitly typed the parameter 'f' as GeminiFile to resolve type inference issues.
            const geminiFilesForPrompt = Array.from(geminiContextFiles.values()).filter((f): f is GeminiFile => contextDocIds.has(f.displayName));

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
                const { systemInstruction, userPrompt, files, tempFiles } = await AI_PROMPTS.getSocialPostPromptWithFiles(venue, lengthLabel, contextFilesToInclude, postHtmlContent, matchingPost.title, quote, url, brandContextString, feedback);
                try {
                    return await geminiFileService.generateContentWithFiles(userPrompt, files, modelConfig, systemInstruction);
                } finally {
                    if (tempFiles?.length) {
                        log.info(`Cleaning up ${tempFiles.length} temporary file(s) from SocialPostAssistant.`);
                        await Promise.all(
                            tempFiles.map(file => geminiFileService.deleteFileFromApiOnly(file.name).catch(error => {
                                log.error(`Failed to clean up temp file "${file.name}".`, error);
                            }))
                        );
                    }
                }
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
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
            
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
                
                const content = response.text || '';
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


    const regeneratePost = async (index: number, feedback?: string) => {
        const postToRegen = generatedPosts[index];
        setGeneratedPosts(prev => prev.map((p, i) => i === index ? { ...p, isRegenerating: true } : p));
        try {
            const documentsForPrompt = contextDocuments.filter((doc: ContextDocument) => {
                const parsed = parseInternalFileName(doc.id);
                if (!parsed) return false;

                if (parsed.scope === 'global' && activeProfiles.has(doc.profile)) return true;
                if (parsed.context === 'instrux' && parsed.scope === 'spa') return true;
                if (parsed.context === 'reference' && parsed.scope === 'spa' && activeProfiles.has(doc.profile)) return true;
                
                return false;
            });
            const response = await callGeminiForPost(postToRegen.quote, feedback, useCustomUrl ? fetchedUrlContent : null, documentsForPrompt);
            const newContent = response.text || '';
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
            <UrlInput
                url={url}
                setUrl={setUrl}
                useCustomUrl={useCustomUrl}
                setUseCustomUrl={setUseCustomUrl}
                availablePosts={availablePosts}
                setFetchedUrlContent={setFetchedUrlContent}
            />

            <InspirationsInput
                inspirations={inspirations}
                setInspirations={setInspirations}
                textInspirationInput={textInspirationInput}
                setTextInspirationInput={setTextInspirationInput}
                error={error}
                setError={setError}
            />

            <PlatformSettings
                venue={venue}
                setVenue={setVenue}
                postLength={postLength}
                setPostLength={setPostLength}
            />

            <UtmPanel
                url={url}
                venue={venue}
                useCustomUrl={useCustomUrl}
                availablePosts={availablePosts}
                appendUtmTags={appendUtmTags}
                setAppendUtmTags={setAppendUtmTags}
                utmSource={utmSource}
                setUtmSource={setUtmSource}
                utmMedium={utmMedium}
                setUtmMedium={setUtmMedium}
                utmCampaign={utmCampaign}
                setUtmCampaign={setUtmCampaign}
                utmTerm={utmTerm}
                setUtmTerm={setUtmTerm}
                utmContent={utmContent}
                setUtmContent={setUtmContent}
                suppressWelcomePopup={suppressWelcomePopup}
                setSuppressWelcomePopup={setSuppressWelcomePopup}
            />
            
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                        <ContextProfiles
                            allContextDocuments={contextDocuments}
                            allFiles={geminiContextFiles}
                            activeProfiles={activeProfiles}
                            onProfileToggle={handleProfileToggle}
                            toolScope="spa"
                        />
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
            
            {error && <div className="p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-md">{error}</div>}
            
            {processedPosts.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-100">Generated Posts for {venue}:</h3>
                    {processedPosts.map((post, index) => (
                        <GeneratedPostCard
                            key={post.id}
                            post={post}
                            index={index}
                            speakingPostIndex={speakingPostIndex}
                            handleReadAloud={handleReadAloud}
                            handleContentChange={handleContentChange}
                            setMaximizedPost={setMaximizedPost}
                            setRegenModalState={setRegenModalState}
                            handleRegenerateWithEmojis={handleRegenerateWithEmojis}
                        />
                    ))}
                </div>
            )}

            <RegenerationModal
                isOpen={regenModalState.isOpen}
                postIndex={regenModalState.postIndex}
                feedback={regenModalState.feedback}
                setFeedback={(feedback) => setRegenModalState(s => ({ ...s, feedback }))}
                onConfirm={handleConfirmRegenerate}
                onCancel={() => setRegenModalState({ isOpen: false, postIndex: null, feedback: '' })}
            />
            
            {maximizedPost && (
                <MaximizedEditorModal
                    post={maximizedPost.post}
                    index={maximizedPost.index}
                    onClose={() => setMaximizedPost(null)}
                    onContentChange={handleContentChange}
                />
            )}
        </div>
    );
};

export default SocialPostAssistant;

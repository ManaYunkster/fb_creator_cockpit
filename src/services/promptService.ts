import { PromptTemplateDefinition, GeminiFile, ContextDocument, CallbackResult } from '../types';
import { SYSTEM_INSTRUCTIONS, USER_PROMPT_TEMPLATES } from '../config/prompts_config';
import { log } from './loggingService';
import { Type } from '@google/genai';
import * as geminiFileService from './geminiFileService';

const allPrompts: PromptTemplateDefinition[] = [
    ...Object.values(SYSTEM_INSTRUCTIONS),
    ...Object.values(USER_PROMPT_TEMPLATES),
];

const loadedPrompts = new Map<string, string>();
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initializes the prompt service by fetching all prompt templates from their external files.
 * This function should be called once on application startup. It is memoized to prevent re-fetching.
 */
export const initPrompts = (): Promise<void> => {
    if (isInitialized) {
        return Promise.resolve();
    }
    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        log.info('Initializing and loading all prompts...');
        const fetchPromises = allPrompts.map(async (prompt) => {
            try {
                const response = await fetch(prompt.filePath);
                if (!response.ok) throw new Error(`Failed to fetch prompt: ${prompt.filePath} (status: ${response.status})`);
                const content = await response.text();
                loadedPrompts.set(prompt.id, content);
            } catch (error) {
                log.error(`Error loading prompt ${prompt.id}:`, error);
                // Set a fallback content to avoid crashes in the UI
                loadedPrompts.set(prompt.id, `Error: Could not load prompt content from ${prompt.filePath}`);
            }
        });
        await Promise.all(fetchPromises);
        isInitialized = true;
        log.info(`Prompt service initialized. ${loadedPrompts.size} prompts loaded.`);
    })();
    
    return initPromise;
};

/**
 * Retrieves the content of a pre-loaded prompt template by its ID.
 * Throws an error if the service has not been initialized.
 * @param id The ID of the prompt template (e.g., 'SOCIAL_POST_SYSTEM_SUBSTACK').
 * @returns The string content of the prompt.
 */
export const getPromptContent = (id: string): string => {
    if (!isInitialized) {
        // This is a developer error, so we throw. The initPrompts() must be called first.
        throw new Error('Prompt service has not been initialized. Call initPrompts() on app startup.');
    }
    const content = loadedPrompts.get(id);
    if (!content) {
        log.error(`Prompt with ID "${id}" not found.`);
        return `Error: Prompt with ID "${id}" not found.`;
    }
    return content;
};

// ====================================================================================
// AI_PROMPTS OBJECT
// This object provides a structured way to get fully-formed prompts. It combines
// system instructions and user prompts, and interpolates dynamic data.
// ====================================================================================

const getSocialPostSystemInstruction = (venue: string): string => {
    switch (venue) {
        case 'Substack Notes':
            return getPromptContent(SYSTEM_INSTRUCTIONS.SOCIAL_POST_SUBSTACK.id);
        case 'LinkedIn (Personal Feed)':
            return getPromptContent(SYSTEM_INSTRUCTIONS.SOCIAL_POST_LINKEDIN_PERSONAL.id);
        case 'LinkedIn (The Do Good by Doing Better Page)':
            return getPromptContent(SYSTEM_INSTRUCTIONS.SOCIAL_POST_LINKEDIN_PAGE.id);
        case 'BlueSky (Personal Feed)':
            return getPromptContent(SYSTEM_INSTRUCTIONS.SOCIAL_POST_BLUESKY.id);
        default:
            return getPromptContent(SYSTEM_INSTRUCTIONS.SOCIAL_POST_LINKEDIN_PERSONAL.id);
    }
};

export const AI_PROMPTS = {
    CONTEXT_CLASSIFICATION: {
        get SYSTEM_INSTRUCTION() { return getPromptContent(SYSTEM_INSTRUCTIONS.CONTEXT_CLASSIFICATION.id); },
    },
    OCR: {
        get SYSTEM_INSTRUCTION() { return getPromptContent(SYSTEM_INSTRUCTIONS.OCR_SYSTEM.id); },
    },
    CHAT_SYSTEM_BASE: {
        getSystemInstruction: () => {
            return getPromptContent(SYSTEM_INSTRUCTIONS.CHAT_SYSTEM_BASE.id);
        }
    },
    getSocialPostPromptWithFetchedContent: async (venue: string, length: string, fetchedContent: string, articleTitle: string, quote: string | null, url: string, brandContext?: string, feedback?: string) => {
        const systemInstructionTemplate = getSocialPostSystemInstruction(venue);
        const systemInstruction = systemInstructionTemplate
            .replace('{{postLength}}', length)
            .replace('{{brandContextSection}}', brandContext ? `\n\n## Brand Context\n${brandContext}` : '');
        
        const userPromptTemplate = getPromptContent(USER_PROMPT_TEMPLATES.SOCIAL_POST_USER.id);
        const inspirationSection = quote ? `\n\n## INSPIRATION\nFocus the post on this quote/idea:\n<inspiration_quote>${quote}</inspiration_quote>` : '';
        const feedbackSection = feedback ? `\n\n## FEEDBACK\nPlease regenerate the post based on this feedback: "${feedback}"` : '';

        const userPrompt = userPromptTemplate
            .replace('{{venue}}', venue)
            .replace('{{articleTitle}}', articleTitle)
            .replace('{{url}}', url)
            .replace('{{fetchedContent}}', fetchedContent)
            .replace('{{inspirationSection}}', inspirationSection)
            .replace('{{feedbackSection}}', feedbackSection);

        return { systemInstruction, userPrompt };
    },
    getSocialPostPromptWithFiles: async (venue: string, length: string, contextFiles: GeminiFile[], postHtmlContent: string, articleTitle: string, quote: string | null, url: string, brandContext?: string, feedback?: string) => {
        const systemInstructionTemplate = getSocialPostSystemInstruction(venue);
        const systemInstruction = systemInstructionTemplate
            .replace('{{postLength}}', length)
            .replace('{{brandContextSection}}', brandContext ? `\n\n## Brand Context\n${brandContext}` : '');
        
        const userPromptTemplate = getPromptContent(USER_PROMPT_TEMPLATES.SOCIAL_POST_USER_WITH_FILES.id);
        const inspirationSection = quote ? `\n\n## INSPIRATION\nFocus the post on this quote/idea:\n<inspiration_quote>${quote}</inspiration_quote>` : '';
        const feedbackSection = feedback ? `\n\n## FEEDBACK\nPlease regenerate the post based on this feedback: "${feedback}"` : '';

        const userPrompt = userPromptTemplate
            .replace('{{venue}}', venue)
            .replace('{{articleTitle}}', articleTitle)
            .replace('{{url}}', url)
            .replace('{{inspirationSection}}', inspirationSection)
            .replace('{{feedbackSection}}', feedbackSection);

        // Verify all context files exist on the remote server before attaching them.
        log.info('Verifying remote existence of all context files before generating prompt...');
        const verifiedContextFiles = await Promise.all(
            contextFiles.map(file => geminiFileService.ensureRemoteFileExists(file))
        );
        log.info('All context files verified successfully.');

        const articleFile = new File([postHtmlContent], "article.html", { type: 'text/html' });
        const uploadedArticleFile = await geminiFileService.uploadFileToApiOnly(articleFile, { displayName: "article.html" });

        return { systemInstruction, userPrompt, files: [...verifiedContextFiles, uploadedArticleFile], tempFiles: [uploadedArticleFile] };
    },
    getQuoteFinderPrompt: (mode: 'quote' | 'callback', workingArticleContent: string, brandContext?: string) => {
        const systemInstructionTemplate = getPromptContent(mode === 'quote' ? SYSTEM_INSTRUCTIONS.QUOTE_FINDER_SYSTEM.id : SYSTEM_INSTRUCTIONS.QUOTE_FINDER_CALLBACK_SYSTEM.id);
        const systemInstruction = systemInstructionTemplate.replace('{{brandContextSection}}', brandContext ? `\n\n## Brand & Author Context\n${brandContext}` : '');

        const userPromptTemplate = getPromptContent(USER_PROMPT_TEMPLATES.QUOTE_FINDER_USER.id);
        const userPrompt = userPromptTemplate.replace('{{workingArticleContent}}', workingArticleContent);
        
        const schema = mode === 'quote' ? {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    topicHeader: { type: Type.STRING },
                    quote: { type: Type.STRING },
                    sourceTitle: { type: Type.STRING },
                    sourceUrl: { type: Type.STRING },
                    sourceDate: { type: Type.STRING },
                    whyItMatched: { type: Type.STRING },
                }
            }
        } : {
             type: Type.ARRAY,
             items: {
                type: Type.OBJECT,
                properties: {
                    topicHeader: { type: Type.STRING },
                    workingArticleAnchor: { type: Type.STRING },
                    precedingWorkingContext: { type: Type.STRING },
                    followingWorkingContext: { type: Type.STRING },
                    callbackSentence: { type: Type.STRING },
                    anchorQuote: { type: Type.STRING },
                    sourceTitle: { type: Type.STRING },
                    sourceUrl: { type: Type.STRING },
                    precedingContext: { type: Type.STRING },
                    followingContext: { type: Type.STRING },
                    whyItMatched: { type: Type.STRING },
                },
                propertyOrdering: [
                    "topicHeader",
                    "workingArticleAnchor",
                    "precedingWorkingContext",
                    "followingWorkingContext",
                    "callbackSentence",
                    "anchorQuote",
                    "sourceTitle",
                    "sourceUrl",
                    "precedingContext",
                    "followingContext",
                    "whyItMatched"
                ],
             }
        };

        return { systemInstruction, userPrompt, schema };
    },
     getQuoteFinderRegenPrompt: (originalResult: CallbackResult, brandContext?: string) => {
        const systemInstructionTemplate = getPromptContent(SYSTEM_INSTRUCTIONS.QUOTE_FINDER_REGEN_SYSTEM.id);
        const systemInstruction = systemInstructionTemplate.replace('{{brandContextSection}}', brandContext ? `\n\n## Brand & Author Context\n${brandContext}` : '');
        
        const userPromptTemplate = getPromptContent(USER_PROMPT_TEMPLATES.QUOTE_FINDER_REGEN_USER.id);
        const userPrompt = userPromptTemplate.replace('{{originalResult}}', JSON.stringify(originalResult, null, 2));

        const schema = {
            type: Type.OBJECT,
            properties: {
                newCallbackSentence: { type: Type.STRING }
            }
        };
        
        return { systemInstruction, userPrompt, schema };
    }
};

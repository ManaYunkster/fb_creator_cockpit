import { PromptTemplateDefinition } from '../types';

// ====================================================================================
// PROMPT DEFINITIONS
// These objects define the metadata for each prompt template stored in /src/prompts.
// The `content` is loaded dynamically at runtime by the promptService.
// ====================================================================================

export const SYSTEM_INSTRUCTIONS: Record<string, PromptTemplateDefinition> = {
    SOCIAL_POST_SUBSTACK: {
        id: 'SOCIAL_POST_SYSTEM_SUBSTACK',
        name: 'Social Post Generator (Substack Notes)',
        description: 'System instruction for generating posts for Substack Notes.',
        filePath: '/src/prompts/social_post_system_substack.md',
        type: 'SYSTEM_INSTRUCTION',
    },
    SOCIAL_POST_LINKEDIN_PERSONAL: {
        id: 'SOCIAL_POST_SYSTEM_LINKEDIN_PERSONAL',
        name: 'Social Post Generator (LinkedIn Personal)',
        description: 'System instruction for generating posts for a personal LinkedIn feed.',
        filePath: '/src/prompts/social_post_system_linkedin_personal.md',
        type: 'SYSTEM_INSTRUCTION',
    },
    SOCIAL_POST_LINKEDIN_PAGE: {
        id: 'SOCIAL_POST_SYSTEM_LINKEDIN_PAGE',
        name: 'Social Post Generator (LinkedIn Page)',
        description: 'System instruction for generating posts for a company/brand LinkedIn page.',
        filePath: '/src/prompts/social_post_system_linkedin_page.md',
        type: 'SYSTEM_INSTRUCTION',
    },
    SOCIAL_POST_BLUESKY: {
        id: 'SOCIAL_POST_SYSTEM_BLUESKY',
        name: 'Social Post Generator (BlueSky)',
        description: 'System instruction for generating posts for BlueSky.',
        filePath: '/src/prompts/social_post_system_bluesky.md',
        type: 'SYSTEM_INSTRUCTION',
    },
    CONTEXT_CLASSIFICATION: {
        id: 'CONTEXT_CLASSIFICATION_SYSTEM',
        name: 'Context Document Classifier',
        description: 'System instruction for classifying and summarizing context documents.',
        filePath: '/src/prompts/context_classification.md',
        type: 'SYSTEM_INSTRUCTION',
    },
    QUOTE_FINDER_SYSTEM: {
        id: 'QUOTE_FINDER_QUOTE_MODE_SYSTEM',
        name: 'Quote/Callback Finder System (Quote Mode)',
        description: 'System instruction for finding quotes in a corpus of articles.',
        filePath: '/src/prompts/quote_finder_quote_mode_system.md',
        type: 'SYSTEM_INSTRUCTION',
    },
     QUOTE_FINDER_CALLBACK_SYSTEM: {
        id: 'QUOTE_FINDER_CALLBACK_MODE_SYSTEM',
        name: 'Quote/Callback Finder System (Callback Mode)',
        description: 'System instruction for finding callback opportunities in a corpus of articles.',
        filePath: '/src/prompts/quote_finder_callback_mode_system.md',
        type: 'SYSTEM_INSTRUCTION',
    },
    QUOTE_FINDER_REGEN_SYSTEM: {
        id: 'QUOTE_FINDER_CALLBACK_REGEN_SYSTEM',
        name: 'Callback Regenerator System',
        description: 'System instruction for regenerating a callback sentence based on feedback.',
        filePath: '/src/prompts/quote_finder_callback_regen_system.md',
        type: 'SYSTEM_INSTRUCTION',
    },
    CHAT_SYSTEM_BASE: {
        id: 'CHAT_ASSISTANT_SYSTEM',
        name: 'Chat Assistant Base System',
        description: 'Base system instruction for the general-purpose chat assistant.',
        filePath: '/src/prompts/chat_assistant_system.md',
        type: 'SYSTEM_INSTRUCTION',
    },
    OCR_SYSTEM: {
        id: 'OCR_SYSTEM',
        name: 'Image OCR System',
        description: 'System instruction to perform Optical Character Recognition on an image.',
        filePath: '/src/prompts/ocr.md',
        type: 'SYSTEM_INSTRUCTION',
    },
};

export const USER_PROMPT_TEMPLATES: Record<string, PromptTemplateDefinition> = {
    SOCIAL_POST_USER: {
        id: 'SOCIAL_POST_USER',
        name: 'Social Post Generator (User)',
        description: 'User prompt for generating social media posts from an article.',
        filePath: '/src/prompts/social_post_user.md',
        type: 'USER_PROMPT',
    },
    SOCIAL_POST_USER_WITH_FILES: {
        id: 'SOCIAL_POST_USER_WITH_FILES',
        name: 'Social Post Generator (User, with files)',
        description: 'User prompt for generating social media posts from an article when files are attached.',
        filePath: '/src/prompts/social_post_user_with_files.md',
        type: 'USER_PROMPT',
    },
    QUOTE_FINDER_USER: {
        id: 'QUOTE_FINDER_USER',
        name: 'Quote Finder (User)',
        description: 'User prompt to find quotes or callbacks from a corpus.',
        filePath: '/src/prompts/quote_finder_user.md',
        type: 'USER_PROMPT',
    },
    QUOTE_FINDER_REGEN_USER: {
        id: 'QUOTE_FINDER_REGEN_USER',
        name: 'Callback Regenerator (User)',
        description: 'User prompt to regenerate a specific callback sentence.',
        filePath: '/src/prompts/quote_finder_regen_user.md',
        type: 'USER_PROMPT',
    },
};
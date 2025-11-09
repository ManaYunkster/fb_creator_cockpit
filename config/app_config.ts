// Application-level configuration.
// These are settings that are part of the core app and not meant for user editing.
import { HarmCategory, HarmBlockThreshold, LogLevelString, PreloadedAsset } from '../types';

export const APP_CONFIG = {
    VERSION: '1.9.0',
    BUILD: '20251109.1',
  DEFAULT_LOG_LEVEL: 'DEBUG' as LogLevelString,
  FOOTER_CREDIT: 'Created by Eric Duell',
  FOOTER_COPYRIGHT_LINE1: 'Copyright ©2025 Elucidate Ventures LLC',
  FOOTER_COPYRIGHT_LINE2: 'Made with 🩶 in Philadelphia',
  DEFAULT_MODEL_CONFIG: {
    // DO NOT CHANGE THE MODEL DEFAULT WITHOUT ASKING THE USER
    model: 'gemini-2.5-flash',
    thinkingMode: 'enabled' as 'enabled' | 'disabled',
    temperature: 0.8,
    thinkingBudget: 3000,
    useDynamicBudget: true,
    dynamicThinkingBudgetValue: -1,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ]
  },
  PRELOADED_ASSETS: [
    {
        key: 'corpus-zip',
        path: '/src/corpus_stage/corpus.zip',
        type: 'zip',
        loader: 'DataContext',
        loadOnStartup: true,
        required: false, // Not required, as it's a dev/testing convenience
    },
    {
        key: 'brand-brief',
        path: '/src/context_documents/__cc_content_global__brand-brief.md',
        type: 'markdown',
        loader: 'ContentContext',
        loadOnStartup: true,
        required: true,
    },
    {
        key: 'author-bio',
        path: '/src/context_documents/__cc_content_global__author-bio.md',
        type: 'markdown',
        loader: 'ContentContext',
        loadOnStartup: true,
        required: true,
    },
    {
        key: 'author-origin-story',
        path: '/src/context_documents/__cc_content_global__author-origin-story.md',
        type: 'markdown',
        loader: 'ContentContext',
        loadOnStartup: true,
        required: true,
    },
    {
        key: 'spa-instructions',
        path: '/src/context_documents/__cc_instrux_spa__instructions.md',
        type: 'markdown',
        loader: 'ContentContext',
        loadOnStartup: true,
        required: true,
    },
    {
        key: 'spa-writing-hooks',
        path: '/src/context_documents/__cc_reference_spa__writing-hooks.md',
        type: 'markdown',
        loader: 'ContentContext',
        loadOnStartup: true,
        required: true,
    },
  ] as PreloadedAsset[],
};

// Application-level configuration.
// These are settings that are part of the core app and not meant for user editing.
import { HarmCategory, HarmBlockThreshold, LogLevelString } from '../types';

export const APP_CONFIG = {
  VERSION: '1.4.3',
  BUILD: '20251021.3',
  DEFAULT_LOG_LEVEL: 'INFO' as LogLevelString,
  FOOTER_CREDIT: 'Created by Eric Duell',
  FOOTER_COPYRIGHT_LINE1: 'Copyright ©2025 Elucidate Ventures LLC',
  FOOTER_COPYRIGHT_LINE2: 'Made with 🩶 in Philadelphia',
  DEFAULT_MODEL_CONFIG: {
    // DO NOT CHANGE THE MODEL DEFAULT WITHOUT ASKING THE USER
    model: 'gemini-1.5-flash',
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
  }
};

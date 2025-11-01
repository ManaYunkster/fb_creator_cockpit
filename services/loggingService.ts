import { LogLevelString } from '../types';

let currentLevel: LogLevelString = 'INFO'; // Default level

/**
 * Sets the current logging level for the application.
 * This function is called by the SettingsContext when the user changes the level.
 * @param level The new logging level to set.
 */
export const setLogLevel = (level: LogLevelString) => {
    currentLevel = level;
    // Provide immediate feedback in the console when the level changes.
    console.log(`%c[Logger] Log level set to: ${level}`, 'color: yellow; font-weight: bold;');
};

/**
 * A global logging object with different methods for different types of logs.
 * Each method checks the `currentLevel` before printing to the console.
 */
export const log = {
    /**
     * For critical errors that should almost always be visible.
     * Visible in: ERROR, INFO, PROMPTS, DEBUG
     */
    error: (...args: any[]) => {
        if (['ERROR', 'INFO', 'PROMPTS', 'DEBUG'].includes(currentLevel)) {
            console.error('[ERROR]', ...args);
        }
    },
    /**
     * For general informational messages, similar to the old "detailed logging".
     * Visible in: INFO, PROMPTS, DEBUG
     */
    info: (...args: any[]) => {
        if (['INFO', 'PROMPTS', 'DEBUG'].includes(currentLevel)) {
            console.log('[INFO]', ...args);
        }
    },
    /**
     * Specifically for logging the full, constructed prompts sent to the AI.
     * Visible in: PROMPTS, DEBUG
     */
    prompt: (...args: any[]) => {
        if (['PROMPTS', 'DEBUG'].includes(currentLevel)) {
            // Using a distinct color to make prompts easy to spot in the console.
            console.log('%c[PROMPT]', 'color: cyan; font-weight: bold;', ...args);
        }
    },
    /**
     * For detailed debugging information, including full API responses.
     * Visible only in: DEBUG
     */
    debug: (...args: any[]) => {
        if (currentLevel === 'DEBUG') {
            // Using a distinct color to make debug logs easy to spot.
            console.log('%c[DEBUG]', 'color: magenta;', ...args);
        }
    },
};
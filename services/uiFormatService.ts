// services/uiFormatService.ts
import { ContextDocument, GeminiFile } from '../types';

/**
 * Strips the internal __cc_ prefix from a filename for display.
 * e.g., __cc_context_global_my-file.txt -> my-file.txt
 * @param name The full internal name of the file.
 * @returns The cleaned name for UI display.
 */
export const stripPrefix = (name: string | undefined): string => {
    if (!name) return '';
    // This regex is designed to be flexible and remove prefixes like:
    // __cc_context_global_
    // __cc_corpus_posts_
    // __cc_test_cache_
    const prefixRegex = /^__cc_[a-z]+_[a-z]+_/;
    return name.replace(prefixRegex, '');
};

/**
 * Generates a detailed tooltip for a context profile pill.
 * @param profileName The name of the profile (e.g., "Brand Voice").
 * @param allDocs The list of all relevant context documents for the tool.
 * @param allFiles The map of all synced Gemini files.
 * @returns A formatted string for use in a title attribute.
 */
export const generateProfileTooltip = (
    profileName: string, 
    allDocs: ContextDocument[], 
    allFiles: Map<string, GeminiFile>
): string => {
    const docsInProfile = allDocs.filter(doc => doc.profile === profileName);
    if (docsInProfile.length === 0) {
        return `Profile: ${profileName}\nNo documents found for this profile.`;
    }

    const fileDetails = docsInProfile.map(doc => {
        const geminiFile = allFiles.get(doc.id);
        const cleanName = stripPrefix(geminiFile?.cachedDisplayName || geminiFile?.displayName || doc.id);
        if (geminiFile) {
            return `- ${cleanName}\n  (API ID: ${geminiFile.name})`;
        }
        return `- ${cleanName} (Not synced)`;
    }).join('\n');

    return `Profile: ${profileName}\n\nFiles:\n${fileDetails}`;
};

/**
 * Formats a corpus filename for display as a pill.
 * e.g., all_posts.json -> All Posts (JSON)
 * @param fileName The full name of the corpus file.
 * @returns A formatted string for the pill label.
 */
export const formatCorpusPillName = (fileName: string): string => {
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

/**
 * Generates a simple tooltip for a corpus file pill.
 * @param file The GeminiFile object for the corpus file.
 * @returns A formatted string for use in a title attribute.
 */
export const generateCorpusTooltip = (file: GeminiFile | undefined): string => {
    if (!file) return 'File not found.';
    const cleanName = stripPrefix(file.cachedDisplayName || file.displayName);
    return `File: ${cleanName}\nAPI ID: ${file.name}`;
};

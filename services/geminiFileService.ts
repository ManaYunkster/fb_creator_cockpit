import { GoogleGenAI, GenerateContentResponse, GenerateContentParameters } from "@google/genai";
import { GeminiFile, AvailableModel, ModelConfig, FileContentRecord, CorpusSyncStatus } from '../types';
import { log } from './loggingService';
import { APP_CONFIG } from "../config/app_config";
import { parseInternalFileName } from '../config/file_naming_config';
import * as dbService from './dbService';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Stream Debug Wrapper ---
async function* logStreamWrapper(stream: AsyncIterable<GenerateContentResponse>, callName: string): AsyncIterable<GenerateContentResponse> {
    const chunks: GenerateContentResponse[] = [];
    let fullResponseText = '';
    for await (const chunk of stream) {
        chunks.push(chunk);
        fullResponseText += chunk.text;
        yield chunk;
    }
    log.debug(`${callName} full stream response (aggregated chunks):`, chunks);
    log.debug(`${callName} full stream response (aggregated text):`, fullResponseText);
}

// --- Error Formatting ---
const formatApiError = (error: any): string => {
    let message = 'An unexpected error occurred during the API call.';

    if (typeof error === 'string') {
        return error;
    }
    
    // Check for GoogleGenAIError structure, which is often nested
    const apiError = error?.error || error;

    if (apiError?.message) {
        message = apiError.message;
        const details: Record<string, any> = {
            'API Code': apiError.code,
            'Status': apiError.status,
            ...apiError.details,
        };
        const detailsString = Object.entries(details)
            .map(([key, value]) => (value !== undefined && value !== null ? `  • ${key}: ${value}` : null))
            .filter(Boolean)
            .join('\n');
        
        if (detailsString) {
            message += `\n\nDetails:\n${detailsString}`;
        }
    } else if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'object' && error !== null) {
        try {
            message = JSON.stringify(error, null, 2);
        } catch {
            // ignore stringify errors
        }
    }
    
    return message;
};


// --- Retry Logic ---

const isTransientError = (error: any): boolean => {
    // Check for 5xx server errors, rate limiting, or specific overload messages.
    if (error?.error?.code) { // For GoogleGenAIError structure
        const code = error.error.code;
        return code >= 500 || code === 429;
    }
    if (error?.message) { // For generic errors
        const message = error.message.toLowerCase();
        return message.includes('overloaded') || message.includes('unavailable') || message.includes('503');
    }
    return false;
};

const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 1000,
    backoffFactor = 2
): Promise<T> => {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            if (isTransientError(error)) {
                log.info(`Transient error detected (attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= backoffFactor;
            } else {
                // Not a transient error, fail fast.
                log.error('Non-transient error detected, failing fast.', error);
                throw error;
            }
        }
    }
    log.error(`All ${retries} retry attempts failed.`, lastError);
    throw new Error(lastError?.error?.message || lastError?.message || "All retries failed.");
};


// Local interface for the model structure from the REST API, updated to match full response
interface GeminiApiListedModel {
    name: string;
    version: string;
    displayName: string;
    description: string;
    inputTokenLimit: number;
    outputTokenLimit: number;
    supportedGenerationMethods: string[];
    temperature?: number;
    topP?: number;
    topK?: number;
    maxTemperature?: number;
    thinking?: boolean;
}

export const listModels = async (): Promise<AvailableModel[]> => {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error("API_KEY environment variable is not configured.");
        }
        
        const fetchFn = () => fetch(`https://generativelanguage.googleapis.com/v1/models`, {
            headers: { 'X-Goog-Api-Key': apiKey },
        });

        const response = await retryWithBackoff(fetchFn);

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const data = await response.json();
        log.debug('listModels API Response:', data);
        const models: GeminiApiListedModel[] = data.models || [];

        const availableModels: AvailableModel[] = models
            .filter(m => m.supportedGenerationMethods.includes('generateContent'))
            .map(m => {
                const shortName = m.name.replace('models/', '');
                return {
                    name: shortName,
                    displayName: m.displayName,
                    supportsThinking: m.thinking === true,
                };
            })
            .filter(m => m.name.startsWith('gemini'));

        if (availableModels.length === 0) {
            log.info('API returned no compatible models, using fallback list.');
            throw new Error("No compatible models found via API.");
        }
        
        log.info('Available Models from API:', availableModels);

        return availableModels;

    } catch (error) {
        log.error(`Error in geminiService.listModels:`, error);
        log.info('API call to list models failed. Falling back to default model list.');
        return [
            { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash (Default)', supportsThinking: true }
        ];
    }
};


const getMimeTypeFromFile = (file: File): string => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  // Special handling for .json files, per user instruction
  if (extension === 'json') {
      return 'text/plain';
  }

  if (file.type && file.type !== 'application/octet-stream') {
    return file.type;
  }
  
  const extensionMap: Record<string, string> = {
    'jsonl': 'application/json', 'wav': 'audio/wav', 'mp3': 'audio/mp3', 'aiff': 'audio/aiff',
    'aac': 'audio/aac', 'ogg': 'audio/ogg', 'flac': 'audio/flac', 'png': 'image/png',
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp', 'heic': 'image/heic',
    'heif': 'image/heif', 'gif': 'image/gif', 'svg': 'image/svg+xml', 'tiff': 'image/tiff',
    'psd': 'application/x-photoshop', 'mp4': 'video/mp4', 'mpeg': 'video/mpeg', 'mov': 'video/mov',
    'avi': 'video/avi', 'flv': 'video/x-flv', 'mpg': 'video/mpg', 'webm': 'video/webm',
    'wmv': 'video/wmv', '3gp': 'video/3gpp', 'txt': 'text/plain', 'html': 'text/html',
    'css': 'text/css', 'js': 'text/javascript', 'ts': 'text/x-typescript', 'csv': 'text/csv',
    'md': 'text/markdown', 'py': 'text/x-python', 'xml': 'text/xml',
    'rtf': 'application/rtf', 'pdf': 'application/pdf', 'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'eps': 'application/postscript', 'dxf': 'application/dxf', 'ttf': 'font/ttf',
  };

  if (extension && extensionMap[extension]) {
    return extensionMap[extension];
  }
  
  return 'application/octet-stream';
};

export const registerLocalFile = async (internalName: string, originalName: string, file: File): Promise<void> => {
    log.info('geminiFileService.registerLocalFile', { internalName, originalName });
    try {
        const content = await file.arrayBuffer().then(buffer => new Blob([buffer], { type: file.type }));
        const correctMimeType = getMimeTypeFromFile(file);
        
        const contentRecord: FileContentRecord = {
            internalName,
            content,
            mimeType: correctMimeType,
            name: originalName,
            type: correctMimeType, // FIX: Use the determined MIME type
            modified: file.lastModified,
        };
        await dbService.put('file_contents', contentRecord);

        const preliminaryFile: Partial<GeminiFile> = {
            name: `local/${internalName}`,
            displayName: internalName,
            cachedDisplayName: originalName,
            mimeType: contentRecord.mimeType,
            sizeBytes: file.size.toString(),
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
        };
        await dbService.put('files', preliminaryFile);
        
        log.info(`Successfully registered "${originalName}" locally as "${internalName}".`);
    } catch (error) {
        log.error('Error in geminiFileService.registerLocalFile:', error);
        throw new Error(`Failed to register local file "${originalName}".`);
    }
};

interface UploadOptions {
  displayName?: string;
  mimeType?: string;
  cacheAs?: string;
}

export const uploadFileToCorpus = async (
  file: File,
  displayName: string
): Promise<GeminiFile> => {
  log.info('geminiService.uploadFileToCorpus', { file, displayName });

  if (!file || file.size === 0) {
    const errorMessage = `Skipping upload of empty file: ${displayName}`;
    log.error(errorMessage);
    throw new Error(errorMessage); 
  }

  try {
    const mimeType = getMimeTypeFromFile(file);
    log.info('Determined MIME Type:', mimeType);
    
    // The API requires the file name in the File object to not be the full path.
    const fileToUpload = new File([await file.arrayBuffer()], displayName, { type: mimeType });
    
    const uploadFn = () => ai.files.upload({
        file: fileToUpload,
        config: {
            displayName: displayName,
            // mimeType is inferred from the File object, but we can specify it
        }
    });
    const response = await retryWithBackoff(uploadFn);

    if (!response) {
      log.error('File upload failed. API response was empty or malformed.', response);
      throw new Error('File upload failed. The API response was unexpected.');
    }
    
    log.debug('uploadFile API Response:', response);
    const uploaded = response as GeminiFile;
    
    // The displayName is not automatically set in the response, so we set it manually.
    uploaded.displayName = displayName;

    // Cache the fully resolved file details from the API response
    await dbService.put('files', uploaded);

    // Clean up the temporary local record
    await dbService.del('files', `local/${displayName}`).catch(() => {});

    log.info(`Uploaded file "${fileToUpload.name}" to API, and updated/created DB record.`);

    return uploaded;
  } catch (error) {
    log.error(`Error in geminiService.uploadFileToCorpus:`, error);
    throw new Error(formatApiError(error));
  }
};

export const uploadFileToApiOnly = async (
  file: File,
  options: { displayName?: string } = {}
): Promise<GeminiFile> => {
  log.info('geminiService.uploadFileToApiOnly', { file, options });

  const finalDisplayName = options.displayName || file.name;
  if (!file || file.size === 0) {
    const errorMessage = `Skipping API-only upload of empty file: ${finalDisplayName}`;
    log.error(errorMessage);
    throw new Error(errorMessage);
  }

  try {
    const mimeType = getMimeTypeFromFile(file);
    const fileToUpload = new File([await file.arrayBuffer()], finalDisplayName, { type: mimeType });
    
    const uploadFn = () => ai.files.upload({
        file: fileToUpload,
        config: {
            displayName: finalDisplayName,
        }
    });
    const response = await retryWithBackoff(uploadFn);

    if (!response) {
      log.error('File upload failed. API response was empty or malformed.', response);
      throw new Error('File upload failed. The API response was unexpected.');
    }
    
    log.debug('uploadFileToApiOnly API Response:', response);
    const uploaded = response as GeminiFile;
    
    // Manually add the intended displayName for consistency.
    uploaded.displayName = finalDisplayName;
    uploaded.cachedDisplayName = finalDisplayName; // For API only, the display name is the cache name
    
    return uploaded;
  } catch (error) {
    log.error(`Error in geminiService.uploadFileToApiOnly:`, error);
    throw new Error(formatApiError(error));
  }
};

export const processFileMetadata = async (file: GeminiFile, cachedFile?: GeminiFile | null): Promise<GeminiFile> => {
    // Attempt to get a more complete local version of the file first.
    const localCache = cachedFile || await dbService.get<GeminiFile>('files', file.name);

    const processedFile = { ...file };

    // Restore cached display name if it exists
    if (localCache?.cachedDisplayName) {
        processedFile.cachedDisplayName = localCache.cachedDisplayName;
        processedFile.isDisplayNameCached = true;
    }

    // Attempt to parse internal naming convention
    const parsed = parseInternalFileName(processedFile.displayName);
    if (parsed) {
        processedFile.context = parsed.context;
        processedFile.scope = parsed.scope;
        // If we don't have a cached friendly name, use the one from the file name.
        if (!processedFile.cachedDisplayName) {
            processedFile.cachedDisplayName = parsed.originalName;
        }
    }

    return processedFile;
};


export const listGeminiFiles = async (): Promise<GeminiFile[]> => {
    log.info('geminiService.listGeminiFiles (raw)');
    try {
        const allFiles: GeminiFile[] = [];
        const pager = await retryWithBackoff(() => ai.files.list());

        // The pager is an async iterator
        for await (const file of pager as AsyncIterable<GeminiFile>) {
            allFiles.push(file);
        }
        
        log.debug('listGeminiFiles API Response (raw):', allFiles);
        return allFiles;
    } catch (error) {
        log.error(`Error in geminiService.listGeminiFiles:`, error);
        throw new Error("Failed to list files from API. Check your API key and permissions.");
    }
};

export const loadFilesFromCache = async (): Promise<Map<string, GeminiFile>> => {
    log.info('geminiService.loadFilesFromCache');
    try {
        const allFilesFromDb = await dbService.getAll<GeminiFile>('files');
        const processedFiles = await Promise.all(allFilesFromDb.map(file => processFileMetadata(file)));
        const fileMap = new Map(processedFiles.map(f => [f.displayName, f]));
        log.info(`Loaded ${fileMap.size} files from DB cache.`);
        return fileMap;
    } catch (error) {
        log.error(`Error in geminiService.loadFilesFromCache:`, error);
        return new Map();
    }
};

export const cacheFiles = async (files: Map<string, GeminiFile>): Promise<void> => {
    log.info(`geminiService.cacheFiles: Caching ${files.size} files.`);
    try {
        const fileList = Array.from(files.values());
        await dbService.bulkPut('files', fileList);
        log.info('Successfully cached files to IndexedDB.');
    } catch (error) {
        log.error('Error in geminiService.cacheFiles:', error);
    }
};

export const getFile = async (name: string): Promise<GeminiFile> => {
  log.info('geminiService.getFile', { name });
  try {
    const getFn = () => ai.files.get({ name });
    const file = await retryWithBackoff(getFn) as GeminiFile;
    
    log.debug('getFile API Response:', file);
    const processedFile = await processFileMetadata(file);

    log.info('File Details (after name mapping):', processedFile);

    return processedFile;
  } catch (error) {
    log.error(`Error in geminiService.getFile for ${name}:`, error);
    throw new Error(`Failed to get file details for ${name}.`);
  }
};

export const deleteFileFromApiOnly = async (name: string): Promise<void> => {
    log.info('geminiFileService.deleteFileFromApiOnly', { name });
    try {
        const deleteFn = () => ai.files.delete({ name });
        await retryWithBackoff(deleteFn);
        log.info(`File "${name}" deleted successfully from API.`);
    } catch (error) {
        log.error(`Error in geminiFileService.deleteFileFromApiOnly for ${name}:`, error);
        throw new Error(formatApiError(error));
    }
};

export const deleteLocalFile = async (internalName: string): Promise<void> => {
    log.info('geminiFileService.deleteLocalFile', { internalName });
    try {
        // The name in the 'files' store could be `local/some-name` for unsynced files,
        // or `files/some-name` for synced files.
        const internalOnlyName = internalName.startsWith('local/') 
            ? internalName.replace('local/', '')
            : internalName;

        await dbService.del('files', internalName); // Delete the main metadata record
        await dbService.del('file_contents', internalOnlyName); // Delete the content
        log.info(`Successfully deleted local file record for "${internalName}" and its content for "${internalOnlyName}".`);
    } catch (error) {
        log.error('Error in geminiFileService.deleteLocalFile:', error);
        throw new Error(`Failed to delete local file "${internalName}".`);
    }
};

export const deleteFileFromCorpus = async (name: string): Promise<void> => {
    log.info('geminiService.deleteFileFromCorpus', { name });
    try {
        const deleteFn = () => ai.files.delete({ name });
        await retryWithBackoff(deleteFn);
        log.info(`File "${name}" deleted successfully from API.`);
        
        // Also remove from our local cache
        await dbService.del('files', name);
        log.info(`File record for "${name}" also deleted from local DB.`);

    } catch (error) {
        log.error(`Error in geminiService.deleteFileFromCorpus for ${name}:`, error);
        throw new Error(formatApiError(error)); // Re-throw formatted error
    }
};

export const generateContent = async (
  request: GenerateContentParameters
): Promise<GenerateContentResponse> => {
  log.prompt('geminiService.generateContent', request);

  try {
    const generateFn = () => ai.models.generateContent(request);
    const response = await retryWithBackoff(generateFn);
    log.debug('generateContent API Response:', response);

    const typedResponse = response as GenerateContentResponse;
    if (typedResponse.promptFeedback?.blockReason) {
        throw new Error(`Response was blocked due to safety settings: ${typedResponse.promptFeedback.blockReason}. Please adjust settings or your prompt.`);
    }

    return typedResponse;
  } catch (error) {
    log.error(`Error in geminiService.generateContent:`, error);
    throw new Error("Failed to get a response from the model.");
  }
};


export const generateContentWithFiles = async (
  prompt: string,
  files: GeminiFile[],
  modelConfig: ModelConfig,
  systemInstruction: string
): Promise<GenerateContentResponse> => {
  // Construct the request parts, including file data
  const fileParts = files.map(file => ({
    fileData: { 
        fileUri: file.uri,
        mimeType: file.mimeType,
    },
  }));
  const textPart = { text: prompt };
  const contents = { parts: [textPart, ...fileParts] };
  
  // Define generation config based on model capabilities and user settings
  const generateContentConfig: any = {
      temperature: modelConfig.temperature,
      systemInstruction,
      safetySettings: modelConfig.safetySettings,
  };
  
  const requestPayload = {
      model: modelConfig.model,
      contents,
      config: generateContentConfig
  };

  log.prompt('geminiService.generateContentWithFiles', requestPayload);

  try {
    const generateFn = () => ai.models.generateContent(requestPayload);
    const response = await retryWithBackoff(generateFn);
    log.debug('generateContentWithFiles API Response:', response);
    
    const typedResponse = response as GenerateContentResponse;
    if (typedResponse.promptFeedback?.blockReason) {
        throw new Error(`Response was blocked due to safety settings: ${typedResponse.promptFeedback.blockReason}. Please adjust settings or your prompt.`);
    }

    return typedResponse;
  } catch (error) {
    log.error(`Error in geminiService.generateContentWithFiles:`, error);
    throw new Error("Failed to get a response from the model.");
  }
};

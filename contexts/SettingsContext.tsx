import React, { createContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { APP_CONFIG } from '../config/app_config';
import { ModelConfig, AvailableModel, LogLevelString } from '../types';
import * as geminiFileService from '../services/geminiFileService';
import { setLogLevel as configureLogger } from '../services/loggingService';

interface SettingsContextType {
    logLevel: LogLevelString;
    handleSetLogLevel: (level: LogLevelString) => void;
    modelConfig: ModelConfig;
    setModelConfig: React.Dispatch<React.SetStateAction<ModelConfig>>;
    availableModels: AvailableModel[];
    isLoadingModels: boolean;
}

export const SettingsContext = createContext<SettingsContextType>({
    logLevel: 'INFO',
    handleSetLogLevel: () => {},
    modelConfig: APP_CONFIG.DEFAULT_MODEL_CONFIG,
    setModelConfig: () => {},
    availableModels: [],
    isLoadingModels: true,
});

interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [logLevel, setLogLevelState] = useState<LogLevelString>(() => {
        try {
            const item = window.localStorage.getItem('logLevel');
            return item ? (item as LogLevelString) : 'INFO';
        } catch (error) {
            console.error('Error reading logLevel from localStorage', error);
            return 'INFO';
        }
    });
    
    const [modelConfig, setModelConfig] = useState<ModelConfig>(() => {
        try {
            const item = window.localStorage.getItem('modelConfig');
            if (item) {
                const storedConfig = JSON.parse(item);
                return { ...APP_CONFIG.DEFAULT_MODEL_CONFIG, ...storedConfig };
            }
            return APP_CONFIG.DEFAULT_MODEL_CONFIG;
        } catch (error) {
            console.error('Error reading modelConfig from localStorage', error);
            return APP_CONFIG.DEFAULT_MODEL_CONFIG;
        }
    });
    
    const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(true);

    useEffect(() => {
        try {
            window.localStorage.setItem('logLevel', logLevel);
            configureLogger(logLevel); // Configure the global logger whenever the level changes
        } catch (error) {
            console.error('Error writing logLevel to localStorage', error);
        }
    }, [logLevel]);
    
    useEffect(() => {
        try {
            window.localStorage.setItem('modelConfig', JSON.stringify(modelConfig));
        } catch (error) {
            console.error('Error writing modelConfig to localStorage', error);
        }
    }, [modelConfig]);

    const handleSetLogLevel = (level: LogLevelString) => {
        setLogLevelState(level);
    };

    useEffect(() => {
        // Set the initial log level for the service on app load
        configureLogger(logLevel);
        
        const fetchAndSetModels = async () => {
            setIsLoadingModels(true);
            try {
                const models = await geminiFileService.listModels();
                setAvailableModels(models);

                if (models.length > 0) {
                    const currentModelIsValid = models.some(m => m.name === modelConfig.model);
                    if (!currentModelIsValid) {
                        const newModel = models.find(m => m.name === APP_CONFIG.DEFAULT_MODEL_CONFIG.model) || models[0];
                        setModelConfig(prev => ({
                            ...prev,
                            model: newModel.name,
                            thinkingMode: newModel.supportsThinking ? prev.thinkingMode : 'disabled'
                        }));
                    }
                }
            } catch (error) {
                console.error("Failed to fetch available models:", error);
                const fallbackModels = [{ name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash (Default)', supportsThinking: true }];
                setAvailableModels(fallbackModels);
            } finally {
                setIsLoadingModels(false);
            }
        };
        fetchAndSetModels();
    }, []); // Removed modelConfig.model dependency to prevent re-fetching on every model change
    
    const value = useMemo(() => ({
        logLevel,
        handleSetLogLevel,
        modelConfig,
        setModelConfig,
        availableModels,
        isLoadingModels,
    }), [logLevel, handleSetLogLevel, modelConfig, setModelConfig, availableModels, isLoadingModels]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

export default SettingsProvider;

import React, { useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';
import { log } from '../services/loggingService';
import { HarmCategory, HarmBlockThreshold } from '../types';

interface GlobalSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalSettingsPanel: React.FC<GlobalSettingsPanelProps> = ({ isOpen, onClose }) => {
    const {
        modelConfig,
        setModelConfig,
        availableModels,
        isLoadingModels,
    } = useContext(SettingsContext);

    if (!isOpen) return null;

    const handleModelChange = (newModelName: string) => {
        log.info('GlobalSettingsPanel: handleModelChange', { newModelName });
        const selectedModel = availableModels.find(m => m.name === newModelName);
        setModelConfig(prev => ({
            ...prev,
            model: newModelName,
            thinkingMode: selectedModel?.supportsThinking ? prev.thinkingMode : 'disabled',
        }));
    };
    
    const handleSafetyChange = (category: HarmCategory, threshold: HarmBlockThreshold) => {
        setModelConfig(prev => ({
            ...prev,
            safetySettings: (prev.safetySettings || []).map(setting => 
                setting.category === category ? { ...setting, threshold } : setting
            )
        }));
    };

    const currentSelectedModel = availableModels.find(m => m.name === modelConfig.model);
    
    const categoryLabels: Record<HarmCategory, string> = {
        [HarmCategory.HARM_CATEGORY_HARASSMENT]: 'Harassment',
        [HarmCategory.HARM_CATEGORY_HATE_SPEECH]: 'Hate Speech',
        [HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT]: 'Sexually Explicit',
        [HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT]: 'Dangerous Content',
    };
    const thresholdOptions = [
        { value: HarmBlockThreshold.BLOCK_NONE, label: 'Block None' },
        { value: HarmBlockThreshold.BLOCK_ONLY_HIGH, label: 'Block High Severity Only' },
        { value: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE, label: 'Block Low Severity & Above' },
        { value: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, label: 'Block Medium Severity & Above (Default)' },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-600">
                    <h3 className="text-lg font-bold text-gray-100">Global AI Settings</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                </header>
                <main className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    {/* Left Column: Performance Settings */}
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="model-select" className="block text-sm font-medium text-gray-300 mb-2">Default Model</label>
                            <select
                                id="model-select"
                                value={modelConfig.model}
                                onChange={e => handleModelChange(e.target.value)}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-gray-200 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                disabled={isLoadingModels || availableModels.length === 0}
                            >
                                {isLoadingModels ? (
                                    <option>Loading models...</option>
                                ) : (
                                    availableModels.map(model => (
                                        <option key={model.name} value={model.name}>{model.displayName}</option>
                                    ))
                                )}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">This model will be used by default for all AI tasks.</p>
                        </div>

                        <div>
                            <label htmlFor="thinking-mode" className="block text-sm font-medium text-gray-300 mb-2">Thinking Mode</label>
                            <select 
                                id="thinking-mode" 
                                value={modelConfig.thinkingMode} 
                                onChange={e => setModelConfig(c => ({...c, thinkingMode: e.target.value as 'enabled' | 'disabled'}))} 
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-gray-200 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!currentSelectedModel?.supportsThinking}
                            >
                                <option value="enabled">Enabled (High Quality)</option>
                                <option value="disabled">Disabled (Low Latency)</option>
                            </select>
                            {!currentSelectedModel?.supportsThinking && <p className="text-xs text-yellow-400 mt-1">This model does not support the "Thinking" feature.</p>}
                        </div>

                        {currentSelectedModel?.supportsThinking && modelConfig.thinkingMode === 'enabled' && (
                            <div className="space-y-4">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="dynamic-budget-toggle"
                                        checked={modelConfig.useDynamicBudget}
                                        onChange={(e) => setModelConfig(c => ({ ...c, useDynamicBudget: e.target.checked }))}
                                        className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="dynamic-budget-toggle" className="ml-2 text-sm font-medium text-gray-300">
                                        Dynamic Budget
                                    </label>
                                </div>
                                <div>
                                    <label htmlFor="thinking-budget" className={`flex justify-between items-center text-sm font-medium mb-2 transition-colors ${modelConfig.useDynamicBudget ? 'text-gray-500' : 'text-gray-300'}`}>
                                        <span>Thinking Budget</span>
                                        <input
                                            type="number"
                                            value={modelConfig.thinkingBudget}
                                            onChange={e => setModelConfig(c => ({ ...c, thinkingBudget: parseInt(e.target.value, 10) || 0 }))}
                                            className="w-20 bg-gray-900 border border-gray-600 text-center text-sm p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            min="0"
                                            max="8192"
                                            disabled={modelConfig.useDynamicBudget}
                                        />
                                    </label>
                                    <input
                                        id="thinking-budget"
                                        type="range"
                                        min="0"
                                        max="8192"
                                        step="10"
                                        value={modelConfig.thinkingBudget}
                                        onChange={e => setModelConfig(c => ({...c, thinkingBudget: parseInt(e.target.value, 10)}))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={modelConfig.useDynamicBudget}
                                    />
                                </div>
                            </div>
                        )}
                        
                        <div>
                            <label htmlFor="temperature" className="flex justify-between text-sm font-medium text-gray-300 mb-2">
                                <span>Temperature (Creativity)</span>
                                <span>{modelConfig.temperature.toFixed(1)}</span>
                            </label>
                            <input id="temperature" type="range" min="0" max="1" step="0.1" value={modelConfig.temperature} onChange={e => setModelConfig(c => ({...c, temperature: parseFloat(e.target.value)}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                        </div>
                    </div>

                    {/* Right Column: Safety Settings */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Content Safety Settings</label>
                        <div className="space-y-3 bg-gray-700/50 p-4 rounded-md border border-gray-600">
                            {(modelConfig.safetySettings || []).map(setting => (
                                <div key={setting.category}>
                                    <label htmlFor={`safety-${setting.category}`} className="block text-xs text-gray-400 mb-1">{categoryLabels[setting.category]}</label>
                                    <select
                                        id={`safety-${setting.category}`}
                                        value={setting.threshold}
                                        onChange={e => handleSafetyChange(setting.category, e.target.value as HarmBlockThreshold)}
                                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-gray-200 focus:ring-1 focus:ring-blue-500"
                                    >
                                        {thresholdOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Adjust how aggressively the model blocks potentially harmful content.</p>
                    </div>
                </main>
                 <footer className="flex justify-end p-4 bg-gray-900/50 border-t border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Done
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default GlobalSettingsPanel;
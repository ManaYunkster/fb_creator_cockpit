// components/quotefinder/QuoteFinderControls.tsx
import React, { useState } from 'react';
import { Mode, InputMode, GeminiFile, ContextDocument } from '../../types';
import { VENUE_UTM_CONFIG } from '../../config/social_post_config';
import { generateProfileTooltip } from '../../services/uiFormatService';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import InputModeSelector from './InputModeSelector';

interface QuoteFinderControlsProps {
    mode: Mode;
    handleModeChange: (mode: Mode) => void;
    modeLabels: Record<Mode, string>;
    inputMode: InputMode;
    setInputMode: (mode: InputMode) => void;
    urlInput: string;
    setUrlInput: (url: string) => void;
    textInput: string;
    setTextInput: (text: string) => void;
    uploadedFile: File | null;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    appendUtmTags: boolean;
    setAppendUtmTags: (append: boolean) => void;
    utmPreset: string;
    setUtmPreset: (preset: string) => void;
    utmSource: string;
    setUtmSource: (source: string) => void;
    utmMedium: string;
    setUtmMedium: (medium: string) => void;
    utmCampaign: string;
    setUtmCampaign: (campaign: string) => void;
    utmTerm: string;
    setUtmTerm: (term: string) => void;
    contextProfiles: { name: string; count: number }[];
    activeProfiles: Set<string>;
    handleProfileToggle: (profileName: string) => void;
    relevantDocs: ContextDocument[];
    geminiContextFiles: Map<string, GeminiFile>;
    handleGenerate: () => void;
    isGenerateDisabled: boolean;
    isLoading: boolean;
    progressMessage: string;
    corpusStatus: string;
}

const QuoteFinderControls: React.FC<QuoteFinderControlsProps> = ({
    mode, handleModeChange, modeLabels, inputMode, setInputMode, urlInput, setUrlInput,
    textInput, setTextInput, uploadedFile, handleFileChange, appendUtmTags, setAppendUtmTags,
    utmPreset, setUtmPreset, utmSource, setUtmSource, utmMedium, setUtmMedium, utmCampaign,
    setUtmCampaign, utmTerm, setUtmTerm, contextProfiles, activeProfiles, handleProfileToggle,
    relevantDocs, geminiContextFiles, handleGenerate, isGenerateDisabled, isLoading,
    progressMessage, corpusStatus
}) => {
    const [isUtmPanelOpen, setIsUtmPanelOpen] = useState(false);

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-center gap-2 p-1 bg-gray-900/50 rounded-lg max-w-sm mx-auto">
                {(['quote', 'callback'] as Mode[]).map(m => (
                    <button
                        key={m}
                        onClick={() => handleModeChange(m)}
                        className={`w-full px-4 py-2 text-sm font-semibold rounded-md transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${mode === m ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700'
                            }`}
                    >
                        {modeLabels[m]}
                    </button>
                ))}
            </div>

            <InputModeSelector
                mode={mode}
                inputMode={inputMode}
                setInputMode={setInputMode}
                urlInput={urlInput}
                setUrlInput={setUrlInput}
                textInput={textInput}
                setTextInput={setTextInput}
                uploadedFile={uploadedFile}
                handleFileChange={handleFileChange}
            />

            {mode === 'callback' && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setIsUtmPanelOpen(prev => !prev)}>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox" id="append-utm-toggle" checked={appendUtmTags}
                                onChange={(e) => setAppendUtmTags(e.target.checked)}
                                onClick={e => e.stopPropagation()}
                                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="append-utm-toggle" className="ml-2 text-sm font-medium text-gray-200 cursor-pointer">Append UTM Tags to Link</label>
                            <select
                                id="utm-preset-select"
                                value={utmPreset}
                                onChange={e => setUtmPreset(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="ml-4 p-1 bg-gray-700 border border-gray-600 rounded-md text-xs text-gray-200 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                                disabled={!appendUtmTags}
                            >
                                {Object.keys(VENUE_UTM_CONFIG).map(presetName => (
                                    <option key={presetName} value={presetName}>{presetName}</option>
                                ))}
                            </select>
                        </div>
                        <button aria-expanded={isUtmPanelOpen} aria-controls="utm-panel" className="p-1 text-gray-400 hover:text-white" title={isUtmPanelOpen ? "Collapse" : "Expand"}>
                            <ChevronDownIcon className={`w-5 h-5 transition-transform ${isUtmPanelOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                    {isUtmPanelOpen && (
                        <div id="utm-panel" className="p-4 border-t border-gray-700 space-y-3 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div>
                                    <label htmlFor="utm-source" className="block text-xs text-gray-400 mb-1">Source (utm_source)</label>
                                    <input type="text" id="utm-source" value={utmSource} onChange={e => setUtmSource(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200" />
                                </div>
                                <div>
                                    <label htmlFor="utm-medium" className="block text-xs text-gray-400 mb-1">Medium (utm_medium)</label>
                                    <input type="text" id="utm-medium" value={utmMedium} onChange={e => setUtmMedium(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div>
                                    <label htmlFor="utm-campaign" className="block text-xs text-gray-400 mb-1">Campaign (utm_campaign)</label>
                                    <input type="text" id="utm-campaign" value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200" />
                                </div>
                                <div>
                                    <label htmlFor="utm-term" className="block text-xs text-gray-400 mb-1">Term (utm_term)</label>
                                    <input type="text" id="utm-term" value={utmTerm} onChange={e => setUtmTerm(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 text-gray-200" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-300">Context:</span>
                    {contextProfiles.map(profile => (
                        <button
                            key={profile.name}
                            onClick={() => handleProfileToggle(profile.name)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 focus-visible:ring-blue-500 ${activeProfiles.has(profile.name)
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                }`}
                            title={generateProfileTooltip(profile.name, relevantDocs, geminiContextFiles)}
                        >
                            {profile.name} ({profile.count})
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isGenerateDisabled}
                    className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            {progressMessage || 'Finding...'}
                        </>
                    ) : 'Find'}
                </button>
            </div>
            {corpusStatus !== 'READY' && <p className="text-xs text-center text-yellow-400">Corpus is not ready. Status: {corpusStatus}</p>}
        </div>
    );
};

export default QuoteFinderControls;

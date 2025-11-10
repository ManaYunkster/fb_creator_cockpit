// components/quotefinder/InputModeSelector.tsx
import React from 'react';
import { InputMode } from '../../types';

interface InputModeSelectorProps {
    mode: 'quote' | 'callback';
    inputMode: InputMode;
    setInputMode: (mode: InputMode) => void;
    urlInput: string;
    setUrlInput: (url: string) => void;
    textInput: string;
    setTextInput: (text: string) => void;
    uploadedFile: File | null;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputModeSelector: React.FC<InputModeSelectorProps> = ({
    mode,
    inputMode,
    setInputMode,
    urlInput,
    setUrlInput,
    textInput,
    setTextInput,
    uploadedFile,
    handleFileChange,
}) => {

    const renderInputArea = () => {
        switch (inputMode) {
            case 'url':
                return (
                    <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://your-post.substack.com/p/..."
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 placeholder-gray-500"
                    />
                );
            case 'text':
                return (
                    <div
                        onBlur={(e) => setTextInput(e.currentTarget.innerHTML)}
                        contentEditable
                        suppressContentEditableWarning
                        dangerouslySetInnerHTML={{ __html: textInput }}
                        className="w-full min-h-[10rem] p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 overflow-y-auto prose prose-invert max-w-none"
                    />
                );
            case 'file':
                return (
                    <div>
                        <input
                            type="file"
                            onChange={handleFileChange}
                            accept=".html,.txt,.md"
                            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-gray-700 file:text-blue-300 hover:file:bg-gray-600"
                        />
                        {uploadedFile && (
                            <p className="text-xs text-gray-400 mt-2">
                                Loaded: <span className="font-semibold text-gray-300">{uploadedFile.name}</span>
                            </p>
                        )}
                    </div>
                );
        }
    };

    return (
        <div>
            <label htmlFor="input-mode-select" className="block text-sm font-medium text-gray-300 mb-2">
                {mode === 'callback' ? 'Working Article Source' : 'Search Source'}
            </label>
            <div className="flex gap-4">
                <select
                    id="input-mode-select"
                    value={inputMode}
                    onChange={(e) => setInputMode(e.target.value as InputMode)}
                    className="p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200"
                >
                    <option value="url">From URL</option>
                    <option value="text">Paste Text</option>
                    <option value="file">Upload File</option>
                </select>
                <div className="flex-grow">
                    {renderInputArea()}
                </div>
            </div>
        </div>
    );
};

export default InputModeSelector;

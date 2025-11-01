import React, { useCallback, useRef } from 'react';
import { useCorpusProcessor } from '../hooks/useCorpusProcessor';

interface ContentCorpusUploaderProps {
  onUploadSuccess: () => void;
  // FIX: Added onClose prop to conform to the ToolConfig component type.
  onClose: () => void;
}

const ContentCorpusUploader: React.FC<ContentCorpusUploaderProps> = ({ onUploadSuccess }) => {
    const { 
        processZipFile, 
        isLoading, 
        error, 
        successMessage, 
        filesList, 
        isDragging, 
        resetState,
        dragHandlers 
    } = useCorpusProcessor({ onProcessSuccess: onUploadSuccess });
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            processZipFile(file);
        }
    };

    const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
        dragHandlers.onDrop(event);
        const file = event.dataTransfer.files?.[0];
        if (file) {
            await processZipFile(file);
        }
    }, [processZipFile, dragHandlers]);

    const onAreaClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleReset = () => {
      resetState();
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    return (
        <div className="animate-fade-in-up">
            <div
                onClick={onAreaClick}
                onDrop={handleDrop}
                onDragOver={dragHandlers.onDragOver}
                onDragEnter={dragHandlers.onDragEnter}
                onDragLeave={dragHandlers.onDragLeave}
                className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ${isDragging ? 'border-blue-500 bg-gray-700/50' : 'border-gray-600 hover:border-gray-500'}`}
                role="button"
                aria-label="File upload zone"
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    onChange={handleFileChange}
                    className="hidden"
                    aria-hidden="true"
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-500 mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                </svg>

                <p className="text-gray-300">
                    <span className="font-semibold text-blue-400">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">Substack export .zip file</p>
            </div>

            <div className="mt-6 min-h-[12rem]">
              {isLoading && (
                  <div className="flex items-center justify-center text-gray-400">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing file...
                  </div>
              )}

              {error && (
                <div className="flex justify-between items-center p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-md" role="alert">
                    <span>{error}</span>
                    <button onClick={handleReset} className="text-lg font-bold hover:text-white">&times;</button>
                </div>
              )}
              
              {successMessage && !error && (
                 <div className="p-4 bg-green-900/50 border border-green-700 text-green-300 rounded-md" role="alert">
                    {successMessage}
                 </div>
              )}

              {filesList.length > 0 && !error && (
                  <div className="mt-4 bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-md font-semibold text-gray-200">Archive Contents:</h3>
                        <button onClick={handleReset} className="text-sm text-gray-400 hover:text-white">&times; Clear</button>
                      </div>
                      <ul className="space-y-2 max-h-48 overflow-y-auto">
                          {filesList.map((fileName, index) => (
                              <li key={index} className="text-sm text-gray-300 bg-gray-800/50 p-2 rounded-md flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2 text-gray-500">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                  </svg>
                                  {fileName}
                              </li>
                          ))}
                      </ul>
                  </div>
              )}
            </div>
        </div>
    );
};

export default ContentCorpusUploader;
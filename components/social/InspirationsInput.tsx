// components/social/InspirationsInput.tsx
import React, { useRef, useCallback } from 'react';
import XMarkIcon from '../icons/XMarkIcon';
import { Inspiration, ImageInspiration, TextInspiration } from '../../types';

interface InspirationsInputProps {
  inspirations: Inspiration[];
  setInspirations: React.Dispatch<React.SetStateAction<Inspiration[]>>;
  textInspirationInput: string;
  setTextInspirationInput: (value: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const InspirationsInput: React.FC<InspirationsInputProps> = ({
  inspirations,
  setInspirations,
  textInspirationInput,
  setTextInspirationInput,
  error,
  setError,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const newImageInspirations: ImageInspiration[] = [];
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    
    for (const file of Array.from(files)) {
        if (inspirations.length + newImageInspirations.length >= 10) {
            setError('You can add a maximum of 10 inspirations.');
            break;
        }
        if (!allowedTypes.includes(file.type)) {
            setError('Only PNG, JPEG, and WebP files are allowed.');
            continue;
        }
        const base64 = await fileToBase64(file);
        newImageInspirations.push({
            id: `${Date.now()}-${file.name}`,
            type: 'image',
            file,
            previewUrl: URL.createObjectURL(file),
            base64,
        });
    }
    setInspirations(prev => [...prev, ...newImageInspirations]);
    setError(null);
  }, [inspirations, setInspirations, setError]);

  const handleAddTextInspiration = () => {
    if (!textInspirationInput.trim() || inspirations.length >= 10) {
        if (inspirations.length >= 10) {
            setError('You can add a maximum of 10 inspirations.');
        }
        return;
    }
    const newInspiration: TextInspiration = {
        id: `${Date.now()}-text`,
        type: 'text',
        text: textInspirationInput.trim(),
    };
    setInspirations(prev => [...prev, newInspiration]);
    setTextInspirationInput('');
    setError(null);
  };

  const handleRemoveInspiration = (id: string) => {
    setInspirations(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">Step 2: Add Inspirations (Optional, up to 10)</label>
      <p className="text-xs text-gray-400 mb-2">Add text ideas or upload images with quotes. A separate post will be generated for each inspiration.</p>
      
      <div className="flex gap-2 mb-4">
          <input 
              type="text" 
              value={textInspirationInput}
              onChange={(e) => setTextInspirationInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTextInspiration(); } }}
              placeholder="Type an idea or quote..."
              className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 placeholder-gray-500"
          />
          <button
              onClick={handleAddTextInspiration}
              disabled={!textInspirationInput.trim() || inspirations.length >= 10}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
              Add Idea
          </button>
      </div>

      <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); handleImageUpload(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 border-gray-600 hover:border-gray-500"
      >
          <input
              ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => handleImageUpload(e.target.files)} className="hidden"
          />
           <p className="text-gray-300"><span className="font-semibold text-blue-400">Click to upload images</span> or drag and drop</p>
      </div>
      {inspirations.length > 0 && (
          <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Inspirations Queue:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {inspirations.map((item, index) => (
                      <div key={item.id} className="relative group bg-gray-800 rounded-md border border-gray-700">
                          {item.type === 'image' ? (
                              <img src={(item as ImageInspiration).previewUrl} alt={`preview ${index}`} className="w-full h-auto object-cover rounded-md aspect-square" />
                          ) : (
                              <div className="text-gray-200 text-sm p-3 rounded-md aspect-square flex items-center justify-center text-center">
                                  <p className="line-clamp-5">"{(item as TextInspiration).text}"</p>
                              </div>
                          )}
                          <button 
                              onClick={() => handleRemoveInspiration(item.id)}
                              className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              title="Remove"
                          >
                              <XMarkIcon className="w-4 h-4" />
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default InspirationsInput;

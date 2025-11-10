// components/social/RegenerationModal.tsx
import React from 'react';

interface RegenerationModalProps {
  isOpen: boolean;
  postIndex: number | null;
  feedback: string;
  setFeedback: (feedback: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const RegenerationModal: React.FC<RegenerationModalProps> = ({
  isOpen,
  postIndex,
  feedback,
  setFeedback,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={onCancel}>
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-gray-600">
          <h3 className="text-lg font-bold text-gray-100">Regenerate Post #{postIndex !== null ? postIndex + 1 : ''}</h3>
        </header>
        <main className="p-6">
          <label htmlFor="regen-feedback" className="block text-sm font-medium text-gray-300 mb-2">Provide feedback for improvement (optional):</label>
          <textarea
            id="regen-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g., Make it shorter, add more emojis, be more professional..."
            rows={4}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 placeholder-gray-500"
          />
        </main>
        <footer className="flex justify-end gap-4 p-4 bg-gray-900/50 border-t border-gray-700">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors">Regenerate</button>
        </footer>
      </div>
    </div>
  );
};

export default RegenerationModal;


import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
  confirmButtonClassName?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message,
    confirmButtonText = 'Confirm Delete',
    confirmButtonClassName = 'bg-red-600 hover:bg-red-500 focus:ring-red-500'
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-gray-600">
          <h3 className="text-lg font-bold text-gray-100">{title}</h3>
        </header>
        <main className="p-6">
          <p className="text-gray-300">{message}</p>
        </main>
        <footer className="flex justify-end gap-4 p-4 bg-gray-900/50 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded-md transition-colors focus:outline-none focus:ring-2 ${confirmButtonClassName}`}
          >
            {confirmButtonText}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ConfirmationModal;
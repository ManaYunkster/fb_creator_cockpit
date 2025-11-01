
import React, { useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';
import PencilIcon from './icons/PencilIcon';

interface ToolPanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  showModelInfo?: boolean;
  onOpenSettings?: () => void;
}

const ToolPanel: React.FC<ToolPanelProps> = ({ title, onClose, children, showModelInfo, onOpenSettings }) => {
  const { modelConfig } = useContext(SettingsContext);

  return (
    <div className="w-full max-w-screen-xl mx-auto bg-gray-800 rounded-lg shadow-2xl border border-gray-700 animate-fade-in">
      <header className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-100">{title}</h2>
          {showModelInfo && (
            <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-1 rounded-full border border-gray-700">
              <span className="text-xs text-gray-400">Model: {modelConfig.model}</span>
              <button onClick={onOpenSettings} title="Global AI Settings" className="text-gray-400 hover:text-white transition-colors">
                <PencilIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          &larr; Back to Cockpit
        </button>
      </header>
      <main className="p-6">
        {children}
      </main>
    </div>
  );
};

export default ToolPanel;
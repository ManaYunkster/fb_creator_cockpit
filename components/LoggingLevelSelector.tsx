import React, { useContext, useState } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';
import { LogLevelString } from '../types';
import ExclamationTriangleIcon from './icons/ExclamationTriangleIcon';

const LoggingLevelSelector: React.FC = () => {
  const { logLevel, setLogLevel } = useContext(SettingsContext);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLevelSelect = (level: LogLevelString) => {
    setLogLevel(level);
    setIsModalOpen(false);
  };

  const iconColorClass = () => {
    switch (logLevel) {
      case 'DEBUG':
      case 'PROMPTS':
        return 'text-blue-400';
      case 'INFO':
        return 'text-blue-400';
      case 'ERROR':
        return 'text-yellow-400';
      case 'NONE':
      default:
        return 'text-gray-400';
    }
  };

  const logLevels: { level: LogLevelString; label: string; description: string }[] = [
    { level: 'NONE', label: 'None', description: 'No logs will be shown in the console.' },
    { level: 'ERROR', label: 'Errors', description: 'Only show critical errors and failures.' },
    { level: 'INFO', label: 'Info', description: 'Show general workflow information and errors.' },
    { level: 'PROMPTS', label: 'Prompts', description: 'Show full AI prompts, info, and errors.' },
    { level: 'DEBUG', label: 'Debug', description: 'Show all logs, including verbose API responses.' },
  ];

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        title={`Set Console Log Level (Current: ${logLevel})`}
        className="p-3 bg-gray-700 text-gray-300 rounded-full shadow-lg hover:bg-gray-600 hover:text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 animate-fade-in"
      >
        <ExclamationTriangleIcon className={`w-6 h-6 transition-colors ${iconColorClass()}`} />
      </button>

      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" 
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md" 
            onClick={e => e.stopPropagation()}
          >
            <header className="p-4 border-b border-gray-600">
              <h3 className="text-lg font-bold text-gray-100">Select Logging Level</h3>
            </header>
            <main className="p-4">
              <div className="space-y-2">
                {logLevels.map(({ level, label, description }) => (
                  <button
                    key={level}
                    onClick={() => handleLevelSelect(level)}
                    className={`w-full text-left p-3 rounded-md transition-colors flex items-center justify-between ${
                      logLevel === level
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{label}</span>
                      <p className="text-xs opacity-80">{description}</p>
                    </div>
                    {logLevel === level && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </main>
          </div>
        </div>
      )}
    </>
  );
};

export default LoggingLevelSelector;

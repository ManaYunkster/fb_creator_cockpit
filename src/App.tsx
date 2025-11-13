import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import JSZip from 'jszip';
import { Tool } from './types';
import CockpitButton from './components/CockpitButton';
import ToolPanel from './components/ToolPanel';
import Logo from './components/icons/Logo';
import ContentCorpusUploader from './components/ContentCorpusUploader';
import DataProvider, { DataContext } from './contexts/DataContext';
import SettingsProvider from './contexts/SettingsContext';
import ContentProvider, { ContentContext } from './contexts/ContentContext';
import GeminiCorpusProvider, { geminiCorpusContext } from './contexts/GeminiCorpusContext';
import { TestModeProvider, TestModeContext } from './contexts/TestModeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useCorpusProcessor } from './hooks/useCorpusProcessor';
import { APP_CONFIG } from './config/app_config';
import GlobalSettingsPanel from './components/GlobalSettingsPanel';
import PromptManagerPanel from './components/PromptManagerPanel';
import { TOOL_CONFIG } from './config/tool_config';
import LoggingLevelSelector from './components/LoggingLevelSelector';
import MagnifyingGlassIcon from './components/icons/MagnifyingGlassIcon';
import PencilIcon from './components/icons/PencilIcon';
import { log } from './services/loggingService';
import * as dbService from './services/dbService';
import { initPrompts } from './services/promptService';
import LogoutButton from './components/LogoutButton';
import LoginPage from './components/LoginPage';

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const initializeApp = async () => {
            try {
                log.info('AppInitializer: Starting application initialization...');
                await initPrompts();
                log.info('AppInitializer: Prompts initialized.');
                await dbService.sanitizeFileContentStore();
                log.info('AppInitializer: Database sanitized.');
                setIsInitialized(true);
                log.info('AppInitializer: Initialization complete. Rendering application.');
            } catch (error) {
                log.error('Fatal error during application initialization:', error);
            }
        };
        initializeApp();
    }, []);

    if (!isInitialized) {
        return null; 
    }

    return <>{children}</>;
};

const AppContent: React.FC = () => {
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const dataContext = useContext(DataContext);
  const contentContext = useContext(ContentContext);
      const geminiCorpusCtx = useContext(geminiCorpusContext);  
  const { posts } = dataContext;
  const { contextDocuments } = contentContext;
      const { status: corpusStatus } = geminiCorpusCtx;  
  const { isTestMode } = useContext(TestModeContext);
  
  const [isDraggingOverCorpus, setIsDraggingOverCorpus] = useState(false);
  const [isDraggingOverRestore, setIsDraggingOverRestore] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isPromptManagerOpen, setIsPromptManagerOpen] = useState(false);

  const [isRestoreLoading, setIsRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreProgress, setRestoreProgress] = useState('');
  
  const { processZipFile, isLoading: isCorpusLoading } = useCorpusProcessor({
    onProcessSuccess: () => setActiveTool(Tool.PostInsights)
  });
  
  const restoreFromFile = useCallback(async (file: File) => {
      setIsRestoreLoading(true);
      setRestoreError(null);
      setRestoreProgress('Reading backup file...');
      try {
          if (!file || !file.type.includes('zip')) {
              throw new Error('Please provide a valid .zip backup file.');
          }
          const zip = await JSZip.loadAsync(file);
          const backupFile = zip.file('database_backup.json');
          if (!backupFile) {
              throw new Error('Invalid backup archive: "database_backup.json" not found.');
          }
          setRestoreProgress('Parsing backup data...');
          const fileContent = await backupFile.async('text');
          const jsonData = JSON.parse(fileContent);
          setRestoreProgress('Restoring database...');
          await dbService.importDB(jsonData);
          setRestoreProgress('Refreshing application state...');
          await dataContext.loadCorpus();
          await contentContext.loadContext();
          setRestoreProgress('Restore process initiated. Syncing will begin shortly.');
      } catch (e: any) {
          log.error('Database restore failed:', e);
          setRestoreError(`Restore failed: ${e.message}.`);
          setRestoreProgress('');
      } finally {
          setTimeout(() => {
              setIsRestoreLoading(false);
              setRestoreProgress('');
              setTimeout(() => setRestoreError(null), 2000);
          }, 3000);
      }
  }, [dataContext, contentContext]);
  
  const handleCorpusDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOverCorpus(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await processZipFile(file);
  };
  
  const handleRestoreDrop = async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingOverRestore(false);
      const file = event.dataTransfer.files?.[0];
      if (file) await restoreFromFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => event.preventDefault();
  
  const isSyncing = corpusStatus === 'SYNCING';
  const combinedIsLoading = isCorpusLoading || isRestoreLoading || isSyncing;

  const tools = useMemo(() => TOOL_CONFIG.map(config => {
    let isDisabled = (config.requiredData?.some(dataType => {
        if (dataType === 'posts') return posts.length === 0;
        if (dataType === 'contextDocuments') return contextDocuments.length === 0;
        return false; 
    }) ?? false) || !config.enabled;

    if (config.id === Tool.RegressionTests) isDisabled = !isTestMode;

    return {
        id: config.id,
        title: config.name,
        description: config.description,
        icon: <config.icon className="w-10 h-10" />,
        disabled: isDisabled || combinedIsLoading,
    };
  }), [posts.length, contextDocuments.length, combinedIsLoading, isTestMode]);
  
  const getCorpusStatusMessage = () => {
    switch (corpusStatus) {
        case 'SYNCING': return 'Syncing corpus with AI...';
        case 'READY': return 'Corpus synced and ready.';
        case 'ERROR': return 'Error syncing corpus.';
        case 'EMPTY': return 'Awaiting data to sync corpus...';
        default: return null;
    }
  };

  const renderCockpit = () => (
    <div className="text-center animate-fade-in-up">
      <header className="mb-12 flex flex-col items-center">
        <Logo className="w-48 h-48" />
        <h1 className="mt-6 text-4xl md:text-5xl font-extrabold text-gray-200 tracking-tight">Creator Cockpit</h1>
         <p className="mt-2 text-sm text-blue-400 font-mono h-4">
          {isRestoreLoading ? restoreProgress : getCorpusStatusMessage()}
         </p>
        {isCorpusLoading && (
           <div className="mt-4 flex items-center justify-center text-gray-400">
             <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
             Processing corpus...
           </div>
        )}
        {restoreError && !isRestoreLoading && (
            <p className="mt-2 text-sm text-red-400 font-mono">{restoreError}</p>
        )}
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-screen-xl mx-auto">
        {tools.map((tool) => {
          if (tool.id === Tool.ContentCorpus) {
            return (
              <div
                key={tool.id}
                onDrop={handleCorpusDrop}
                onDragOver={handleDragOver}
                onDragEnter={() => !combinedIsLoading && setIsDraggingOverCorpus(true)}
                onDragLeave={() => setIsDraggingOverCorpus(false)}
                className={`transition-all duration-300 rounded-lg ${isDraggingOverCorpus ? 'ring-4 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''}`}>
                <CockpitButton {...tool} onClick={() => setActiveTool(tool.id)} />
              </div>
            );
          }
          if (tool.id === Tool.DATABASE_RESTORER) {
            return (
              <div
                key={tool.id}
                onDrop={handleRestoreDrop}
                onDragOver={handleDragOver}
                onDragEnter={() => !combinedIsLoading && setIsDraggingOverRestore(true)}
                onDragLeave={() => setIsDraggingOverRestore(false)}
                className={`transition-all duration-300 rounded-lg ${isDraggingOverRestore ? 'ring-4 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''}`}>
                <CockpitButton {...tool} onClick={() => setActiveTool(tool.id)} />
              </div>
            );
          }
          if(tool.id === Tool.RegressionTests && !isTestMode) return null;
          return <CockpitButton key={tool.id} {...tool} onClick={() => setActiveTool(tool.id)} />;
        })}
      </div>
    </div>
  );
  
  const renderToolContent = () => {
    const selectedToolConfig = TOOL_CONFIG.find(t => t.id === activeTool);
    if (!selectedToolConfig) return null;

    const ToolComponent = selectedToolConfig.component;
    const handleClose = () => setActiveTool(null);

    if (activeTool === Tool.ContentCorpus) {
      return <ContentCorpusUploader onUploadSuccess={() => setActiveTool(Tool.PostInsights)} onClose={handleClose} />;
    }

    return <ToolComponent onClose={handleClose} />;
  };

  const renderToolPanel = () => {
    if (!activeTool) return null;
    const selectedTool = tools.find(t => t.id === activeTool);
    if (!selectedTool) return null;

    const usesAi = [Tool.SocialPostAssistant, Tool.CHAT_ASSISTANT, Tool.QuoteFinder].includes(activeTool);

    return (
      <ToolPanel title={selectedTool.title} onClose={() => setActiveTool(null)} showModelInfo={usesAi} onOpenSettings={() => setIsSettingsPanelOpen(true)}>
        {renderToolContent()}
      </ToolPanel>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col p-4 sm:p-6 lg:p-8" onDragOver={handleDragOver} onDrop={(e) => e.preventDefault()}>
      <main className="flex-grow flex flex-col items-center justify-center">
        {activeTool ? renderToolPanel() : renderCockpit()}
      </main>
      <footer className="text-center text-gray-500 text-xs mt-8">
        <p>Version {APP_CONFIG.VERSION} | Build {APP_CONFIG.BUILD} | {APP_CONFIG.FOOTER_CREDIT}</p>
        <p>{APP_CONFIG.FOOTER_COPYRIGHT_LINE1}</p>
        <p>{APP_CONFIG.FOOTER_COPYRIGHT_LINE2}</p>
      </footer>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
        {!activeTool && (
          <>
            <LogoutButton />
            <button onClick={() => setIsPromptManagerOpen(true)} title="Prompt Inspector" className="p-3 bg-gray-700 text-gray-300 rounded-full shadow-lg hover:bg-gray-600 hover:text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 animate-fade-in">
                <MagnifyingGlassIcon className="w-6 h-6" />
            </button>
            <button onClick={() => setIsSettingsPanelOpen(true)} title="Global AI Settings" className="p-3 bg-gray-700 text-gray-300 rounded-full shadow-lg hover:bg-gray-600 hover:text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 animate-fade-in">
                <PencilIcon className="w-6 h-6" />
            </button>
            <LoggingLevelSelector />
          </>
        )}
      </div>
      <GlobalSettingsPanel isOpen={isSettingsPanelOpen} onClose={() => setIsSettingsPanelOpen(false)} />
      <PromptManagerPanel isOpen={isPromptManagerOpen} onClose={() => setIsPromptManagerOpen(false)} />
    </div>
  );
};

const AppWrapper: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
            <p>Loading...</p>
        </div>
    );
  }

  return currentUser ? <AppContent /> : <LoginPage />;
}

const App: React.FC = () => (
  <AuthProvider>
    <TestModeProvider>
      <AppInitializer>
        <DataProvider>
          <SettingsProvider>
            <ContentProvider>
              <GeminiCorpusProvider>
                <AppWrapper />
              </GeminiCorpusProvider>
            </ContentProvider>
          </SettingsProvider>
        </DataProvider>
      </AppInitializer>
    </TestModeProvider>
  </AuthProvider>
);

export default App;

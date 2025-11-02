

import React, { useContext } from 'react';
import { ContentContext } from '../contexts/ContentContext';
import { geminiCorpusContext } from '../contexts/GeminiCorpusContext';
import { ContextDocument, GeminiFile } from '../types';

const DocumentGroup: React.FC<{ title: string; documents: ContextDocument[]; contextFiles: Map<string, GeminiFile> }> = ({ title, documents, contextFiles }) => (
    <div>
        <h3 className="text-xl font-bold text-gray-100 mb-4 border-b-2 border-gray-700 pb-2">{title}</h3>
        <div className="space-y-4">
            {documents.map(doc => {
                const geminiFile = contextFiles.get(doc.id);
                const displayName = geminiFile?.cachedDisplayName || doc.id;
                return (
                    <details key={doc.id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden transition-all duration-300 open:shadow-lg">
                        <summary className="px-5 py-4 cursor-pointer hover:bg-gray-700/50 flex justify-between items-center">
                            <div className="flex flex-col items-start gap-2">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-teal-400 text-lg">{displayName}</span>
                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-800 text-blue-200">{doc.classification}</span>
                                </div>
                                <span className="text-sm font-normal text-gray-400">{doc.summary}</span>
                                {geminiFile && (
                                    <code className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded">
                                        Synced as: {geminiFile.name}
                                    </code>
                                )}
                            </div>
                            <svg className="w-5 h-5 text-gray-400 transform transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </summary>
                        <div className="p-5 border-t border-gray-700 prose prose-sm prose-invert max-w-none prose-pre:bg-gray-900 prose-pre:p-4 prose-pre:rounded-md">
                            <pre className="whitespace-pre-wrap font-sans text-gray-300">{doc.content}</pre>
                        </div>
                    </details>
                );
            })}
        </div>
    </div>
);


const ContentContextPanel: React.FC = () => {
    const { contextDocuments, isLoading } = useContext(ContentContext);
    const { syncedFiles } = useContext(geminiCorpusContext);

    const groupedDocuments = contextDocuments.reduce((acc, doc) => {
        const profile = doc.profile || 'General';
        if (!acc[profile]) {
            acc[profile] = [];
        }
        acc[profile].push(doc);
        return acc;
    }, {} as Record<string, ContextDocument[]>);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center text-gray-400 p-8">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading and classifying context documents...</span>
            </div>
        );
    }
    
    if (contextDocuments.length === 0) {
        return (
             <div className="text-center text-gray-400 p-8 bg-gray-700/50 rounded-lg">
                <h3 className="text-xl font-semibold text-white mb-4">No Context Documents Found</h3>
                <p>No files were found in the `/src/context_documents/` directory.</p>
            </div>
        );
    }
    
    const profileOrder = ['Brand Voice', 'Author Persona', 'Tool Instruction', 'General'];
    const sortedGroups = Object.entries(groupedDocuments).sort(([a], [b]) => {
        const indexA = profileOrder.indexOf(a);
        const indexB = profileOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-gray-400">
                <p>These documents provide foundational context to the AI. They are grouped below by their **Context Profile**, which corresponds to the toggle chips available in tools like the Social Post Assistant and Chat Assistant.</p>
            </div>
            {sortedGroups.map(([profile, docs]) => (
                <DocumentGroup key={profile} title={profile} documents={docs} contextFiles={syncedFiles} />
            ))}
        </div>
    );
};

export default ContentContextPanel;
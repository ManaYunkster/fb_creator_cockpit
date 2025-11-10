// components/social/ContextProfiles.tsx
import React from 'react';
import { ContextDocument, GeminiFile } from '../../types';
import { parseInternalFileName } from '../../config/file_naming_config';
import { generateProfileTooltip } from '../../services/uiFormatService';

interface ContextProfilesProps {
    allContextDocuments: ContextDocument[];
    allFiles: Map<string, GeminiFile>;
    activeProfiles: Set<string>;
    onProfileToggle: (profileName: string) => void;
    toolScope: 'spa' | 'qf' | 'chat';
}

const ContextProfiles: React.FC<ContextProfilesProps> = ({
    allContextDocuments,
    allFiles,
    activeProfiles,
    onProfileToggle,
    toolScope,
}) => {
    const relevantDocs = allContextDocuments.filter(doc => {
        const parsed = parseInternalFileName(doc.id);
        if (!parsed) return false;
        return parsed.scope === 'global' || parsed.scope === toolScope;
    });

    const grouped = relevantDocs.reduce<Record<string, number>>((acc, doc) => {
        if (doc.profile && doc.profile !== 'Tool Instruction' && doc.profile !== 'General') {
            acc[doc.profile] = (acc[doc.profile] || 0) + 1;
        }
        return acc;
    }, {});

    const contextProfiles = Object.entries(grouped).map(([name, count]) => ({ name, count }));

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-300">Context:</span>
            {contextProfiles.map(profile => (
                <button
                    key={profile.name}
                    onClick={() => onProfileToggle(profile.name)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 focus-visible:ring-blue-500 ${
                        activeProfiles.has(profile.name)
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }`}
                    title={generateProfileTooltip(profile.name, relevantDocs, allFiles)}
                >
                    {profile.name} ({profile.count})
                </button>
            ))}
        </div>
    );
};

export default ContextProfiles;

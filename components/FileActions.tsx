import React from 'react';

interface FileActionsProps {
    isLoading: boolean;
    onPurge: () => void;
    onForceResync: () => void;
    onRefresh: () => void;
    fileCount: number;
}

const FileActions: React.FC<FileActionsProps> = ({ isLoading, onPurge, onForceResync, onRefresh, fileCount }) => {
    return (
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-lg font-bold text-gray-100">Managed Files ({fileCount})</h3>
            <div className="flex items-center gap-2">
                <button onClick={onPurge} disabled={isLoading} className="px-3 py-1 bg-red-800 text-sm text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors">Purge Databases</button>
                <button onClick={onForceResync} disabled={isLoading} className="px-3 py-1 bg-yellow-600 text-sm text-white rounded-md hover:bg-yellow-500 disabled:opacity-50 transition-colors">Force Resync</button>
                <button onClick={onRefresh} disabled={isLoading} className="px-3 py-1 bg-gray-700 text-sm text-gray-300 rounded-md hover:bg-gray-600 disabled:opacity-50 transition-colors">Refresh</button>
            </div>
        </header>
    );
};

export default FileActions;

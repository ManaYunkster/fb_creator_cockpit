import React, { useMemo, useRef, useEffect } from 'react';
import { GeminiFile } from '../types';
import LockClosedIcon from './icons/LockClosedIcon';
import InformationCircleIcon from './icons/InformationCircleIcon';

type SortableColumn = keyof GeminiFile;
type SortDirection = 'asc' | 'desc';

const formatBytes = (bytesStr: string | number, decimals = 2) => {
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
    if (isNaN(bytes) || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
};

interface FilesTableProps {
    files: GeminiFile[];
    isLoading: boolean;
    error: string | null;
    selectedFiles: Set<string>;
    sortConfig: { key: SortableColumn; direction: SortDirection } | null;
    currentPage: number;
    rowsPerPage: number;
    onSort: (key: SortableColumn) => void;
    onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSelectOne: (name: string) => void;
    onDelete: (names: string[]) => void;
    onShowInfo: (file: GeminiFile) => void;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rows: number) => void;
}

const FilesTable: React.FC<FilesTableProps> = ({
    files,
    isLoading,
    error,
    selectedFiles,
    sortConfig,
    currentPage,
    rowsPerPage,
    onSort,
    onSelectAll,
    onSelectOne,
    onDelete,
    onShowInfo,
    onPageChange,
    onRowsPerPageChange,
}) => {
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

    const sortedFiles = useMemo(() => {
        let sortableFiles = [...files];
        if (sortConfig !== null) {
            sortableFiles.sort((a, b) => {
                const aIsEditable = a.context !== 'corpus';
                const bIsEditable = b.context !== 'corpus';

                if (aIsEditable && !bIsEditable) return -1;
                if (!aIsEditable && bIsEditable) return 1;

                const { key, direction } = sortConfig;
                const aValue = a[key];
                const bValue = b[key];
                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;
                
                let comparison = 0;
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    if (key === 'createTime' || key === 'updateTime' || key === 'expirationTime') {
                        comparison = new Date(aValue).getTime() - new Date(bValue).getTime();
                    } else if (key === 'sizeBytes') {
                        comparison = parseInt(aValue, 10) - parseInt(bValue, 10);
                    } else {
                        comparison = aValue.localeCompare(bValue);
                    }
                } else {
                    comparison = String(aValue).localeCompare(String(bValue));
                }
                
                return direction === 'asc' ? comparison : -comparison;
            });
        }
        return sortableFiles;
    }, [files, sortConfig]);

    const paginatedFiles = useMemo(() => {
        if (rowsPerPage === -1) return sortedFiles;
        const startIndex = (currentPage - 1) * rowsPerPage;
        return sortedFiles.slice(startIndex, startIndex + rowsPerPage);
    }, [sortedFiles, currentPage, rowsPerPage]);

    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            const selectableFiles = paginatedFiles.filter(f => f.context !== 'corpus');
            const selectableFileNames = new Set(selectableFiles.map(f => f.name));
            
            if (selectableFileNames.size === 0) {
                selectAllCheckboxRef.current.checked = false;
                selectAllCheckboxRef.current.indeterminate = false;
                return;
            }
            const selectedVisibleCount = Array.from(selectedFiles).filter(name => selectableFileNames.has(name)).length;

            if (selectedVisibleCount === selectableFileNames.size) {
                selectAllCheckboxRef.current.checked = true;
                selectAllCheckboxRef.current.indeterminate = false;
            } else if (selectedVisibleCount > 0) {
                selectAllCheckboxRef.current.checked = false;
                selectAllCheckboxRef.current.indeterminate = true;
            } else {
                selectAllCheckboxRef.current.checked = false;
                selectAllCheckboxRef.current.indeterminate = false;
            }
        }
    }, [selectedFiles, paginatedFiles]);

    const renderSortArrow = (columnKey: SortableColumn) => {
        if (sortConfig?.key !== columnKey) return null;
        return <span>{sortConfig.direction === 'desc' ? ' ↓' : ' ↑'}</span>;
    };
    
    const TableHeader: React.FC<{columnKey: SortableColumn, label: string, className?: string}> = ({columnKey, label, className}) => (
        <th scope="col" className={`px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer ${className}`} onClick={() => onSort(columnKey)}>
            {label} {renderSortArrow(columnKey)}
        </th>
    );

    const totalPages = rowsPerPage > 0 ? Math.ceil(sortedFiles.length / rowsPerPage) : 1;

    const renderTableRows = () => {
        const rows: React.ReactNode[] = [];
        let lastGroup: 'user' | 'application' | null = null;
    
        paginatedFiles.forEach((file: GeminiFile) => {
            const isProtected = file.context === 'corpus';
            const currentGroup = isProtected ? 'application' : 'user';
    
            if (currentGroup !== lastGroup) {
                const headerText = currentGroup === 'user' ? 'User-managed files' : 'Application-managed files';
                rows.push(
                    <tr key={`header-${currentGroup}`} className="bg-gray-700/80">
                        <td colSpan={9} className="px-4 py-2 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            {headerText}
                        </td>
                    </tr>
                );
                lastGroup = currentGroup;
            }

            let statusLabel;
            switch (file.status) {
                case 'local_only':
                    statusLabel = <span className="text-xs text-blue-400">Local only. Force Resync to make available to Gemini.</span>;
                    break;
                case 'api_only':
                    statusLabel = <span className="text-xs text-yellow-400">Stored on Gemini API until expiration.</span>;
                    break;
                case 'synced':
                    statusLabel = <span className="text-xs text-green-400">Synced with Gemini API.</span>;
                    break;
                default:
                    statusLabel = <span className="text-xs text-gray-500">Sync status unknown.</span>;
            }
    
            rows.push(
                <tr key={file.name} className={`hover:bg-gray-700/50 transition-colors ${selectedFiles.has(file.name) ? 'bg-gray-700/30' : ''} ${isProtected ? 'opacity-70' : ''}`}>
                    <td className="pl-4 pr-2 py-4"><input type="checkbox" checked={selectedFiles.has(file.name)} onChange={() => onSelectOne(file.name)} className="rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500" disabled={isProtected} /></td>
                    <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-200">
                            {file.cachedDisplayName || file.displayName}
                        </div>
                        {statusLabel}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{file.mimeType}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">{file.context || '—'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">{file.scope || '—'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{formatBytes(file.sizeBytes)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{formatDate(file.createTime)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{formatDate(file.updateTime)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium space-x-3 text-right">
                        <button onClick={() => onShowInfo(file)} className="text-blue-400 hover:text-blue-300" title="View file metadata"><InformationCircleIcon className="w-5 h-5 inline" /></button>
                        {isProtected ? (
                            <span title="This file is managed by the Content Corpus and cannot be deleted individually.">
                                <LockClosedIcon className="w-5 h-5 inline text-blue-400" />
                            </span>
                        ) : (
                            <button onClick={() => onDelete([file.name])} disabled={isLoading} className="text-red-400 hover:text-red-300 disabled:opacity-50" title="Delete file"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 inline"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
                        )}
                    </td>
                </tr>
            );
        });
        return rows;
    };

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
            {error && <div className="m-4 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-md whitespace-pre-wrap">{error}</div>}
            
            {selectedFiles.size > 0 && (
                <div className="p-3 bg-gray-700/50 border-b border-gray-700 flex items-center gap-4">
                    <span className="text-sm font-semibold text-gray-200">{selectedFiles.size} selected</span>
                    <button onClick={() => onDelete(Array.from(selectedFiles))} className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 rounded-md text-white disabled:bg-gray-500" disabled={isLoading}>Delete Selected</button>
                </div>
            )}
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th scope="col" className="pl-4 pr-2 py-3"><input type="checkbox" ref={selectAllCheckboxRef} onChange={onSelectAll} className="rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500" /></th>
                            <TableHeader columnKey="cachedDisplayName" label="Name" />
                            <TableHeader columnKey="mimeType" label="Type" />
                            <TableHeader columnKey="context" label="Context" />
                            <TableHeader columnKey="scope" label="Scope" />
                            <TableHeader columnKey="sizeBytes" label="Size" />
                            <TableHeader columnKey="createTime" label="Created" />
                            <TableHeader columnKey="updateTime" label="Updated" />
                            <th scope="col" className="relative px-4 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {isLoading ? (
                            <tr><td colSpan={9} className="text-center p-8 text-gray-400">Loading files from API...</td></tr>
                        ) : paginatedFiles.length === 0 && !error ? (
                            <tr><td colSpan={9} className="text-center p-8 text-gray-400">No files found.</td></tr>
                        ) : (
                            renderTableRows()
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-4 flex items-center justify-between text-sm text-gray-400 border-t border-gray-700">
                <div>
                    <label htmlFor="rows-per-page" className="mr-2">Rows per page:</label>
                    <select id="rows-per-page" value={rowsPerPage} onChange={(e) => onRowsPerPageChange(parseInt(e.target.value))} className="bg-gray-700 border border-gray-600 rounded-md p-1 focus:ring-1 focus:ring-blue-500 focus:outline-none">
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={-1}>All</option>
                    </select>
                </div>
                {rowsPerPage !== -1 && (
                    <>
                    {totalPages > 0 && (
                        <span>Page {currentPage} of {totalPages}</span>
                    )}
                    <div className="space-x-2">
                        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 bg-gray-600 rounded disabled:opacity-50">Previous</button>
                        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="px-3 py-1 bg-gray-600 rounded disabled:opacity-50">Next</button>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default FilesTable;

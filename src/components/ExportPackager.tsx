import React, { useContext, useState, useCallback } from 'react';
import { DataContext } from '../contexts/DataContext';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { log } from '../services/loggingService';
import * as dbService from '../services/dbService';

type ExportType = 'zip' | 'json' | 'both' | 'db';

const ExportPackager: React.FC = () => {
    const { posts, openRecords, deliveryRecords, subscriberRecords } = useContext(DataContext);
    const [isGenerating, setIsGenerating] = useState<null | ExportType>(null);
    const [splitJson, setSplitJson] = useState(false);

    const handleDownload = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const generateZipBlob = useCallback(async (): Promise<Blob> => {
        log.info('ExportPackager: generateZipBlob triggered');
        const zip = new JSZip();

        const allCorpusFiles = await dbService.getAll<{ path: string, content: string }>('corpus_files');
        const fileContents = new Map(allCorpusFiles.map(item => [item.path, item.content]));
        
        const csvOptions = { quotes: true, header: true };

        const postsCsv = Papa.unparse(posts, csvOptions);
        zip.file('all_posts.metadata.csv', postsCsv);
        
        const postsHtmlContent = posts.map(post => {
            const htmlPath = Array.from(fileContents.keys()).find(p => p.endsWith(`${post.post_id}.html`));
            const html_content = htmlPath ? fileContents.get(htmlPath) : '';
            return { post_id: post.post_id, html_content };
        });
        const postsHtmlCsv = Papa.unparse(postsHtmlContent, csvOptions);
        zip.file('all_posts_html.csv', postsHtmlCsv);

        const opensCsv = Papa.unparse(openRecords, csvOptions);
        zip.file('all_opens.csv', opensCsv);

        const deliveriesCsv = Papa.unparse(deliveryRecords, csvOptions);
        zip.file('all_delivers.csv', deliveriesCsv);
        
        const subscribersCsv = Papa.unparse(subscriberRecords, csvOptions);
        zip.file('all_subscribers.csv', subscribersCsv);

        const readmeContent = `
# Substack Corpus Export (Tabular Format)
This archive contains the exported and processed data from your Substack newsletter in a structured, tabular format (CSV). All text is UTF-8 encoded and all fields are quote-enclosed.
## Best for structured analysis:
- Filtering, aggregating, time-series analysis, comparisons, and joins.
- Works especially well when you want to build TSV/CSV outputs, charts, or statistical summaries.
- Can handle large tables efficiently and keep column types consistent.
## Files Included:
1.  **all_posts.metadata.csv**: Main posts data. Includes calculated metrics like 'word_count', 'total_opens', 'total_deliveries', and the live 'post_url'. Does NOT include the post's body content.
2.  **all_posts_html.csv**: Contains the full HTML body for each post, linked by 'post_id'. This is useful for natural language processing or content analysis.
3.  **all_opens.csv**: A complete record of all email open events.
4.  **all_delivers.csv**: A complete record of all email delivery events.
5.  **all_subscribers.csv**: Your complete subscriber list.
        `;
        zip.file('README.md', readmeContent.trim());
        
        return await zip.generateAsync({ type: 'blob' });
    }, [posts, openRecords, deliveryRecords, subscriberRecords]);

    const generateCombinedJsonBlob = useCallback(async (): Promise<Blob> => {
        log.info('ExportPackager: generateCombinedJsonBlob triggered');
        const allCorpusFiles = await dbService.getAll<{ path: string, content: string }>('corpus_files');
        const fileContents = new Map(allCorpusFiles.map(item => [item.path, item.content]));

        const postsWithHtml = posts.map(post => {
            const htmlPath = Array.from(fileContents.keys()).find(p => p.endsWith(`${post.post_id}.html`));
            const html_content = htmlPath ? fileContents.get(htmlPath) : '';
            return { ...post, html_content };
        });

        const exportData = {
            metadata: {
                export_date: new Date().toISOString(),
                total_posts: posts.length,
                total_subscribers: subscriberRecords.length,
            },
            posts: postsWithHtml,
            subscribers: subscriberRecords,
            opens: openRecords,
            deliveries: deliveryRecords,
        };
        
        const jsonString = JSON.stringify(exportData, null, 2);
        return new Blob([jsonString], { type: 'application/json' });
    }, [posts, subscriberRecords, openRecords, deliveryRecords]);

    const generateSplitJsonZipBlob = useCallback(async (): Promise<Blob> => {
        log.info('ExportPackager: generateSplitJsonZipBlob triggered');
        const zip = new JSZip();
        
        const allCorpusFiles = await dbService.getAll<{ path: string, content: string }>('corpus_files');
        const fileContents = new Map(allCorpusFiles.map(item => [item.path, item.content]));

        const postsWithHtml = posts.map(post => {
            const htmlPath = Array.from(fileContents.keys()).find(p => p.endsWith(`${post.post_id}.html`));
            const html_content = htmlPath ? fileContents.get(htmlPath) : '';
            return { ...post, html_content };
        });

        zip.file('posts.json', JSON.stringify(postsWithHtml, null, 2));
        zip.file('subscribers.json', JSON.stringify(subscriberRecords, null, 2));
        zip.file('opens.json', JSON.stringify(openRecords, null, 2));
        zip.file('deliveries.json', JSON.stringify(deliveryRecords, null, 2));
        
        const readmeContent = `
# Substack Corpus Export (JSON Format)
This archive contains the exported and processed data from your Substack newsletter in a structured JSON format. All text is UTF-8 encoded.
## Best for unstructured analysis:
- Natural Language Processing (NLP), text mining, or tasks where you need the full HTML content of posts.
- Easy to use with Python (e.g., pandas, NLTK) or JavaScript for flexible data manipulation.
- Good for when you want to pass a comprehensive data object to another system.
## Files Included:
1.  **posts.json**: An array of post objects. Each object includes all metadata from \`posts.csv\` plus the full \`html_content\` of the post body.
2.  **subscribers.json**: An array of all subscriber records.
3.  **opens.json**: An array of all open event records.
4.  **deliveries.json**: An array of all delivery event records.
        `;
        zip.file('README.md', readmeContent.trim());
        
        return await zip.generateAsync({ type: 'blob' });
    }, [posts, subscriberRecords, openRecords, deliveryRecords]);

    const handleExport = async (type: ExportType) => {
        setIsGenerating(type);
        try {
            if (type === 'zip' || type === 'both') {
                const blob = await generateZipBlob();
                handleDownload(blob, 'substack_export_tabular.zip');
            }
            if (type === 'json' || type === 'both') {
                if(splitJson) {
                    const blob = await generateSplitJsonZipBlob();
                    handleDownload(blob, 'substack_export_json.zip');
                } else {
                    const blob = await generateCombinedJsonBlob();
                    handleDownload(blob, 'substack_export_combined.json');
                }
            }
            if (type === 'db') {
                const jsonBlob = await dbService.exportDB();
                const zip = new JSZip();
                zip.file('database_backup.json', jsonBlob);
                const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
                const now = new Date();
                const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const timePart = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
                const timestamp = `${datePart}_${timePart}`;
                handleDownload(zipBlob, `creator_cockpit_backup_${timestamp}.zip`);
            }
        } catch (error) {
            log.error('Export failed:', error);
        } finally {
            setIsGenerating(null);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-100 mb-2">Tabular Export (CSV)</h3>
                <p className="text-sm text-gray-400 mb-4">Best for structured analysis, statistics, and charts. Exports a ZIP file containing multiple CSVs (posts, opens, deliveries, etc.).</p>
                <button
                    onClick={() => handleExport('zip')}
                    disabled={isGenerating !== null}
                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
                >
                    {isGenerating === 'zip' ? 'Generating...' : 'Export as Tabular (ZIP)'}
                </button>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-100 mb-2">Document Export (JSON)</h3>
                <p className="text-sm text-gray-400 mb-4">Best for unstructured analysis, NLP, and for use in custom GPTs or Gems. Includes the full HTML content of each post.</p>
                <div className="flex items-center mb-4">
                    <input
                        type="checkbox"
                        id="split-json-toggle"
                        checked={splitJson}
                        onChange={(e) => setSplitJson(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="split-json-toggle" className="ml-2 text-sm text-gray-300">
                        Export as separate files (posts, subscribers, etc.) in a ZIP
                    </label>
                </div>
                <button
                    onClick={() => handleExport('json')}
                    disabled={isGenerating !== null}
                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
                >
                    {isGenerating === 'json' ? 'Generating...' : (splitJson ? 'Export as JSON (ZIP)' : 'Export as JSON (Single File)')}
                </button>
            </div>
             <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-100 mb-2">Export Both</h3>
                <p className="text-sm text-gray-400 mb-4">Generate and download both the Tabular (CSV) and Document (JSON) exports.</p>
                <button
                    onClick={() => handleExport('both')}
                    disabled={isGenerating !== null}
                    className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center justify-center"
                >
                    {isGenerating === 'both' ? 'Generating...' : 'Export Both Formats'}
                </button>
            </div>
             <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-100 mb-2">Database Backup</h3>
                <p className="text-sm text-gray-400 mb-4">Create a complete backup of the application's local database. This file can be used with the "Database Restore" tool to restore your workspace.</p>
                <button
                    onClick={() => handleExport('db')}
                    disabled={isGenerating !== null}
                    className="px-6 py-2 bg-teal-600 text-white font-semibold rounded-md hover:bg-teal-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 flex items-center justify-center"
                >
                    {isGenerating === 'db' ? 'Generating...' : 'Export Database Backup (ZIP)'}
                </button>
            </div>
        </div>
    );
};

export default ExportPackager;
import React, { useContext, useState, useEffect } from 'react';
import { DataContext } from '../contexts/DataContext';
import { SettingsContext } from '../contexts/SettingsContext';
import * as dbService from '../services/dbService';

const DebugSection: React.FC<{ title: string; count: number; description: string; children: React.ReactNode }> = ({ title, count, description, children }) => (
    <details className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer text-lg font-semibold text-gray-100 hover:bg-gray-700/50 flex justify-between items-center transition-colors">
            <span>{title} ({count.toLocaleString()})</span>
            <span className="text-sm text-gray-400 group-open:hidden">Click to expand</span>
        </summary>
        <div className="p-4 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-3">{description}</p>
            <div className="bg-gray-900 p-4 rounded-md border border-gray-700 max-h-96 overflow-auto">
                {children}
            </div>
        </div>
    </details>
);

const DebugPanel: React.FC = () => {
    const { posts, deliveryRecords, openRecords, subscriberRecords } = useContext(DataContext);
    const { logLevel, modelConfig } = useContext(SettingsContext);
    const [rawFiles, setRawFiles] = useState<{path: string, content: string}[]>([]);

    useEffect(() => {
        dbService.getAll<{path: string, content: string}>('corpus_files').then(setRawFiles);
    }, []);

    const dataSummary = {
        Posts: posts.length,
        Subscribers: subscriberRecords.length,
        Deliveries: deliveryRecords.length,
        Opens: openRecords.length,
        'Files in Corpus': rawFiles.length,
    };

    return (
        <div className="space-y-6 text-gray-300 animate-fade-in-up">
            <div>
                <h3 className="text-xl font-semibold text-gray-100 mb-3">In-Memory Data Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {Object.entries(dataSummary).map(([key, value]) => (
                        <div key={key} className="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
                            <div className="text-sm font-medium text-gray-400 uppercase tracking-wider">{key}</div>
                            <div className="text-3xl font-bold text-gray-100 mt-2">{value.toLocaleString()}</div>
                        </div>
                    ))}
                </div>
            </div>

            <DebugSection
                title="Application Settings"
                count={2}
                description="Current state of application-wide settings from contexts."
            >
                <pre className="text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify({ logLevel, modelConfig }, null, 2)}
                </pre>
            </DebugSection>
            
            <DebugSection
                title="Processed Posts Array"
                count={posts.length}
                description="This is the final `posts` data after all processing and metric aggregation."
            >
                <pre className="text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(posts, null, 2)}
                </pre>
            </DebugSection>

            <DebugSection
                title="Subscriber Records"
                count={subscriberRecords.length}
                description="This is a complete list of all records parsed from `email_list.ericduell.csv`."
            >
                <pre className="text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(subscriberRecords, null, 2)}
                </pre>
            </DebugSection>

            <DebugSection
                title="Aggregated Delivery Records"
                count={deliveryRecords.length}
                description="This is a complete list of all records parsed from all `delivers.csv` files."
            >
                <pre className="text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(deliveryRecords, null, 2)}
                </pre>
            </DebugSection>

            <DebugSection
                title="Aggregated Open Records"
                count={openRecords.length}
                description="This is a complete list of all records parsed from all `opens.csv` files."
            >
                <pre className="text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(openRecords, null, 2)}
                </pre>
            </DebugSection>
            
            <DebugSection
                title="Raw File Contents Map"
                count={rawFiles.length}
                description="This shows all files unpacked from the zip. Check if `opens.csv` and `delivers.csv` files are listed and contain content."
            >
                {rawFiles.map(({ path, content }) => (
                    <div key={path} className="mb-4">
                        <strong className="text-teal-400 break-all">{path}</strong>
                        <pre className="text-xs whitespace-pre-wrap break-all bg-gray-800 p-2 rounded mt-1">
                            {content.substring(0, 500)}{content.length > 500 ? '...' : ''}
                        </pre>
                    </div>
                ))}
            </DebugSection>
        </div>
    );
};

export default DebugPanel;
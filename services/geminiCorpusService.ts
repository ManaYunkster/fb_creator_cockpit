import { GeminiFile, Post, ContextDocument, DeliveryRecord, OpenRecord, SubscriberRecord } from '../types';
import * as geminiFileService from './geminiFileService';
import Papa from 'papaparse';
import { log } from './loggingService';
// FIX: Imported `parseInternalFileName` to be used for parsing context document names.
import { buildInternalFileName, parseInternalFileName } from '../config/file_naming_config';
import * as dbService from './dbService';

export const purgeAllLocalFiles = async (): Promise<void> => {
    log.info('geminiCorpusService: Purging all local file records...');
    await Promise.all([
        dbService.clearStore('files'),
        dbService.clearStore('file_contents'),
    ]);
    log.info(`geminiCorpusService: Purged local file records successfully.`);
};

export const registerCorpusAssetsLocally = async (
    posts: Post[],
    deliveryRecords: DeliveryRecord[],
    openRecords: OpenRecord[],
    subscriberRecords: SubscriberRecord[]
): Promise<void> => {
    log.info('geminiCorpusService: Registering structured corpus assets locally...');
    const csvOptions = { quotes: true, header: true };

    const corpusFilesFromDb = await dbService.getAll<{ path: string, content: string }>('corpus_files');
    const fileContents = new Map(corpusFilesFromDb.map(item => [item.path, item.content]));

    const assetsToRegister: { name: string; content: string; type: string, purpose: string }[] = [
        { name: 'all_posts.json', content: JSON.stringify(posts.map(p => ({...p, html_content: fileContents.get(`posts/${p.post_id}.html`) || ''})), null, 2), type: 'application/json', purpose: 'corpus-posts' },
        { name: 'all_subscribers.json', content: JSON.stringify(subscriberRecords, null, 2), type: 'application/json', purpose: 'corpus-subscribers' },
        { name: 'all_opens.json', content: JSON.stringify(openRecords, null, 2), type: 'application/json', purpose: 'corpus-opens' },
        { name: 'all_delivers.json', content: JSON.stringify(deliveryRecords, null, 2), type: 'application/json', purpose: 'corpus-delivers' },
        { name: 'all_posts_metadata.csv', content: Papa.unparse(posts, csvOptions), type: 'text/csv', purpose: 'corpus-posts' },
        { name: 'all_posts_html.csv', content: Papa.unparse(posts.map(p => ({ post_id: p.post_id, html_content: fileContents.get(`posts/${p.post_id}.html`) || '' })), csvOptions), type: 'text/csv', purpose: 'corpus-posts' },
        { name: 'all_opens.csv', content: Papa.unparse(openRecords, csvOptions), type: 'text/csv', purpose: 'corpus-opens' },
        { name: 'all_delivers.csv', content: Papa.unparse(deliveryRecords, csvOptions), type: 'text/csv', purpose: 'corpus-delivers' },
        { name: 'all_subscribers.csv', content: Papa.unparse(subscriberRecords, csvOptions), type: 'text/csv', purpose: 'corpus-subscribers' },
    ];

    const registrationPromises = assetsToRegister.map(async (asset) => {
        const internalName = buildInternalFileName(asset.name, asset.purpose);
        const file = new File([asset.content], asset.name, { type: asset.type });
        await geminiFileService.registerLocalFile(internalName, asset.name, file);
    });

    await Promise.all(registrationPromises);
    log.info(`geminiCorpusService: Registered ${assetsToRegister.length} corpus assets locally.`);
};

export const registerContextAssetsLocally = async (
    contextDocuments: ContextDocument[]
): Promise<void> => {
    log.info('geminiCorpusService: Registering context assets locally...');

    const registrationPromises = contextDocuments.map(async (doc) => {
        const originalName = parseInternalFileName(doc.id)?.originalName || doc.id;
        const file = new File([doc.content], originalName, { type: 'text/markdown' });
        await geminiFileService.registerLocalFile(doc.id, originalName, file);
    });

    await Promise.all(registrationPromises);
    log.info(`geminiCorpusService: Registered ${contextDocuments.length} context assets locally.`);
};

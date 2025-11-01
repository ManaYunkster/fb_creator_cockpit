import Papa from 'papaparse';
import { Post, DeliveryRecord, OpenRecord, SubscriberRecord } from '../types';
import { USER_CONFIG } from '../config/user_config';
import { log } from './loggingService';

const calculateWordCountFromHtml = (htmlString: string): number => {
    if (typeof document === 'undefined') {
        // Fallback for non-browser environments if ever needed
        const text = htmlString.replace(/<[^>]*>/g, ' ');
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        return words.length;
    }
    if (!htmlString) return 0;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
};

export const processCorpusData = (
    fileContents: Map<string, string>
) => {
    log.info('corpusProcessingService: processCorpusData triggered', { fileCount: fileContents.size });

    const postsCsvPath = Array.from(fileContents.keys()).find(path => path.includes('posts.csv'));
    const postsCsvText = postsCsvPath ? fileContents.get(postsCsvPath) : undefined;

    if (!postsCsvText) {
        return { posts: [], deliveryRecords: [], openRecords: [], subscriberRecords: [], error: "Could not find 'posts.csv'. This file is required." };
    }

    const opensMap = new Map<string, number>();
    const deliversMap = new Map<string, number>();
    const allDeliveryRecords: DeliveryRecord[] = [];
    const allOpenRecords: OpenRecord[] = [];

    for (const [path, content] of fileContents.entries()) {
        const isOpensFile = path.endsWith('.opens.csv');
        const isDeliversFile = path.endsWith('.delivers.csv');

        if (isOpensFile || isDeliversFile) {
            const result = Papa.parse(content, { header: true, skipEmptyLines: true });
            if (result.data) {
                for (const row of result.data as any[]) {
                    if (row && typeof row.post_id === 'string' && row.post_id.trim() !== '') {
                        const postId = row.post_id.trim();
                        const targetMap = isOpensFile ? opensMap : deliversMap;
                        targetMap.set(postId, (targetMap.get(postId) || 0) + 1);

                        if (isOpensFile) allOpenRecords.push({ ...row, post_id: postId, active_subscription: row.active_subscription === 'true' });
                        else allDeliveryRecords.push({ ...row, post_id: postId, active_subscription: row.active_subscription === 'true' });
                    }
                }
            }
        }
    }

    const subscriberListCsvPath = Array.from(fileContents.keys()).find(path => path.includes('email_list') && path.endsWith('.csv'));
    const subscriberListCsvText = subscriberListCsvPath ? fileContents.get(subscriberListCsvPath) : undefined;
    let subscriberRecords: SubscriberRecord[] = [];

    if (subscriberListCsvText) {
        const subscriberResult = Papa.parse(subscriberListCsvText, { header: true, skipEmptyLines: true });
        if (subscriberResult.data) {
            subscriberRecords = (subscriberResult.data as any[]).map(row => ({
                ...row,
                active_subscription: row.active_subscription === 'true',
                email_disabled: row.email_disabled === 'true',
            }));
        }
    }

    const postsResult = Papa.parse(postsCsvText, { header: true, skipEmptyLines: true });
    if (postsResult.errors.length > 0) {
        return { posts: [], deliveryRecords: [], openRecords: [], subscriberRecords: [], error: 'Encountered errors parsing posts.csv.' };
    }

    const allParsedPosts = postsResult.data as any[];
    
    // Identify draft posts (null or empty post_date) and filter them out
    const draftPostIds = new Set<string>();
    allParsedPosts.forEach(post => {
        if (!post.post_date || post.post_date.trim() === '') {
            if (post.post_id) {
                draftPostIds.add(post.post_id);
            }
        }
    });

    if (draftPostIds.size > 0) {
        log.info(`corpusProcessingService: Identified and will discard ${draftPostIds.size} draft posts.`);
    }

    const publishedPostsData = allParsedPosts.filter(post => post.post_id && !draftPostIds.has(post.post_id));


    const finalPosts = publishedPostsData
        .map(post => {
            const fullPostId = post.post_id || '';
            if (!fullPostId) return null;

            const numericPostId = fullPostId.split('.')[0];
            const slug = fullPostId.substring(fullPostId.indexOf('.') + 1);
            const postUrl = slug ? `${USER_CONFIG.SUBSTACK_BASE_URL}${slug}` : '';

            const htmlPath = Array.from(fileContents.keys()).find(p => p.includes(`${fullPostId}.html`));
            const htmlContent = htmlPath ? fileContents.get(htmlPath) : undefined;
            const wordCount = htmlContent ? calculateWordCountFromHtml(htmlContent) : 0;

            return {
                ...post,
                is_published: post.is_published === 'true',
                word_count: wordCount,
                total_deliveries: deliversMap.get(numericPostId) || 0,
                total_opens: opensMap.get(numericPostId) || 0,
                post_url: postUrl,
            };
        })
        .filter(Boolean) as Post[];
    
    log.info('corpusProcessingService: Data processed successfully.', {
        postCount: finalPosts.length,
        deliveryCount: allDeliveryRecords.length,
        openCount: allOpenRecords.length,
        subscriberCount: subscriberRecords.length,
    });

    return {
        posts: finalPosts,
        deliveryRecords: allDeliveryRecords,
        openRecords: allOpenRecords,
        subscriberRecords: subscriberRecords,
        error: null,
    };
};
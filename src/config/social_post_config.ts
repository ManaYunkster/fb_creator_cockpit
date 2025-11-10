interface PostLengthOption {
    id: string;
    label: string;
}

interface VenueLengthConfig {
    default: string;
    options: PostLengthOption[];
}

export const VENUE_LENGTH_CONFIG: Record<string, VenueLengthConfig> = {
    'Substack Notes': {
        default: 'standard',
        options: [
            { id: 'short', label: 'Short Note (2-3 sentences)' },
            { id: 'standard', label: 'Standard Note (4-6 sentences)' },
            { id: 'long', label: 'Detailed Note (7+ sentences)' },
        ]
    },
    'LinkedIn (Personal Feed)': {
        default: 'detailed',
        options: [
            { id: 'short', label: 'Short Post (3-5 sentences)' },
            { id: 'standard', label: 'Standard Post (6-9 sentences)' },
            { id: 'detailed', label: 'Detailed Post (10-13 sentences)' },
            { id: 'long', label: 'Long-Form Post (14+ sentences)' },
        ]
    },
    'LinkedIn (The Do Good by Doing Better Page)': {
        default: 'standard',
        options: [
            { id: 'short', label: 'Short Post (3-5 sentences)' },
            { id: 'standard', label: 'Standard Post (6-9 sentences)' },
            { id: 'detailed', label: 'Detailed Post (10-13 sentences)' },
        ]
    },
    'BlueSky (Personal Feed)': {
        default: 'short',
        options: [
            { id: 'headline', label: 'Headline & Link (~150 chars)' },
            { id: 'short', label: 'Short Post (~250 chars)' },
        ]
    }
};

export interface UtmConfig {
    source: string;
    medium: string;
    campaign?: string; // Optional: Acts as an override for the dynamic campaign name
    defaultCampaignForCustomUrl: string; // Required fallback for when no post title is available
    term?: string;
    content?: string;
    showWelcomeOnShare: boolean;
}

export const VENUE_UTM_CONFIG: Record<string, UtmConfig> = {
    'Substack Callback': {
        source: 'substack-callback',
        medium: 'web',
        defaultCampaignForCustomUrl: 'callback-promotion',
        showWelcomeOnShare: true,
    },
    'Substack Notes': {
        source: 'substack-notes',
        medium: 'web',
        defaultCampaignForCustomUrl: 'substack-notes-promotion',
        showWelcomeOnShare: true,
    },
    'LinkedIn (Personal Feed)': {
        source: 'linkedin',
        medium: 'web',
        defaultCampaignForCustomUrl: 'linkedin-promotion',
        showWelcomeOnShare: false,
    },
    'LinkedIn (The Do Good by Doing Better Page)': {
        source: 'linkedin-dgdb-page',
        medium: 'web',
        defaultCampaignForCustomUrl: 'linkedin-page-promotion',
        showWelcomeOnShare: false,
    },
    'BlueSky (Personal Feed)': {
        source: 'bluesky',
        medium: 'web',
        defaultCampaignForCustomUrl: 'bluesky-promotion',
        showWelcomeOnShare: false,
    },
};
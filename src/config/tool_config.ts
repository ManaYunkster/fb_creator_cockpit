import React from 'react';
import { Tool, ToolConfig } from '../types';

// Icons
import ArchiveBoxIcon from '../components/icons/ArchiveBoxIcon';
import BookOpenIcon from '../components/icons/BookOpenIcon';
import FolderIcon from '../components/icons/FolderIcon';
import ChatAssistantIcon from '../components/icons/ChatAssistantIcon';
import InformationCircleIcon from '../components/icons/InformationCircleIcon';
import SocialPostAssistantIcon from '../components/icons/SocialPostAssistantIcon';
import ArrowDownTrayIcon from '../components/icons/ArrowDownTrayIcon';
import BranchIcon from '../components/icons/BranchIcon';
import LadybugIcon from '../components/icons/LadybugIcon';
import ClipboardPencilIcon from '../components/icons/ClipboardPencilIcon';
import DatabaseIcon from '../components/icons/DatabaseIcon';

// Components
import ContentCorpusUploader from '../components/ContentCorpusUploader';
import ContentContextPanel from '../components/ContentContextPanel';
import FileManagementPanel from '../components/FileManagementPanel';
import ChatAssistantPanel from '../components/ChatAssistantPanel';
import PostInsights from '../components/PostInsights';
import SocialPostAssistant from '../components/SocialPostAssistant';
import ExportPackager from '../components/ExportPackager';
import DebugPanel from '../components/DebugPanel';
import QuoteFinder from '../components/QuoteFinder';
import RegressionTestsPanel from '../components/RegressionTestsPanel';
import DatabaseRestorer from '../components/DatabaseRestorer';

export const TOOL_CONFIG: ToolConfig[] = [
    {
        id: Tool.ContentCorpus,
        numericalId: 1,
        name: 'Content Corpus',
        prefix: 'cc',
        description: 'Upload your Substack export data.',
        icon: ArchiveBoxIcon,
        component: ContentCorpusUploader,
        enabled: true,
    },
    {
        id: Tool.DATABASE_RESTORER,
        numericalId: 2,
        name: 'Database Restore',
        prefix: 'dbr',
        description: 'Restore the app state from a backup.',
        icon: DatabaseIcon,
        component: DatabaseRestorer,
        enabled: true,
    },
    {
        id: Tool.ContentContext,
        numericalId: 3,
        name: 'Content Context',
        prefix: 'cctx',
        description: 'View the foundational brand documents.',
        icon: BookOpenIcon,
        component: ContentContextPanel,
        enabled: true,
    },
    {
        id: Tool.FILE_MANAGEMENT,
        numericalId: 4,
        name: 'File Management',
        prefix: 'fm',
        description: 'Upload and manage files for Gemini.',
        icon: FolderIcon,
        component: FileManagementPanel,
        enabled: true,
    },
    {
        id: Tool.PostInsights,
        numericalId: 7,
        name: 'Post Insights',
        prefix: 'pi',
        description: 'Analyze your posts from the uploaded data.',
        icon: InformationCircleIcon,
        component: PostInsights,
        requiredData: ['posts'],
        enabled: true,
    },
    {
        id: Tool.ExportPackager,
        numericalId: 9,
        name: 'Export Packager',
        prefix: 'ep',
        description: 'Export data for custom GPTs and Gems.',
        icon: ArrowDownTrayIcon,
        component: ExportPackager,
        requiredData: ['posts'],
        enabled: true,
    },
    {
        id: Tool.CHAT_ASSISTANT,
        numericalId: 5,
        name: 'Chat Assistant',
        prefix: 'chat',
        description: 'Chat with Gemini, with file support.',
        icon: ChatAssistantIcon,
        component: ChatAssistantPanel,
        enabled: true,
    },
    {
        id: Tool.QuoteFinder,
        numericalId: 6,
        name: 'Quotes and Callbacks',
        prefix: 'qf',
        description: 'Find quotes & compose callbacks.',
        icon: BranchIcon,
        component: QuoteFinder,
        requiredData: ['posts'],
        enabled: true,
    },
    {
        id: Tool.SocialPostAssistant,
        numericalId: 8,
        name: 'Social Post Assistant',
        prefix: 'spa',
        description: 'Generate social posts from articles.',
        icon: SocialPostAssistantIcon,
        component: SocialPostAssistant,
        enabled: true,
    },
    {
        id: Tool.Debug,
        numericalId: 13,
        name: 'Debug View',
        prefix: 'dbg',
        description: "Inspect the application's in-memory data.",
        icon: LadybugIcon,
        component: DebugPanel,
        enabled: true,
    },
    {
        id: Tool.RegressionTests,
        numericalId: 14,
        name: 'Regression Tests',
        prefix: 'rt',
        description: 'Activate specific test conditions.',
        icon: ClipboardPencilIcon,
        component: RegressionTestsPanel,
        enabled: true, // This is a baseline; App.tsx controls visibility
    },
];
// FIX: Added import for React to resolve namespace errors for React types like React.FC and React.ReactNode.
import React from 'react';
// FIX: Removed circular dependency import. The types DeliveryRecord, OpenRecord, Post, and SubscriberRecord are defined within this file.
// import { DeliveryRecord, OpenRecord, Post, SubscriberRecord } from ".";


export enum Tool {
  ContentCorpus = 'CONTENT_CORPUS',
  ContentContext = 'CONTENT_CONTEXT',
  PostInsights = 'POST_INSIGHTS',
  IdeaGenerator = 'IDEA_GENERATOR',
  DraftingAssistant = 'DRAFTing_ASSISTANT',
  SEOOptimizer = 'SEO_OPTIMIZER',
  ImageFinder = 'IMAGE_FINDER',
  Debug = 'DEBUG',
  ExportPackager = 'EXPORT_PACKAGER',
  SocialPostAssistant = 'SOCIAL_POST_ASSISTANT',
  FILE_MANAGEMENT = 'FILE_MANAGEMENT',
  CHAT_ASSISTANT = 'CHAT_ASSISTANT',
  QuoteFinder = 'QUOTE_FINDER',
  RegressionTests = 'REGRESSION_TESTS',
  DATABASE_RESTORER = 'DATABASE_RESTORER',
}

export interface PreloadedAsset {
    key: string;
    path: string;
    type: 'zip' | 'markdown' | 'csv' | 'html';
    loader: 'DataContext' | 'ContentContext';
    loadOnStartup: boolean;
    required: boolean;
}

export interface ContextDocument {
  id: string;
  content: string;
  classification: string;
  summary: string;
  profile: string;
}

export interface GeminiFile {
  name: string; // e.g., "files/12345"
  displayName: string; // This will hold the API name
  mimeType: string;
  sizeBytes: string; // API returns it as a string
  createTime: string; // ISO 8601 date string
  updateTime: string; // ISO 8601 date string
  expirationTime?: string; // ISO 8601 date string
  uri: string;
  state?: 'PROCESSING' | 'ACTIVE' | 'FAILED';
  sha256Hash?: string;
  videoMetadata?: {
    video_duration: {
      seconds: number;
      nanos: number;
    }
  };
  isDisplayNameCached?: boolean;
  cachedDisplayName?: string; // New property for the user-facing name
  context?: string;
  scope?: string;
}

export interface FileContentRecord {
  internalName: string; // The prefixed name, e.g., __cc_...
  content: Blob;
  mimeType: string;
}

export interface Post {
  // From posts.csv
  post_id: string;
  post_date: string;
  is_published: boolean;
  email_sent_at: string;
  inbox_sent_at: string;
  type: string;
  audience: string;
  title: string;
  subtitle: string;
  podcast_url: string;

  // Enriched data
  word_count: number;
  total_deliveries: number;
  total_opens: number;
  post_url: string;
}

export interface DeliveryRecord {
  post_id: string;
  timestamp: string;
  email: string;
  post_type: string;
  post_audience: string;
  active_subscription: boolean;
}

export interface OpenRecord {
  post_id: string;
  timestamp: string;
  email: string;
  post_type: string;
  post_audience: string;
  active_subscription: boolean;
  country?: string;
  city?: string;
  region?: string;
  device_type?: string;
  client_os?: string;
  client_type?: string;
  user_agent?: string;
}

export interface SubscriberRecord {
  email: string;
  active_subscription: boolean;
  expiry?: string | null;
  plan: string;
  email_disabled: boolean;
  created_at: string;
  first_payment_at?: string | null;
}

// FIX: Moved CallbackResult from QuoteFinder.tsx to types.ts to be shared across the application.
export interface CallbackResult {
    topicHeader: string;
    workingArticleAnchor: string;
    precedingWorkingContext?: string;
    followingWorkingContext?: string;
    callbackSentence: string;
    // FIX: Added anchorQuote property to match the AI response schema and fix type errors.
    anchorQuote: string;
    sourceTitle: string;
    sourceUrl: string;
    precedingContext?: string;
    followingContext?: string;
    whyItMatched: string;
}

export enum HarmCategory {
  HARM_CATEGORY_HARASSMENT = 'HARM_CATEGORY_HARASSMENT',
  HARM_CATEGORY_HATE_SPEECH = 'HARM_CATEGORY_HATE_SPEECH',
  HARM_CATEGORY_SEXUALLY_EXPLICIT = 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  HARM_CATEGORY_DANGEROUS_CONTENT = 'HARM_CATEGORY_DANGEROUS_CONTENT',
}

export enum HarmBlockThreshold {
  BLOCK_NONE = 'BLOCK_NONE',
  BLOCK_ONLY_HIGH = 'BLOCK_ONLY_HIGH',
  BLOCK_LOW_AND_ABOVE = 'BLOCK_LOW_AND_ABOVE',
  BLOCK_MEDIUM_AND_ABOVE = 'BLOCK_MEDIUM_AND_ABOVE',
}

export interface SafetySetting {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
}

export interface ModelConfig {
    model: string;
    thinkingMode: 'enabled' | 'disabled';
    temperature: number;
    thinkingBudget: number;
    useDynamicBudget: boolean;
    safetySettings: SafetySetting[];
}

export interface AvailableModel {
  name: string;
  displayName: string;
  supportsThinking: boolean;
}

export interface GeminiCorpusState {
  status: 'EMPTY' | 'SYNCING' | 'READY' | 'ERROR';
  allFiles: GeminiFile[];
  corpusFiles: Map<string, GeminiFile>; // Key: e.g., 'all_posts.json', Value: GeminiFile object
  contextFiles: Map<string, GeminiFile>; // Key: e.g., 'brand-brief.md', Value: GeminiFile object
  error: string | null;
}

export interface GeminiCorpusContextType extends GeminiCorpusState {
  resetCorpus: () => void;
  refreshSyncedFiles: () => Promise<void>;
  forceResync: () => Promise<void>;
}

export interface ToolConfig {
  id: Tool;
  numericalId: number;
  name: string;
  prefix: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  component: React.ComponentType<{ onClose: () => void }>;
  requiredData?: ('posts' | 'contextDocuments')[];
  enabled: boolean;
}

// A complete prompt template including its content.
export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    filePath: string;
    content: string;
    type: 'SYSTEM_INSTRUCTION' | 'USER_PROMPT';
}

// The definition of a prompt, without its content, used for configuration.
export type PromptTemplateDefinition = Omit<PromptTemplate, 'content'>;

export type LogLevelString = 'NONE' | 'ERROR' | 'INFO' | 'PROMPTS' | 'DEBUG';

export interface DataContextType {
    posts: Post[];
    deliveryRecords: DeliveryRecord[];
    openRecords: OpenRecord[];
    subscriberRecords: SubscriberRecord[];
    setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
    setDeliveryRecords: React.Dispatch<React.SetStateAction<DeliveryRecord[]>>;
    setOpenRecords: React.Dispatch<React.SetStateAction<OpenRecord[]>>;
    setSubscriberRecords: React.Dispatch<React.SetStateAction<SubscriberRecord[]>>;
    resetData: () => Promise<void>;
    isLoadingCorpus: boolean;
    isCorpusReady: boolean;
    setIsCorpusReady: React.Dispatch<React.SetStateAction<boolean>>;
    loadCorpus: () => Promise<void>;
}

export interface ContentContextType {
    contextDocuments: ContextDocument[];
    isLoading: boolean;
    isContextReady: boolean;
    loadContext: () => Promise<void>;
    addContextDocument: (file: File, internalName: string) => Promise<void>;
    removeContextDocument: (internalName: string) => Promise<void>;
}
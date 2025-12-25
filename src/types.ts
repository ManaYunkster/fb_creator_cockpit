import React from 'react';

export enum Tool {
  ContentCorpus = 'CONTENT_CORPUS',
  ContentContext = 'CONTENT_CONTEXT',
  PostInsights = 'POST_INSIGHTS',
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
  isPermanent?: boolean;
}

export interface GeminiFile {
  name: string; 
  displayName: string;
  mimeType: string;
  sizeBytes: string;
  createTime: string;
  updateTime: string;
  expirationTime?: string;
  uri: string;
  state?: 'PROCESSING' | 'ACTIVE' | 'FAILED';
  sha256Hash?: string;
  videoMetadata?: { video_duration: { seconds: number; nanos: number; } };
  isDisplayNameCached?: boolean;
  cachedDisplayName?: string;
  context?: string;
  scope?: string;
  status?: 'synced' | 'local_only' | 'api_only' | 'unknown';
  isPermanent?: boolean;
}

export interface FileContentRecord {
  internalName: string;
  content: Blob;
  mimeType: string;
  name: string;
  type: string;
  modified: number;
}

export interface Post {
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

export interface CallbackResult {
    topicHeader: string;
    workingArticleAnchor: string;
    precedingWorkingContext?: string;
    followingWorkingContext?: string;
    callbackSentence: string;
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

export type CorpusSyncStatus = 'EMPTY' | 'SYNCING' | 'READY' | 'ERROR';

export interface GeminiCorpusContextType {
    status: CorpusSyncStatus;
    contextFiles: Map<string, GeminiFile>;
    syncCorpus: () => Promise<void>;
    forceResync: () => Promise<void>;
    syncStatus: string; 
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

export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    filePath: string;
    content: string;
    type: 'SYSTEM_INSTRUCTION' | 'USER_PROMPT';
}

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

interface InspirationBase {
    id: string;
}
export interface ImageInspiration extends InspirationBase {
    type: 'image';
    file: File;
    previewUrl: string;
    base64: string;
}
export interface TextInspiration extends InspirationBase {
    type: 'text';
    text: string;
}
export type Inspiration = ImageInspiration | TextInspiration;

export interface GeneratedPost {
  id: string;
  quote: string | null;
  imageUrl: string | null;
  rawContent: string;
  isRegenerating: boolean;
  sources?: { uri: string; title: string }[];
}

export interface ProcessedPost extends GeneratedPost {
    content: string;
}

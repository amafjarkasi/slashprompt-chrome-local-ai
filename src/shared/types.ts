export type AiMode =
  | 'enhance'
  | 'rewrite-concise'
  | 'rewrite-formal'
  | 'expand'
  | 'summarize'
  | 'proofread';

export type EnhanceStyle =
  | 'structured'
  | 'concise'
  | 'coding'
  | 'creative';

export type ApiAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable';

export interface AiCapabilitiesStatus {
  prompt: ApiAvailability;
  rewriter: ApiAvailability;
  writer: ApiAvailability;
  summarizer: ApiAvailability;
  proofreader: ApiAvailability;
}

export interface ExtensionSettings {
  triggerPrefix: string;
  defaultStyle: EnhanceStyle;
  enabled: boolean;
  demoFallback: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  triggerPrefix: '//',
  defaultStyle: 'structured',
  enabled: true,
  demoFallback: false,
};

export interface PromptHistoryItem {
  id: string;
  original: string;
  enhanced: string;
  mode: AiMode;
  style: EnhanceStyle;
  timestamp: number;
  starred?: boolean;
}

export interface EnhanceRequest {
  type: 'ENHANCE_PROMPT';
  prompt: string;
  mode: AiMode;
  style: EnhanceStyle;
}

export type StreamPortMessage =
  | { type: 'CHUNK'; text: string; fullText: string }
  | { type: 'DOWNLOAD_PROGRESS'; progress: number }
  | { type: 'DONE'; fullText: string; usedDemoFallback?: boolean }
  | { type: 'ERROR'; error: string; needsSetup?: boolean };

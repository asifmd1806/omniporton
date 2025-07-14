import type { ChatMessage, MessageContent } from '../chat/types';

// Tool protocol types for template system
export type ToolProtocol = "function_calling" | "tool_use" | "tool" | "auto" | "none";

// Multi-modal template capabilities
export interface TemplateCapabilities {
  supportsText: boolean;
  supportsImages: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsDocuments: boolean;
  maxImageCount?: number;
  maxAudioCount?: number;
  maxVideoCount?: number;
  maxDocumentCount?: number;
}

// Ollama-style prompt template definition
export type Template = {
  name: string;
  content: string;
  stop?: string[];
  protocol?: ToolProtocol;
  toolCallFormat?: 'json' | 'xml' | 'yaml' | 'auto';
  preprocess?: (messages: ChatMessage[]) => any;
  capabilities?: TemplateCapabilities;
  multiModalPreprocess?: (content: MessageContent) => string;
}; 

export type { ChatMessage }; 
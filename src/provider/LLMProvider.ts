import type { ChatMessage } from '../chat/types';

export interface ProviderResponse {
  content?: string;
  tokens?: string[];
  raw?: any;
  finished?: boolean;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface StreamChunk {
  content?: string;
  token?: string;
  raw?: any;
  finished?: boolean;
}

export interface CompletionParams {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
  tools?: any[];
  tool_choice?: 'auto' | 'none' | 'required' | string;
  [key: string]: any;
}

export interface LLMProvider {
  readonly name: string;
  readonly type: 'local' | 'api';
  
  completion(params: CompletionParams): Promise<ProviderResponse>;
  
  stream?(params: CompletionParams, onChunk: (chunk: StreamChunk) => void): Promise<void>;
  
  supportsTools?(): boolean;
  supportsStreaming?(): boolean;
  supportsMultiModal?(): boolean;
  
  // Provider-specific configuration
  configure?(options: Record<string, any>): void;
}
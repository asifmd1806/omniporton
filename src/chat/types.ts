import type { ZodTypeAny } from 'zod';
import type { ModelId } from '../model';

// Multi-modal content types
export type MediaType = 'image' | 'audio' | 'video' | 'document';

export interface MediaContent {
  type: MediaType;
  url?: string;          // URL to media file
  data?: string;         // Base64 encoded data
  mimeType?: string;     // MIME type (e.g., 'image/jpeg', 'audio/wav')
  filename?: string;     // Original filename
  metadata?: Record<string, any>; // Additional metadata
}

export interface TextContent {
  type: 'text';
  text: string;
}

export type MessageContent = TextContent | MediaContent | (TextContent | MediaContent)[];

// Enhanced message input that supports multi-modal content
export interface MessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent;
}

// Tool/function definition for registration
export type ToolDefinition = {
  name: string;
  description: string;
  schema: ZodTypeAny;
  handler: (args: any) => Promise<any> | any;
};

// Chat message types, including tool messages and multi-modal support
export type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string | MessageContent }
  | ToolMessage;

export type ToolMessage = {
  role: 'tool';
  name: string; // tool/function name
  content: string; // tool output or function call result
  args?: Record<string, any>; // arguments passed to the tool
};

// Chat completion parameters
export interface ChatCompletionParams {
  messages: ChatMessage[];
  n_predict?: number;
  stop?: string[];
  [key: string]: any;
}

// Streaming partial data can be either visible content or a parsed tool call event
export type PartialContentData =
  | { type: 'content'; text: string }
  | { type: 'tool_call'; toolCall: any };

export type PartialCompletionCallback = (data: PartialContentData) => void; 

export interface ToolCallResult {
    id?: string;
    name: string;
    args: Record<string, any>;
    result?: any;
    raw?: any; // The original parsed tool call object
    error?: string;
  }
  
  export interface HandleToolCallArgs {
    modelId: string;
    protocol: string;
    toolCallFormat: 'json' | 'xml' | 'yaml' | 'auto';
    modelOutput: string;
    addMessage: (msg: ChatMessage) => void;
    getTool: (name: string) => ToolDefinition | undefined;
    processedToolCallIds?: Set<string>; // Optional: pass in a set to persist across calls/streams
  } 
export interface ToolCall {
  id?: string;
  name: string;
  arguments: Record<string, any>;
  type?: 'function' | 'tool' | 'action';
  format?: 'json' | 'xml' | 'yaml' | 'text' | 'openai_tools' | 'function_calling' | 'gemini_function_call' | 'anthropic_tool_use' | 'mistral_function_call' | 'groq_function_call';
  raw?: any;
}

export interface ExtractedSegment {
  type: 'content' | 'tool_call' | 'system' | 'error';
  data: any;
  metadata?: {
    provider?: string;
    format?: string;
    confidence?: number;
    raw?: any;
  };
}

export interface MessageExtractor {
  readonly name: string;
  readonly supportedFormats: string[];
  
  extract(response: any): ExtractedSegment[];
  
  // Extract tool calls from various formats
  extractToolCalls?(text: string): ToolCall[];
  
  // Extract content only
  extractContent?(response: any): string;
  
  // Check if response contains tool calls
  hasToolCalls?(response: any): boolean;
  
  // Validate tool call format
  validateToolCall?(toolCall: any): boolean;
}
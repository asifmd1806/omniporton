import type { LLMProvider, CompletionParams } from '../provider';
import type { MessageExtractor, ExtractedSegment, ToolCall } from '../extractor';
import type { Template } from '../template/types';
import type { ChatMessage, MessageContent } from '../chat/types';
import { extractText, isMultiModal } from '../utils/media';
import type { MCPService } from '../mcp/MCPService';
import { StreamingExtractor } from '../extractor/streaming/StreamingExtractor';
import { MonitoringService } from '../monitoring/MonitoringService';
import { v4 as uuidv4 } from 'uuid';
import { estimateCost } from '../utils/cost';

export interface ChatSessionOptions {
  maxToolCalls?: number;
  toolCallTimeout?: number;
  agenticMode?: boolean;
  maxAgenticIterations?: number;
  onToolCall?: (toolCall: ToolCall, result: any) => void;
  onError?: (error: Error) => void;
  monitoring?: {
    enabled?: boolean;
    trackTokens?: boolean;
    trackCosts?: boolean;
    trackTools?: boolean;
    metadata?: Record<string, any>;
  };
}

export interface ToolCallResult {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  error?: string;
  timestamp: number;
}

export class ChatSession {
  private history: ChatMessage[] = [];
  private toolCallResults: ToolCallResult[] = [];
  private options: ChatSessionOptions;
  private monitoringService?: MonitoringService;
  private sessionStartTime: Date;

  constructor(
    public id: string,
    private provider: LLMProvider,
    private extractor: MessageExtractor,
    private template: Template,
    private mcpService?: MCPService,
    initialHistory: ChatMessage[] = [],
    options: ChatSessionOptions = {},
    private agentId?: string,
    monitoringService?: MonitoringService
  ) {
    this.history = [...initialHistory];
    this.options = {
      maxToolCalls: 10,
      toolCallTimeout: 30000,
      agenticMode: false,
      maxAgenticIterations: 5,
      monitoring: {
        enabled: false,
        trackTokens: true,
        trackCosts: true,
        trackTools: true,
        ...options.monitoring
      },
      ...options
    };
    this.sessionStartTime = new Date();
    this.monitoringService = monitoringService;
    
    if (this.isMonitoringEnabled() && this.monitoringService && this.agentId) {
      this.monitoringService.startSession(this.id, this.agentId);
    }
  }

  async chat(message: string | MessageContent, params: Partial<CompletionParams> = {}): Promise<string> {
    const requestId = uuidv4();
    const startTime = Date.now();
    
    if (this.isMonitoringEnabled()) {
      this.trackRequestStart(requestId, message, params);
    }
    
    try {
      this.addMessage({ role: 'user', content: message });
      
      let response: string;
      if (this.options.agenticMode) {
        response = await this.agenticChat(params);
      } else {
        response = await this.singleTurnChat(params);
      }
      
      if (this.isMonitoringEnabled()) {
        this.trackRequestEnd(requestId, response, startTime, true);
      }
      
      return response;
      
    } catch (error) {
      if (this.isMonitoringEnabled()) {
        this.trackRequestEnd(requestId, '', startTime, false, error);
      }
      
      throw error;
    }
  }

  private async singleTurnChat(params: Partial<CompletionParams>): Promise<string> {
    const response = await this.provider.completion({
      messages: this.history,
      tools: this.mcpService ? this.getToolsForProvider() : undefined,
      ...params
    });

    const segments = this.extractor.extract(response.raw);
    return this.processSegments(segments);
  }

  private async agenticChat(params: Partial<CompletionParams>): Promise<string> {
    let finalResponse = '';
    let iterations = 0;
    
    while (iterations < (this.options.maxAgenticIterations || 5)) {
      const response = await this.provider.completion({
        messages: this.history,
        tools: this.mcpService ? this.getToolsForProvider() : undefined,
        ...params
      });

      const segments = this.extractor.extract(response.raw);
      const result = await this.processSegments(segments);
      
      // If no tool calls were made, we're done
      const hasToolCalls = segments.some(s => s.type === 'tool_call');
      if (!hasToolCalls) {
        finalResponse = result;
        break;
      }
      
      iterations++;
    }

    return finalResponse;
  }

  async stream(
    message: string | MessageContent,
    params: Partial<CompletionParams> = {},
    onChunk?: (data: { type: 'content' | 'tool_call' | 'tool_result', data: any }) => void
  ): Promise<string> {
    const requestId = uuidv4();
    const startTime = Date.now();
    
    if (this.isMonitoringEnabled()) {
      this.trackRequestStart(requestId, message, params);
    }
    
    try {
      this.addMessage({ role: 'user', content: message });
      
      if (!this.provider.stream) {
        throw new Error('Provider does not support streaming');
      }

      const streamingExtractor = new StreamingExtractor({
        baseExtractor: this.extractor
      });

      let finalContent = '';
      const pendingToolCalls: ToolCall[] = [];
      const toolCallsUsed: string[] = [];

      const monitoredOnChunk = (data: { type: 'content' | 'tool_call' | 'tool_result', data: any }) => {
        if (this.isMonitoringEnabled()) {
          if (data.type === 'tool_call') {
            toolCallsUsed.push(data.data.name);
            this.trackToolCall(requestId, data.data, Date.now() - startTime);
          } else if (data.type === 'tool_result') {
            this.trackToolResult(requestId, data.data);
          }
        }
        onChunk?.(data);
      };

      await this.provider.stream({
        messages: this.history,
        tools: this.mcpService ? this.getToolsForProvider() : undefined,
        ...params
      }, async (chunk) => {
        const segments = streamingExtractor.pushToken(chunk.token || chunk.content || '');
        
        for (const segment of segments) {
          if (segment.type === 'content') {
            finalContent += segment.data;
            monitoredOnChunk({ type: 'content', data: segment.data });
          } else if (segment.type === 'tool_call') {
            const toolCall = segment.data as ToolCall;
            pendingToolCalls.push(toolCall);
            monitoredOnChunk({ type: 'tool_call', data: toolCall });
          }
        }
      });

      // Process any finalized tool calls
      const finalSegments = streamingExtractor.finalize();
      for (const segment of finalSegments) {
        if (segment.type === 'tool_call') {
          pendingToolCalls.push(segment.data as ToolCall);
        }
      }

      // Execute tool calls in order
      if (pendingToolCalls.length > 0) {
        await this.executeToolCalls(pendingToolCalls, (result) => {
          monitoredOnChunk({ type: 'tool_result', data: result });
        });
      }

      // Add assistant message with content
      if (finalContent.trim()) {
        this.addMessage({ role: 'assistant', content: finalContent });
      }
      
      if (this.isMonitoringEnabled()) {
        this.trackRequestEnd(requestId, finalContent, startTime, true);
      }

      return finalContent;
      
    } catch (error) {
      if (this.isMonitoringEnabled()) {
        this.trackRequestEnd(requestId, '', startTime, false, error);
      }
      
      throw error;
    }
  }

  private async processSegments(segments: ExtractedSegment[]): Promise<string> {
    let assistantContent = '';
    const toolCalls: ToolCall[] = [];
    
    // Collect content and tool calls
    for (const segment of segments) {
      if (segment.type === 'content') {
        assistantContent += segment.data;
      } else if (segment.type === 'tool_call') {
        toolCalls.push(segment.data as ToolCall);
      }
    }

    // Add assistant message with content (before tool calls)
    if (assistantContent.trim()) {
      this.addMessage({ role: 'assistant', content: assistantContent });
    }

    // Execute tool calls in order
    if (toolCalls.length > 0 && this.mcpService) {
      await this.executeToolCalls(toolCalls);
    }

    return assistantContent;
  }

  private async executeToolCalls(
    toolCalls: ToolCall[], 
    onResult?: (result: ToolCallResult) => void
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      try {
        if (!this.mcpService) {
          throw new Error('MCP service not available');
        }

        const startTime = Date.now();
        const result = await Promise.race([
          this.mcpService.executeTool(toolCall.name, toolCall.arguments),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Tool call timeout')), this.options.toolCallTimeout)
          )
        ]);

        const toolResult: ToolCallResult = {
          id: toolCall.id || `call_${Date.now()}`,
          name: toolCall.name,
          arguments: toolCall.arguments,
          result,
          timestamp: Date.now() - startTime
        };

        this.toolCallResults.push(toolResult);
        this.options.onToolCall?.(toolCall, result);
        onResult?.(toolResult);

        // Add tool message to conversation
        this.addMessage({
          role: 'tool',
          name: toolCall.name,
          content: typeof result === 'string' ? result : JSON.stringify(result),
          args: toolCall.arguments
        } as any);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        const toolResult: ToolCallResult = {
          id: toolCall.id || `call_${Date.now()}`,
          name: toolCall.name,
          arguments: toolCall.arguments,
          error: errorMsg,
          timestamp: Date.now()
        };

        this.toolCallResults.push(toolResult);
        this.options.onError?.(error instanceof Error ? error : new Error(errorMsg));
        onResult?.(toolResult);

        // Add error message to conversation
        this.addMessage({
          role: 'assistant',
          content: `Error executing ${toolCall.name}: ${errorMsg}`
        });
      }
    }
  }

  private getToolsForProvider(): any[] {
    if (!this.mcpService) return [];
    
    const tools = this.mcpService.listTools();
    
    // Convert to provider-specific format
    if (this.provider.name === 'openai') {
      return tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: this.zodToJsonSchema(tool.schema)
        }
      }));
    }

    // Default format
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: this.zodToJsonSchema(tool.schema)
    }));
  }

  private zodToJsonSchema(schema: any): any {
    // Simple conversion - in real implementation, use zod-to-json-schema
    return {
      type: 'object',
      properties: {},
      required: []
    };
  }

  addMessage(message: ChatMessage): void {
    this.history.push(message);
  }

  getHistory(): ChatMessage[] {
    return [...this.history];
  }

  getToolCallResults(): ToolCallResult[] {
    return [...this.toolCallResults];
  }

  clearHistory(): void {
    this.history = [];
    this.toolCallResults = [];
  }

  updateOptions(options: Partial<ChatSessionOptions>): void {
    this.options = { ...this.options, ...options };
  }

  // Multi-modal helper methods

  /**
   * Send a multi-modal message (convenience method)
   */
  async sendMultiModal(content: MessageContent, params?: Partial<CompletionParams>): Promise<string> {
    return this.chat(content, params);
  }

  /**
   * Stream a multi-modal message (convenience method)
   */
  async streamMultiModal(
    content: MessageContent, 
    onChunk?: (data: { type: 'content' | 'tool_call' | 'tool_result', data: any }) => void,
    params?: Partial<CompletionParams>
  ): Promise<string> {
    return this.stream(content, params, onChunk);
  }

  /**
   * Add a multi-modal message to history
   */
  addMultiModalMessage(role: 'user' | 'assistant' | 'system', content: MessageContent): void {
    this.addMessage({ role, content });
  }

  /**
   * Check if the session supports multi-modal content
   */
  supportsMultiModal(): boolean {
    // This would be determined by the underlying provider capabilities
    return this.provider.supportsMultiModal?.() ?? false;
  }

  /**
   * Get the last message content as text (useful for multi-modal messages)
   */
  getLastTextContent(): string {
    const lastMessage = this.history[this.history.length - 1];
    if (!lastMessage) return '';
    
    if (typeof lastMessage.content === 'string') {
      return lastMessage.content;
    }
    
    return extractText(lastMessage.content);
  }

  /**
   * Check if the last message contains multi-modal content
   */
  hasMultiModalContent(): boolean {
    const lastMessage = this.history[this.history.length - 1];
    if (!lastMessage) return false;
    
    return isMultiModal(lastMessage.content);
  }

  // Monitoring methods

  private isMonitoringEnabled(): boolean {
    return this.options.monitoring?.enabled ?? false;
  }


  private trackRequestStart(requestId: string, message: string | MessageContent, params: Partial<CompletionParams>): void {
    if (!this.monitoringService || !this.agentId) return;
    
    const promptText = this.extractTextFromContent(message);
    const modelName = this.getModelName();
    const providerName = this.getProviderName();
    
    this.monitoringService.startRequest(
      requestId,
      this.agentId,
      this.id,
      providerName,
      modelName,
      promptText.length,
      {
        ...this.options.monitoring?.metadata,
        params,
        messageCount: this.history.length
      }
    );
  }

  private trackRequestEnd(requestId: string, response: string, startTime: number, success: boolean, error?: any): void {
    if (!this.monitoringService) return;
    
    const duration = Date.now() - startTime;
    const { inputTokens, outputTokens } = this.estimateTokenUsage(response);
    const cost = estimateCost(this.getProviderName(), this.getModelName(), inputTokens, outputTokens);
    
    // Get recent tool calls for this request
    const toolCalls = this.getRecentToolCalls().map(tc => ({
      toolName: tc.name,
      duration: tc.timestamp,
      success: !tc.error,
      error: tc.error,
      inputSize: JSON.stringify(tc.arguments).length,
      outputSize: JSON.stringify(tc.result || '').length
    }));
    
    this.monitoringService.endRequest(
      requestId,
      success,
      response.length,
      inputTokens,
      outputTokens,
      toolCalls,
      error instanceof Error ? error.message : undefined
    );
    
    // Update session metrics
    if (this.agentId) {
      this.monitoringService.updateSession(
        this.id,
        inputTokens + outputTokens,
        cost,
        toolCalls.map(tc => tc.toolName)
      );
    }
  }

  private trackToolCall(requestId: string, toolCall: ToolCall, startTime: number): void {
    if (!this.monitoringService) return;
    
    this.monitoringService.trackToolCall(
      requestId,
      toolCall.name,
      startTime,
      true,
      JSON.stringify(toolCall.arguments).length,
      0
    );
  }

  private trackToolResult(requestId: string, toolResult: ToolCallResult): void {
    if (!this.monitoringService) return;
    
    this.monitoringService.trackToolCall(
      requestId,
      toolResult.name,
      toolResult.timestamp,
      !toolResult.error,
      JSON.stringify(toolResult.arguments).length,
      JSON.stringify(toolResult.result || '').length,
      toolResult.error
    );
  }


  private extractTextFromContent(content: string | MessageContent): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter(item => item.type === 'text')
        .map(item => item.text || '')
        .join(' ');
    }
    return '';
  }

  private getProviderName(): string {
    return (this.provider as any).name || 'unknown';
  }

  private getModelName(): string {
    return (this.provider as any).model || 'unknown';
  }

  private estimateTokenUsage(response: string): { inputTokens: number; outputTokens: number } {
    const avgCharsPerToken = 4;
    const lastUserMessage = this.history[this.history.length - 1];
    const inputText = this.extractTextFromContent(lastUserMessage?.content || '');
    
    return {
      inputTokens: Math.ceil(inputText.length / avgCharsPerToken),
      outputTokens: Math.ceil(response.length / avgCharsPerToken)
    };
  }

  // Removed old estimateCost method - now using simplified cost utility

  private getRecentToolCalls(): ToolCallResult[] {
    return this.toolCallResults.slice(-5);
  }

  // Public monitoring methods

  enableMonitoring(enabled: boolean = true): void {
    if (this.options.monitoring) {
      this.options.monitoring.enabled = enabled;
    } else {
      this.options.monitoring = { enabled };
    }
    
    if (enabled && this.monitoringService && this.agentId) {
      this.monitoringService.startSession(this.id, this.agentId);
    }
  }

  setMonitoringService(service: MonitoringService, agentId?: string): void {
    this.monitoringService = service;
    if (agentId) {
      this.agentId = agentId;
    }
    
    if (this.isMonitoringEnabled() && this.agentId) {
      this.monitoringService.startSession(this.id, this.agentId);
    }
  }

  getMonitoringMetrics() {
    if (!this.monitoringService) return null;
    
    return {
      sessionId: this.id,
      agentId: this.agentId,
      messageCount: this.history.length,
      toolCallCount: this.toolCallResults.length,
      sessionDuration: Date.now() - this.sessionStartTime.getTime()
    };
  }

  async getSessionAnalytics() {
    if (!this.monitoringService) return null;
    return this.monitoringService.getSessionMetrics(this.id);
  }

  async getAgentAnalytics() {
    if (!this.monitoringService || !this.agentId) return null;
    return this.monitoringService.getAgentMetrics(this.agentId);
  }

  // Override destroy to properly end session monitoring
  destroy(): void {
    if (this.isMonitoringEnabled() && this.monitoringService) {
      this.monitoringService.endSession(this.id);
    }
  }
}
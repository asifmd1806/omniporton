import { getModelContext } from "../model";
import { templateRegistry } from "../template";
import { handleToolCallFromModelOutput } from "./toolCallHandler";
import { MCPClient } from "../mcp/client";
import { MCPTransport } from "../mcp";
import { zodFromJsonSchema } from "../utils";
import { MCPService } from "../mcp/MCPService";
import { StreamingToolCallBuffer } from "../extractor/streaming/streamingToolCallBuffer";
import type {
  ChatMessage,
  ChatCompletionParams,
  PartialCompletionCallback,
  ToolCallResult,
  MessageContent,
  MessageInput,
} from "./types";
import { extractText, isMultiModal } from "../utils/media";

/**
 * ChatSession – refactored for segment-based LLM output parsing and flexible content/tool call handling.
 * 
 * Provides a high-level interface for conducting conversations with LLMs, supporting:
 * - Multi-modal content (text, images, audio, video, documents)
 * - Tool calling and function execution
 * - Streaming responses
 * - Session history management
 * 
 * @example
 * ```typescript
 * // Medical diagnosis session
 * const medicalSession = createChat('medical-llava-7b');
 * const xrayAnalysis = await medicalSession.sendMultiModal(
 *   createMultiModalContent(
 *     'Analyze this chest X-ray for pneumonia indicators',
 *     createImageFromUrl('https://hospital.com/xray-patient-001.jpg')
 *   )
 * );
 * 
 * // Financial analysis session
 * const financialSession = createChat('claude-3-sonnet', {}, true, mcpService);
 * const quarterlyReport = await financialSession.chat(
 *   'Generate Q4 earnings summary and send to investors who requested updates'
 * );
 * ```
 */
export class LegacyChatSession {
    private modelId: string;
    private contextParams: Record<string, any>;
    private history: ChatMessage[] = [];
    public lastToolCallResults: ToolCallResult[] = [];
    private combineContentSegments: boolean;
    private mcpService: MCPService;

    constructor(modelId: string, contextParams: Record<string, any> = {}, combineContentSegments: boolean = true, mcpService?: MCPService) {
        this.modelId = modelId;
        this.contextParams = contextParams;
        this.combineContentSegments = combineContentSegments;
        this.mcpService = mcpService || new MCPService();
    }

    addMessage(message: ChatMessage) {
        this.history.push(message);
    }

    getHistory(): ChatMessage[] {
        return [...this.history];
    }

    /**
     * Non-streaming chat with multi-modal support. Segments output into content/tool_call blocks in order.
     * 
     * @param message - The message to send (can be string or multi-modal content)
     * @param params - Optional completion parameters
     * @param combineContentSegments - Whether to combine content segments (default: true)
     * @returns Promise that resolves to the assistant's response text
     * 
     * @example
     * ```typescript
     * // Customer service automation
     * const customerIssue = 'Order #12345 shipped to wrong address';
     * const resolution = await session.chat(
     *   `Handle this customer issue: ${customerIssue}. Check order status and provide solution.`
     * );
     * 
     * // Legal document review
     * const contractAnalysis = await session.chat(
     *   createMultiModalContent(
     *     'Review this employment contract for non-compete clause enforceability',
     *     createDocumentFromData(contractPdf, 'application/pdf', 'employment-contract.pdf')
     *   )
     * );
     * ```
     */
    async chat(
        message: string | MessageContent,
        params: Omit<ChatCompletionParams, "messages"> = {},
        combineContentSegments: boolean = this.combineContentSegments
    ): Promise<string> {
        this.combineContentSegments = combineContentSegments;
        this.addMessage({ role: "user", content: message });
        const context = await getModelContext(this.modelId, this.contextParams);
        const completionParams: ChatCompletionParams = {
            messages: this.history,
            ...params,
        };
        const result = await context.completion(completionParams);

        // Protocol/tool call config
        const templateConfig = templateRegistry.getTemplateConfig(this.modelId);
        const protocol = (templateConfig?.protocol || "none") as 'function_calling' | 'tool_use' | 'tool' | 'auto' | 'none';
        const toolCallFormat = templateConfig?.toolCallFormat || "auto";

        // If no tool protocol, treat as plain text
        if (protocol === 'none') {
            if (/<function_call>|<tool_use>|<tool_call>/.test(result.text)) {
                const error = `Tool/function call detected, but protocol is 'none' for this template.`;
                this.addMessage({ role: 'assistant', content: error });
                return error;
            }
            this.addMessage({ role: 'assistant', content: result.text });
            return result.text;
        }

        // Segment the output into content/tool_call blocks in order
        const segments = this.extractSegments(result.text, protocol, toolCallFormat);
        let visibleText = '';
        let contentBuffer = '';
        for (const seg of segments) {
            if (seg.type === 'content') {
                if (this.combineContentSegments) {
                    contentBuffer += seg.text;
                } else {
                    if (seg.text.trim().length > 0) {
                        this.addMessage({ role: 'assistant', content: seg.text });
                        visibleText += seg.text;
                    }
                }
            } else if (seg.type === 'tool_call') {
                // Execute tool call synchronously (non-streaming)
                const toolCall = seg.toolCall;
                const callId = toolCall.id || toolCall.tool_call_id;
                try {
                    if (!toolCall.name) throw new Error('No tool/function name specified.');
                    const tool = this.mcpService.getTool(toolCall.name);
                    if (!tool) throw new Error(`Tool '${toolCall.name}' not registered.`);
                    const parsedArgs = tool.schema.parse(toolCall.arguments || {});
                    const toolResult = await tool.handler(parsedArgs);
                    const toolMsg: ChatMessage = {
                        role: 'tool',
                        name: tool.name,
                        content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
                        args: parsedArgs,
                    } as any;
                    this.addMessage(toolMsg);
                    this.lastToolCallResults.push({
                        id: callId,
                        name: tool.name,
                        args: parsedArgs,
                        result: toolResult,
                        raw: toolCall,
                    });
                } catch (e: any) {
                    const errMsg = `Function/tool call error: ${e}`;
                    this.addMessage({ role: 'tool', name: toolCall.name || 'unknown', content: errMsg, args: toolCall.arguments || {} } as any);
                    this.lastToolCallResults.push({
                        id: callId,
                        name: toolCall.name || 'unknown',
                        args: toolCall.arguments || {},
                        error: errMsg,
                        raw: toolCall,
                    });
                }
            }
        }
        // If combining, flush content buffer
        if (this.combineContentSegments && contentBuffer.trim().length > 0) {
            this.addMessage({ role: 'assistant', content: contentBuffer });
            visibleText += contentBuffer;
        }
        return visibleText;
    }


    async astream_chat(
        message: string | MessageContent,
        params: Omit<ChatCompletionParams, "messages"> = {},
        onPartial?: PartialCompletionCallback,
        combineContentSegments: boolean = this.combineContentSegments
    ): Promise<string> {
        this.combineContentSegments = combineContentSegments;
        this.addMessage({ role: "user", content: message });
        const templateConfig = templateRegistry.getTemplateConfig(this.modelId);
        const protocol = (templateConfig?.protocol || "none") as 'function_calling' | 'tool_use' | 'tool' | 'auto' | 'none';
        const toolCallFormat = templateConfig?.toolCallFormat || "auto";
        let lastVisibleIndex = 0;
        let visibleBuffer = '';
        let contentBuffer = '';
        const processedIds = new Set<string>();
        const tcBuffer = new StreamingToolCallBuffer({ protocol: (protocol === 'none' ? 'auto' : protocol) as any, format: toolCallFormat });
        const context = await getModelContext(this.modelId, this.contextParams);
        const completionParams: ChatCompletionParams = {
            messages: this.history,
            ...params,
        };
        const partialHandler = (partial: { token: string }) => {
            // Feed token to tool-call buffer
            const maybeCalls = tcBuffer.push(partial.token);
            // Update visible buffer (tool call tags stripped inside tcBuffer)
            visibleBuffer = tcBuffer.getVisibleContent();
            const newSegment = visibleBuffer.slice(lastVisibleIndex);
            if (newSegment.length > 0) {
                if (this.combineContentSegments) {
                    contentBuffer += newSegment;
                } else {
                    onPartial?.({ type: 'content', text: newSegment });
                }
                lastVisibleIndex = visibleBuffer.length;
            }
            // Process detected tool calls immediately and notify caller
            if (maybeCalls && maybeCalls.length > 0) {
                for (const call of maybeCalls) {
                    onPartial?.({ type: 'tool_call', toolCall: call });
                    void this.processParsedToolCall(call, processedIds);
                }
            }
        };
        await context.completion(completionParams, partialHandler);
        // After streaming complete, process any remaining tool calls in the final text (safety net)
        const remainingCalls = tcBuffer.push('');
        if (remainingCalls && remainingCalls.length > 0) {
            remainingCalls.forEach((call: any) => this.processParsedToolCall(call, processedIds));
        }
        // Add final assistant visible text message
        if (this.combineContentSegments && contentBuffer.trim().length > 0) {
            this.addMessage({ role: 'assistant', content: contentBuffer });
            onPartial?.({ type: 'content', text: contentBuffer });
            visibleBuffer += contentBuffer;
        } else if (!this.combineContentSegments && visibleBuffer.trim().length > 0) {
            this.addMessage({ role: 'assistant', content: visibleBuffer });
        }
        return visibleBuffer;
    }

    /**
     * Extracts ordered segments (content/tool_call) from a model output string.
     */
    private extractSegments(
        text: string,
        protocol: string,
        format: string
    ): Array<{ type: 'content'; text: string } | { type: 'tool_call'; toolCall: any }> {
        // Use the StreamingToolCallBuffer to extract tool call blocks
        const buffer = new StreamingToolCallBuffer({ protocol: protocol as any, format: format as 'auto' | 'json' | 'xml' | 'yaml' });
        let idx = 0;
        let segments: Array<{ type: 'content'; text: string } | { type: 'tool_call'; toolCall: any }> = [];
        let working = text;
        while (working.length > 0) {
            // Try to find the next tool call
            const before = buffer.getVisibleContent();
            if (before.length > 0) {
                segments.push({ type: 'content', text: before });
                working = working.slice(before.length);
                buffer.push(working[0] || '');
                continue;
            }
            const calls = buffer.push(working);
            if (calls && calls.length > 0) {
                for (const call of calls) {
                    segments.push({ type: 'tool_call', toolCall: call });
                }
                // Remove processed tool call blocks from working
                const after = buffer.getVisibleContent();
                working = after;
            } else {
                // No more tool calls, flush remaining as content
                if (working.length > 0) {
                    segments.push({ type: 'content', text: working });
                }
                break;
            }
        }
        return segments;
    }

    /**
     * Process a parsed tool call object immediately (real-time during streaming).
     */
    private async processParsedToolCall(toolCall: any, processedIds: Set<string>) {
        const callId = toolCall.id || toolCall.tool_call_id;
        if (callId && processedIds.has(callId)) return;
        if (callId) processedIds.add(callId);
        try {
            if (!toolCall.name) throw new Error('No tool/function name specified.');
            const tool = this.mcpService.getTool(toolCall.name);
            if (!tool) throw new Error(`Tool '${toolCall.name}' not registered.`);
            const parsedArgs = tool.schema.parse(toolCall.arguments || {});
            const toolResult = await tool.handler(parsedArgs);
            const toolMsg: ChatMessage = {
                role: 'tool',
                name: tool.name,
                content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
                args: parsedArgs,
            } as any;
            this.addMessage(toolMsg);
            this.lastToolCallResults.push({
                id: callId,
                name: tool.name,
                args: parsedArgs,
                result: toolResult,
                raw: toolCall,
            });
        } catch (e: any) {
            const errMsg = `Function/tool call error: ${e}`;
            this.addMessage({ role: 'tool', name: toolCall.name || 'unknown', content: errMsg, args: toolCall.arguments || {} } as any);
            this.lastToolCallResults.push({
                id: callId,
                name: toolCall.name || 'unknown',
                args: toolCall.arguments || {},
                error: errMsg,
                raw: toolCall,
            });
        }
    }

    /**
     * Send a multi-modal message (convenience method)
     * 
     * @param content - Multi-modal content to send
     * @param params - Optional completion parameters
     * @returns Promise that resolves to the assistant's response
     * 
     * @example
     * ```typescript
     * // Real estate property assessment
     * const propertyEvaluation = createMultiModalContent(
     *   'Evaluate this property for investment potential. Analyze condition, location, and market value.',
     *   createImageFromUrl('https://realty.com/property-exterior-123.jpg'),
     *   'Property details: 3BR/2BA, built 1995, lot size 0.25 acres'
     * );
     * const assessment = await session.sendMultiModal(propertyEvaluation);
     * ```
     */
    async sendMultiModal(content: MessageContent, params?: Omit<ChatCompletionParams, "messages">): Promise<string> {
        return this.chat(content, params);
    }

    /**
     * Stream a multi-modal message (convenience method)
     */
    async streamMultiModal(
        content: MessageContent, 
        onPartial?: PartialCompletionCallback, 
        params?: Omit<ChatCompletionParams, "messages">
    ): Promise<string> {
        return this.astream_chat(content, params, onPartial);
    }

    /**
     * Add a multi-modal message to history
     * 
     * @param role - The role of the message sender
     * @param content - Multi-modal content to add
     * 
     * @example
     * ```typescript
     * // Add previous medical scan for comparison
     * const previousScan = createMultiModalContent(
     *   'Previous CT scan from 6 months ago for comparison',
     *   createImageFromUrl('https://hospital.com/ct-scan-previous.jpg')
     * );
     * session.addMultiModalMessage('user', previousScan);
     * 
     * // Add current scan for analysis
     * const currentScan = createMultiModalContent(
     *   'Current CT scan showing progression',
     *   createImageFromUrl('https://hospital.com/ct-scan-current.jpg')
     * );
     * await session.sendMultiModal(currentScan);
     * ```
     */
    addMultiModalMessage(role: 'user' | 'assistant' | 'system', content: MessageContent): void {
        this.addMessage({ role, content });
    }

    /**
     * Check if the session supports multi-modal content
     * 
     * @returns True if the underlying model supports multi-modal content
     * 
     * @example
     * ```typescript
     * // Dynamic routing based on content type
     * const userMessage = getUserMessage();
     * 
     * if (isMultiModal(userMessage) && session.supportsMultiModal()) {
     *   // Process with vision-enabled model
     *   const analysis = await session.sendMultiModal(userMessage);
     * } else {
     *   // Fall back to text-only processing
     *   const textContent = extractText(userMessage);
     *   const response = await session.chat(textContent);
     * }
     * ```
     */
    supportsMultiModal(): boolean {
        // This would be determined by the underlying model capabilities
        // For now, we'll assume it's supported and let the provider handle validation
        return true;
    }

    /**
     * Get the last message content as text (useful for multi-modal messages)
     * 
     * @returns The text content of the last message in the conversation
     * 
     * @example
     * ```typescript
     * // Extract text summary for logging
     * await session.sendMultiModal(
     *   createMultiModalContent(
     *     'Review this quarterly report',
     *     createDocumentFromData(reportPdf, 'application/pdf')
     *   )
     * );
     * 
     * const summary = session.getLastTextContent();
     * auditLogger.log(`Financial analysis completed: ${summary.substring(0, 100)}...`);
     * ```
     */
    getLastTextContent(): string {
        const lastMessage = this.history[this.history.length - 1];
        if (!lastMessage) return '';
        
        if (typeof lastMessage.content === 'string') {
            return lastMessage.content;
        }
        
        return extractText(lastMessage.content);
    }
}

export function createChat(
    modelId: string,
    contextParams: Record<string, any> = {},
    combineContentSegments?: boolean,
    mcpService?: MCPService
): LegacyChatSession {
    return new LegacyChatSession(modelId, contextParams, combineContentSegments, mcpService);
}

export async function initializeMcpTools(mcp: string | MCPTransport, mcpService?: MCPService) {
    const service = mcpService || new MCPService();
    await service.initializeMcpTools('default', mcp);
    return service;
}

export async function initializeAllMcpTools(servers: { label: string; mcp: string | MCPTransport }[], mcpService?: MCPService) {
    const service = mcpService || new MCPService();
    await service.initializeAllMcpTools(servers);
    return service;
}

import type { ToolDefinition, ToolMessage, ChatMessage } from './types';
import { StreamingToolCallBuffer } from '../extractor/streaming/streamingToolCallBuffer';
import { ZodError } from 'zod';
import { ToolCallResult, HandleToolCallArgs } from './types';

/**
 * Handles tool/function calls detected in model output (streamed or non-streamed).
 * - Deduplicates tool calls by ID (if present).
 * - Logs a warning if a tool call is missing an ID.
 * - Returns an array of all tool call results (in order), with rich metadata for agentic use.
 *
 * @param args - Handler arguments (see type)
 * @returns Array of tool call result objects
 */
export async function handleToolCallFromModelOutput({
  protocol,
  toolCallFormat,
  modelOutput,
  addMessage,
  getTool,
  processedToolCallIds,
}: HandleToolCallArgs): Promise<ToolCallResult[]> {
  let error: string | null = null;
  // Use the streaming buffer even for non-streamed output for consistency and multi-tool support
  const buffer = new StreamingToolCallBuffer({ protocol: protocol as 'function_calling' | 'tool_use' | 'tool' | 'auto', format: toolCallFormat });
  const toolCalls = buffer.push(modelOutput);
  let handledAny = false;
  // Use a set to track processed tool call IDs (for deduplication)
  const seenIds = processedToolCallIds || new Set<string>();
  const results: ToolCallResult[] = [];
  if (toolCalls && toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      const callId = toolCall.id || toolCall.tool_call_id;
      if (!callId) {
        // Warn if missing ID (best practice for deduplication)
        console.warn('[ToolCall] Tool/function call is missing an ID. Deduplication and tracking may not be possible.', toolCall);
      }
      if (callId && seenIds.has(callId)) {
        // Skip duplicate tool call
        continue;
      }
      if (callId) seenIds.add(callId);
      try {
        if (!toolCall.name) throw new Error('No tool/function name specified.');
        const tool = getTool(toolCall.name);
        if (!tool) throw new Error(`Tool '${toolCall.name}' not registered.`);
        // Validate arguments with zod
        let parsedArgs;
        try {
          parsedArgs = tool.schema.parse(toolCall.arguments || {});
        } catch (zodErr) {
          if (zodErr instanceof ZodError) {
            const errMsg = `Invalid arguments for tool '${tool.name}': ${zodErr.errors.map(e => e.message).join('; ')}`;
            addMessage({ role: 'assistant', content: errMsg });
            results.push({
              id: callId,
              name: tool.name,
              args: toolCall.arguments || {},
              error: errMsg,
              raw: toolCall,
            });
            continue;
          }
          throw zodErr;
        }
        const toolResult = await tool.handler(parsedArgs);
        const toolMsg: ToolMessage = {
          role: 'tool',
          name: tool.name,
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
          args: parsedArgs,
        };
        addMessage(toolMsg);
        results.push({
          id: callId,
          name: tool.name,
          args: parsedArgs,
          result: toolResult,
          raw: toolCall,
        });
        handledAny = true;
      } catch (e: any) {
        const errMsg = `Function/tool call error: ${e}`;
        addMessage({ role: 'assistant', content: errMsg });
        results.push({
          id: callId,
          name: toolCall.name || 'unknown',
          args: toolCall.arguments || {},
          error: errMsg,
          raw: toolCall,
        });
      }
    }
    return results;
  }
  // If no tool calls detected, just return the plain output as a result
  addMessage({ role: 'assistant', content: modelOutput });
  return [{ name: 'none', args: {}, result: modelOutput, raw: modelOutput }];
} 
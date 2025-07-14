import { Agent, AgentConfig } from './Agent';
import { MonitoringService } from '../monitoring/MonitoringService';
import type { ChatMessage } from '../chat/types';
import type { ToolDefinition } from '../tools/types';
import type { MCPTransport } from '../mcp/types';
import { v4 as uuidv4 } from 'uuid';

export interface MonitoredAgentConfig extends AgentConfig {
  monitoringService?: MonitoringService;
  enabledMetrics?: {
    trackExecutions?: boolean;
    trackTools?: boolean;
    trackCosts?: boolean;
    trackErrors?: boolean;
  };
}

export class MonitoredAgent {
  private agent: Agent;
  private monitoringService: MonitoringService;
  private enabledMetrics: {
    trackExecutions: boolean;
    trackTools: boolean;
    trackCosts: boolean;
    trackErrors: boolean;
  };

  constructor(config: MonitoredAgentConfig) {
    this.agent = new Agent(config);
    this.monitoringService = config.monitoringService || new MonitoringService();
    
    this.enabledMetrics = {
      trackExecutions: config.enabledMetrics?.trackExecutions ?? true,
      trackTools: config.enabledMetrics?.trackTools ?? true,
      trackCosts: config.enabledMetrics?.trackCosts ?? true,
      trackErrors: config.enabledMetrics?.trackErrors ?? true
    };
  }

  get id(): string {
    return this.agent.id;
  }

  get name(): string {
    return this.agent.name;
  }

  get description(): string {
    return this.agent.description;
  }

  async execute(task: string, context?: Record<string, any>): Promise<string> {
    if (!this.enabledMetrics.trackExecutions) {
      return this.agent.execute(task, context);
    }

    const requestId = uuidv4();
    const sessionId = `agent-${this.agent.id}-${Date.now()}`;

    this.monitoringService.startRequest(
      requestId,
      this.agent.id,
      sessionId,
      'agent', // provider type
      'agent-execution', // model
      task.length,
      { 
        task: task.substring(0, 100) + (task.length > 100 ? '...' : ''),
        context: context ? Object.keys(context) : [],
        agentName: this.agent.name
      }
    );

    const startTime = Date.now();
    let success = false;
    let result = '';
    let error: string | undefined;

    try {
      result = await this.agent.execute(task, context);
      success = true;
      return result;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      
      // Track tool calls if enabled
      const toolCalls = this.enabledMetrics.trackTools ? 
        this.agent.getToolResults().map(toolResult => ({
          toolName: toolResult.name,
          duration: 0, // Tool call duration not tracked in current implementation
          success: !toolResult.error,
          error: toolResult.error,
          inputSize: JSON.stringify(toolResult.arguments).length,
          outputSize: toolResult.result ? JSON.stringify(toolResult.result).length : 0
        })) : undefined;

      this.monitoringService.endRequest(
        requestId,
        success,
        result.length,
        0, // Input tokens - would need provider integration for actual token counts
        0, // Output tokens - would need provider integration for actual token counts
        toolCalls,
        error
      );
    }
  }

  async stream(
    task: string,
    context?: Record<string, any>,
    onUpdate?: (data: {
      type: 'content' | 'tool_call' | 'tool_result' | 'iteration' | 'error';
      data: any;
      iteration: number;
    }) => void
  ): Promise<string> {
    if (!this.enabledMetrics.trackExecutions) {
      return this.agent.stream(task, context, onUpdate);
    }

    const requestId = uuidv4();
    const sessionId = `agent-${this.agent.id}-${Date.now()}`;

    this.monitoringService.startRequest(
      requestId,
      this.agent.id,
      sessionId,
      'agent',
      'agent-streaming',
      task.length,
      { 
        task: task.substring(0, 100) + (task.length > 100 ? '...' : ''),
        context: context ? Object.keys(context) : [],
        agentName: this.agent.name,
        streaming: true
      }
    );

    const startTime = Date.now();
    let success = false;
    let result = '';
    let error: string | undefined;

    try {
      result = await this.agent.stream(task, context, (data) => {
        // Track tool calls in real-time if enabled
        if (this.enabledMetrics.trackTools && data.type === 'tool_call') {
          this.monitoringService.trackToolCall(
            requestId,
            data.data.name || 'unknown',
            0, // Duration not available in stream
            true, // Assume success for now
            JSON.stringify(data.data.arguments || {}).length,
            0 // Output size not available yet
          );
        }

        if (onUpdate) {
          onUpdate(data);
        }
      });
      success = true;
      return result;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this.monitoringService.endRequest(
        requestId,
        success,
        result.length,
        0, // Input tokens
        0, // Output tokens
        undefined, // Tool calls already tracked in streaming
        error
      );
    }
  }

  addTool(tool: ToolDefinition): void {
    this.agent.addTool(tool);
  }

  async addMCPService(label: string, transport: string | MCPTransport): Promise<void> {
    return this.agent.addMCPService(label, transport);
  }

  getTools(): ToolDefinition[] {
    return this.agent.getTools();
  }

  getCapabilities() {
    return this.agent.getCapabilities();
  }

  getState() {
    return this.agent.getState();
  }

  getHistory(): ChatMessage[] {
    return this.agent.getHistory();
  }

  clearHistory(): void {
    this.agent.clearHistory();
  }

  updateOptions(options: any): void {
    this.agent.updateOptions(options);
  }

  getToolResults() {
    return this.agent.getToolResults();
  }

  isRunning(): boolean {
    return this.agent.isRunning();
  }

  getStats() {
    const baseStats = this.agent.getStats();
    return {
      ...baseStats,
      monitoringEnabled: true,
      metricsTracked: this.enabledMetrics
    };
  }

  // Monitoring-specific methods
  async getAgentMetrics(timeRange?: { start: Date; end: Date }) {
    return this.monitoringService.getAgentMetrics(this.agent.id, timeRange);
  }

  async getCostAnalysis(timeRange?: { start: Date; end: Date }) {
    return this.monitoringService.getCostAnalysis(this.agent.id, timeRange);
  }

  getMonitoringService(): MonitoringService {
    return this.monitoringService;
  }

  updateMonitoringConfig(config: Partial<{
    trackExecutions?: boolean;
    trackTools?: boolean;
    trackCosts?: boolean;
    trackErrors?: boolean;
  }>): void {
    this.enabledMetrics = {
      trackExecutions: config.trackExecutions ?? this.enabledMetrics.trackExecutions,
      trackTools: config.trackTools ?? this.enabledMetrics.trackTools,
      trackCosts: config.trackCosts ?? this.enabledMetrics.trackCosts,
      trackErrors: config.trackErrors ?? this.enabledMetrics.trackErrors
    };
  }
}
import type { LLMProvider } from '../provider/LLMProvider';
import type { MessageExtractor } from '../extractor/MessageExtractor';
import type { Template } from '../template/types';
import type { ChatMessage } from '../chat/types';
import { MCPService } from '../mcp/MCPService';
import type { ToolDefinition } from '../tools/types';
import { ChatSession, ChatSessionOptions } from '../session/ChatSession';
import { MCPTransport } from '../mcp/types';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  provider: LLMProvider;
  extractor: MessageExtractor;
  template: Template;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  mcpServices?: Array<{
    label: string;
    transport: string | MCPTransport;
  }>;
  options?: ChatSessionOptions;
}

export interface AgentCapabilities {
  canUseTools: boolean;
  canUseMCP: boolean;
  maxIterations: number;
  parallelExecution: boolean;
}

export interface AgentState {
  isRunning: boolean;
  currentIteration: number;
  totalIterations: number;
  lastToolCall?: string;
  lastMCPCall?: string;
  errors: string[];
}

export class Agent {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  private session!: ChatSession;
  private mcpService: MCPService;
  private capabilities: AgentCapabilities;
  private state: AgentState;

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    
    // Initialize MCP service
    this.mcpService = new MCPService();
    
    // Initialize capabilities
    this.capabilities = {
      canUseTools: !!(config.tools && config.tools.length > 0),
      canUseMCP: !!(config.mcpServices && config.mcpServices.length > 0),
      maxIterations: config.options?.maxAgenticIterations || 10,
      parallelExecution: false // Can be enhanced later
    };

    // Initialize state
    this.state = {
      isRunning: false,
      currentIteration: 0,
      totalIterations: 0,
      errors: []
    };

    this.initializeAgent(config);
  }

  private initializeAgent(config: AgentConfig): void {
    // Register tools if provided
    if (config.tools) {
      for (const tool of config.tools) {
        this.mcpService.registerTool(tool);
      }
    }

    // Initialize MCP services if provided (async operations will be handled during execution)
    if (config.mcpServices) {
      // We'll initialize these during first execution to avoid async constructor
      this.mcpServices = config.mcpServices;
    }

    // Create the chat session with system prompt
    const sessionOptions: ChatSessionOptions = {
      ...config.options,
      agenticMode: true,
      maxAgenticIterations: this.capabilities.maxIterations
    };

    this.session = new ChatSession(
      this.id,
      config.provider,
      config.extractor,
      config.template,
      this.mcpService,
      config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : [],
      sessionOptions
    );
  }

  private mcpServices?: Array<{
    label: string;
    transport: string | MCPTransport;
  }>;
  private mcpInitialized = false;

  private async initializeMCPServices(): Promise<void> {
    if (this.mcpInitialized || !this.mcpServices) {
      return;
    }

    for (const mcpConfig of this.mcpServices) {
      await this.mcpService.initializeMcpTools(mcpConfig.label, mcpConfig.transport);
    }

    this.mcpInitialized = true;
  }

  /**
   * Execute a task with the agent
   */
  async execute(task: string, context?: Record<string, any>): Promise<string> {
    this.state.isRunning = true;
    this.state.currentIteration = 0;
    this.state.errors = [];

    try {
      // Initialize MCP services if not already done
      await this.initializeMCPServices();

      // Add context to the task if provided
      let fullTask = task;
      if (context) {
        fullTask = `${task}\n\nContext: ${JSON.stringify(context, null, 2)}`;
      }

      // Execute with the session's agentic mode
      const result = await this.session.chat(fullTask);
      
      this.state.totalIterations = this.state.currentIteration;
      return result;
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.state.isRunning = false;
    }
  }

  /**
   * Stream task execution with real-time updates
   */
  async stream(
    task: string,
    context?: Record<string, any>,
    onUpdate?: (data: {
      type: 'content' | 'tool_call' | 'tool_result' | 'iteration' | 'error';
      data: any;
      iteration: number;
    }) => void
  ): Promise<string> {
    this.state.isRunning = true;
    this.state.currentIteration = 0;
    this.state.errors = [];

    try {
      // Initialize MCP services if not already done
      await this.initializeMCPServices();

      let fullTask = task;
      if (context) {
        fullTask = `${task}\n\nContext: ${JSON.stringify(context, null, 2)}`;
      }

      const result = await this.session.stream(fullTask, {}, (chunk) => {
        if (onUpdate) {
          onUpdate({
            type: chunk.type as any,
            data: chunk.data,
            iteration: this.state.currentIteration
          });
        }
      });

      this.state.totalIterations = this.state.currentIteration;
      return result;
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : String(error));
      if (onUpdate) {
        onUpdate({
          type: 'error',
          data: error instanceof Error ? error.message : String(error),
          iteration: this.state.currentIteration
        });
      }
      throw error;
    } finally {
      this.state.isRunning = false;
    }
  }

  /**
   * Add a tool to the agent
   */
  addTool(tool: ToolDefinition): void {
    this.mcpService.registerTool(tool);
    this.capabilities.canUseTools = true;
  }

  /**
   * Add an MCP service to the agent
   */
  async addMCPService(label: string, transport: string | MCPTransport): Promise<void> {
    await this.mcpService.initializeMcpTools(label, transport);
    this.capabilities.canUseMCP = true;
  }

  /**
   * Get available tools
   */
  getTools(): ToolDefinition[] {
    return this.mcpService.listTools();
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatMessage[] {
    return this.session.getHistory();
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.session.clearHistory();
    this.state.currentIteration = 0;
    this.state.totalIterations = 0;
    this.state.errors = [];
  }

  /**
   * Update agent configuration
   */
  updateOptions(options: Partial<ChatSessionOptions>): void {
    this.session.updateOptions(options);
    if (options.maxAgenticIterations) {
      this.capabilities.maxIterations = options.maxAgenticIterations;
    }
  }

  /**
   * Get tool execution results
   */
  getToolResults() {
    return this.session.getToolCallResults();
  }

  /**
   * Check if agent is currently running
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Get agent statistics
   */
  getStats() {
    return {
      totalIterations: this.state.totalIterations,
      toolsAvailable: this.mcpService.listTools().length,
      mcpServicesActive: this.capabilities.canUseMCP,
      errorsCount: this.state.errors.length,
      messagesInHistory: this.session.getHistory().length
    };
  }
}
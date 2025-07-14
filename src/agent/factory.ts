import { Agent, AgentConfig } from './Agent';
import { OpenAIProvider, OpenAIConfig, GeminiProvider, GeminiConfig, ClaudeProvider, ClaudeConfig, MistralProvider, MistralConfig, GroqProvider, GroqConfig, OllamaProvider, OllamaConfig, NodeLlamaCppProvider, NodeLlamaCppConfig } from '../provider';
import { OpenAIExtractor, GeminiExtractor, ClaudeExtractor, NodeLlamaCppExtractor } from '../extractor';
import { templateRegistry } from '../template/defaultRegistry';
import { MCPService } from '../mcp/MCPService';
import { MCPTransport } from '../mcp/types';
import type { Template } from '../template/types';
import type { ToolDefinition } from '../tools/types';
import type { ChatSessionOptions } from '../session/ChatSession';

export interface AgentFactoryConfig {
  id: string;
  name: string;
  description: string;
  provider: 'openai' | 'gemini' | 'claude' | 'mistral' | 'groq' | 'ollama' | 'node-llama-cpp' | 'custom';
  providerConfig?: any;
  modelId?: string;
  systemPrompt?: string;
  template?: Template;
  tools?: ToolDefinition[];
  mcpServices?: Array<{
    label: string;
    transport: string | MCPTransport;
  }>;
  options?: ChatSessionOptions;
}

export function createAgent(config: AgentFactoryConfig): Agent {
  const { id, name, description, provider, providerConfig = {}, modelId, systemPrompt, template, tools, mcpServices, options } = config;
  
  let llmProvider: any;
  let extractor: any;
  let agentTemplate: Template;

  // Create provider and extractor based on type
  switch (provider) {
      
    case 'openai':
      const openaiConfig: OpenAIConfig = {
        apiKey: providerConfig.apiKey,
        model: providerConfig.model || 'gpt-4',
        ...(providerConfig.baseURL !== undefined && { baseURL: providerConfig.baseURL }),
        ...(providerConfig.organization !== undefined && { organization: providerConfig.organization })
      };
      llmProvider = new OpenAIProvider(openaiConfig);
      extractor = new OpenAIExtractor();
      agentTemplate = template || getDefaultTemplate();
      break;
      
    case 'gemini':
      const geminiConfig: GeminiConfig = {
        apiKey: providerConfig.apiKey,
        model: providerConfig.model || 'gemini-pro',
        ...(providerConfig.baseURL !== undefined && { baseURL: providerConfig.baseURL }),
        ...(providerConfig.projectId !== undefined && { projectId: providerConfig.projectId }),
        ...(providerConfig.location !== undefined && { location: providerConfig.location })
      };
      llmProvider = new GeminiProvider(geminiConfig);
      extractor = new GeminiExtractor();
      agentTemplate = template || getDefaultTemplate();
      break;
      
    case 'claude':
      const claudeConfig: ClaudeConfig = {
        apiKey: providerConfig.apiKey,
        model: providerConfig.model || 'claude-3-sonnet-20240229',
        ...(providerConfig.baseURL !== undefined && { baseURL: providerConfig.baseURL }),
        ...(providerConfig.version !== undefined && { version: providerConfig.version }),
        ...(providerConfig.maxTokens !== undefined && { maxTokens: providerConfig.maxTokens })
      };
      llmProvider = new ClaudeProvider(claudeConfig);
      extractor = new ClaudeExtractor();
      agentTemplate = template || getDefaultTemplate();
      break;
      
    case 'mistral':
      const mistralConfig: MistralConfig = {
        apiKey: providerConfig.apiKey,
        model: providerConfig.model || 'mistral-medium',
        baseURL: providerConfig.baseURL,
        endpoint: providerConfig.endpoint
      };
      llmProvider = new MistralProvider(mistralConfig);
      extractor = new OpenAIExtractor(); // Mistral uses OpenAI-compatible format
      agentTemplate = template || getDefaultTemplate();
      break;
      
    case 'groq':
      const groqConfig: GroqConfig = {
        apiKey: providerConfig.apiKey,
        model: providerConfig.model || 'llama2-70b-4096',
        baseURL: providerConfig.baseURL
      };
      llmProvider = new GroqProvider(groqConfig);
      extractor = new OpenAIExtractor(); // Groq uses OpenAI-compatible format
      agentTemplate = template || getDefaultTemplate();
      break;
      
    case 'ollama':
      const ollamaAgentConfig: OllamaConfig = {
        baseURL: providerConfig.baseURL || 'http://localhost:11434',
        model: providerConfig.model || 'llama2',
        temperature: providerConfig.temperature,
        topP: providerConfig.topP,
        contextLength: providerConfig.contextLength
      };
      llmProvider = new OllamaProvider(ollamaAgentConfig);
      extractor = new OpenAIExtractor(); // Ollama uses OpenAI-compatible format
      agentTemplate = template || getDefaultTemplate();
      break;
      
    case 'node-llama-cpp':
      const nodeLlamaConfig: NodeLlamaCppConfig = {
        modelPath: providerConfig.modelPath || modelId,
        contextSize: providerConfig.contextSize,
        temperature: providerConfig.temperature,
        topK: providerConfig.topK,
        topP: providerConfig.topP,
        repeatPenalty: providerConfig.repeatPenalty,
        seed: providerConfig.seed,
        threads: providerConfig.threads,
        gpuLayers: providerConfig.gpuLayers,
        mmap: providerConfig.mmap,
        mlock: providerConfig.mlock,
        vocabOnly: providerConfig.vocabOnly,
        useFp16: providerConfig.useFp16,
        logitsAll: providerConfig.logitsAll,
        embedding: providerConfig.embedding,
        offloadKqv: providerConfig.offloadKqv,
        flashAttention: providerConfig.flashAttention
      };
      if (!nodeLlamaConfig.modelPath) throw new Error('modelPath required for node-llama-cpp provider');
      llmProvider = new NodeLlamaCppProvider(nodeLlamaConfig);
      extractor = new NodeLlamaCppExtractor();
      agentTemplate = template || (modelId ? templateRegistry.get(modelId) : undefined) || getDefaultTemplate();
      break;
      
    case 'custom':
      llmProvider = providerConfig.provider;
      extractor = providerConfig.extractor;
      agentTemplate = template || providerConfig.template || getDefaultTemplate();
      break;
      
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  const agentConfig: AgentConfig = {
    id,
    name,
    description,
    provider: llmProvider,
    extractor,
    template: agentTemplate,
    systemPrompt,
    tools,
    mcpServices,
    options: {
      agenticMode: true,
      maxAgenticIterations: 10,
      ...options
    }
  };

  return new Agent(agentConfig);
}

// Specific agent factory functions
export function createOpenAIAgent(
  id: string,
  name: string,
  description: string,
  config: OpenAIConfig,
  systemPrompt?: string,
  tools?: ToolDefinition[],
  mcpServices?: Array<{
    label: string;
    transport: string | MCPTransport;
  }>,
  options?: ChatSessionOptions
): Agent {
  return createAgent({
    id,
    name,
    description,
    provider: 'openai',
    providerConfig: config,
    systemPrompt,
    tools,
    mcpServices,
    options
  });
}

export function createClaudeAgent(
  id: string,
  name: string,
  description: string,
  config: ClaudeConfig,
  systemPrompt?: string,
  tools?: ToolDefinition[],
  mcpServices?: Array<{
    label: string;
    transport: string | MCPTransport;
  }>,
  options?: ChatSessionOptions
): Agent {
  return createAgent({
    id,
    name,
    description,
    provider: 'claude',
    providerConfig: config,
    systemPrompt,
    tools,
    mcpServices,
    options
  });
}

export function createGeminiAgent(
  id: string,
  name: string,
  description: string,
  config: GeminiConfig,
  systemPrompt?: string,
  tools?: ToolDefinition[],
  mcpServices?: Array<{
    label: string;
    transport: string | MCPTransport;
  }>,
  options?: ChatSessionOptions
): Agent {
  return createAgent({
    id,
    name,
    description,
    provider: 'gemini',
    providerConfig: config,
    systemPrompt,
    tools,
    mcpServices,
    options
  });
}

export function createMistralAgent(
  id: string,
  name: string,
  description: string,
  config: MistralConfig,
  systemPrompt?: string,
  tools?: ToolDefinition[],
  mcpServices?: Array<{
    label: string;
    transport: string | MCPTransport;
  }>,
  options?: ChatSessionOptions
): Agent {
  return createAgent({
    id,
    name,
    description,
    provider: 'mistral',
    providerConfig: config,
    systemPrompt,
    tools,
    mcpServices,
    options
  });
}

export function createGroqAgent(
  id: string,
  name: string,
  description: string,
  config: GroqConfig,
  systemPrompt?: string,
  tools?: ToolDefinition[],
  mcpServices?: Array<{
    label: string;
    transport: string | MCPTransport;
  }>,
  options?: ChatSessionOptions
): Agent {
  return createAgent({
    id,
    name,
    description,
    provider: 'groq',
    providerConfig: config,
    systemPrompt,
    tools,
    mcpServices,
    options
  });
}

export function createOllamaAgent(
  id: string,
  name: string,
  description: string,
  config: OllamaConfig,
  systemPrompt?: string,
  tools?: ToolDefinition[],
  mcpServices?: Array<{
    label: string;
    transport: string | MCPTransport;
  }>,
  options?: ChatSessionOptions
): Agent {
  return createAgent({
    id,
    name,
    description,
    provider: 'ollama',
    providerConfig: config,
    systemPrompt,
    tools,
    mcpServices,
    options
  });
}



export function createMCPService(): MCPService {
  return new MCPService();
}

function getDefaultTemplate(): Template {
  return {
    name: 'default',
    content: '{{#each Messages}}{{#if (eq role "user")}}User: {{content}}\n{{/if}}{{#if (eq role "assistant")}}Assistant: {{content}}\n{{/if}}{{#if (eq role "system")}}System: {{content}}\n{{/if}}{{/each}}Assistant: ',
    stop: ['User:', 'System:'],
    protocol: 'auto',
    toolCallFormat: 'auto'
  };
}

// Agent workflow builders
export interface AgentWorkflowConfig {
  agents: Agent[];
  sequence?: string[]; // Order of agent execution
  parallel?: boolean; // Execute agents in parallel
  maxRetries?: number;
  fallbackAgent?: Agent;
}

export class AgentWorkflow {
  private agents: Map<string, Agent> = new Map();
  private sequence: string[] = [];
  private parallel: boolean = false;
  private maxRetries: number = 3;
  private fallbackAgent?: Agent;

  constructor(config: AgentWorkflowConfig) {
    config.agents.forEach(agent => {
      this.agents.set(agent.id, agent);
    });
    
    this.sequence = config.sequence || config.agents.map(a => a.id);
    this.parallel = config.parallel || false;
    this.maxRetries = config.maxRetries || 3;
    this.fallbackAgent = config.fallbackAgent;
  }

  async execute(task: string, context?: Record<string, any>): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    if (this.parallel) {
      // Execute all agents in parallel
      const promises = this.sequence.map(async (agentId) => {
        const agent = this.agents.get(agentId);
        if (!agent) throw new Error(`Agent ${agentId} not found`);
        
        const result = await this.executeWithRetry(agent, task, context);
        return { agentId, result };
      });
      
      const parallelResults = await Promise.all(promises);
      parallelResults.forEach(({ agentId, result }) => {
        results.set(agentId, result);
      });
    } else {
      // Execute agents sequentially
      let currentContext = context || {};
      
      for (const agentId of this.sequence) {
        const agent = this.agents.get(agentId);
        if (!agent) throw new Error(`Agent ${agentId} not found`);
        
        const result = await this.executeWithRetry(agent, task, currentContext);
        results.set(agentId, result);
        
        // Update context for next agent
        currentContext = {
          ...currentContext,
          [`${agentId}_result`]: result
        };
      }
    }
    
    return results;
  }

  private async executeWithRetry(agent: Agent, task: string, context?: Record<string, any>): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await agent.execute(task, context);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Agent ${agent.id} failed attempt ${attempt + 1}: ${lastError.message}`);
      }
    }
    
    // If all retries failed, try fallback agent
    if (this.fallbackAgent) {
      try {
        return await this.fallbackAgent.execute(task, context);
      } catch (fallbackError) {
        throw new Error(`All agents failed. Last error: ${lastError?.message}, Fallback error: ${fallbackError}`);
      }
    }
    
    throw lastError || new Error('Agent execution failed');
  }
}

export function createAgentWorkflow(config: AgentWorkflowConfig): AgentWorkflow {
  return new AgentWorkflow(config);
}
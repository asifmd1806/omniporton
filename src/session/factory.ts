import { ChatSession, ChatSessionOptions } from './ChatSession';
import { ChatSessionRegistry } from './ChatSessionRegistry';
import { SessionStorage, MemorySessionStorage, FileSessionStorage, DatabaseSessionStorage } from './storage';
import { OpenAIProvider, OpenAIConfig, GeminiProvider, GeminiConfig, ClaudeProvider, ClaudeConfig, MistralProvider, MistralConfig, GroqProvider, GroqConfig, OllamaProvider, OllamaConfig, NodeLlamaCppProvider, NodeLlamaCppConfig } from '../provider';
import { OpenAIExtractor, GeminiExtractor, ClaudeExtractor, NodeLlamaCppExtractor } from '../extractor';
import { templateRegistry } from '../template/defaultRegistry';
import { MCPService } from '../mcp/MCPService';
import { MonitoringService } from '../monitoring/MonitoringService';
import type { LLMProvider } from '../provider';
import type { MessageExtractor } from '../extractor';
import type { Template } from '../template/types';

// Provider categories for better organization
export const LOCAL_PROVIDERS = ['ollama', 'node-llama-cpp'] as const;
export const CLOUD_PROVIDERS = ['openai', 'gemini', 'claude', 'mistral', 'groq'] as const;

export type LocalProvider = typeof LOCAL_PROVIDERS[number];
export type CloudProvider = typeof CLOUD_PROVIDERS[number];
export type Provider = LocalProvider | CloudProvider | 'custom';

export interface SessionConfig {
  sessionId: string;
  agentId?: string;
  provider: Provider;
  providerConfig?: any;
  modelId?: string;
  template?: Template;
  mcpService?: MCPService;
  monitoringService?: MonitoringService;
  options?: ChatSessionOptions;
  storage?: {
    type: 'memory' | 'file' | 'database';
    config?: {
      basePath?: string;        // For file storage
      connectionString?: string; // For database storage
    };
  };
}

export function createChatSession(config: SessionConfig): ChatSession {
  const { 
    sessionId, 
    agentId = sessionId,
    provider, 
    providerConfig = {}, 
    modelId, 
    template, 
    mcpService, 
    monitoringService,
    options = {},
    storage
  } = config;

  // Create storage instance based on configuration
  let sessionStorage: SessionStorage | undefined;
  if (storage) {
    switch (storage.type) {
      case 'memory':
        sessionStorage = new MemorySessionStorage();
        break;
      case 'file':
        sessionStorage = new FileSessionStorage(storage.config?.basePath);
        break;
      case 'database':
        if (!storage.config?.connectionString) {
          throw new Error('Database storage requires connectionString in config');
        }
        sessionStorage = new DatabaseSessionStorage(storage.config.connectionString);
        break;
      default:
        throw new Error(`Unsupported storage type: ${storage.type}`);
    }
  }
  
  let llmProvider: LLMProvider;
  let extractor: MessageExtractor;
  let sessionTemplate: Template;

  // Create provider and extractor based on type
  switch (provider) {
    case 'openai':
      const openaiConfig: OpenAIConfig = {
        apiKey: providerConfig.apiKey,
        model: providerConfig.model || 'gpt-3.5-turbo',
        ...(providerConfig.baseURL !== undefined && { baseURL: providerConfig.baseURL }),
        ...(providerConfig.organization !== undefined && { organization: providerConfig.organization })
      };
      llmProvider = new OpenAIProvider(openaiConfig);
      extractor = new OpenAIExtractor();
      sessionTemplate = template || getDefaultTemplate();
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
      sessionTemplate = template || getDefaultTemplate();
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
      sessionTemplate = template || getDefaultTemplate();
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
      sessionTemplate = template || getDefaultTemplate();
      break;
      
    case 'groq':
      const groqConfig: GroqConfig = {
        apiKey: providerConfig.apiKey,
        model: providerConfig.model || 'llama2-70b-4096',
        baseURL: providerConfig.baseURL
      };
      llmProvider = new GroqProvider(groqConfig);
      extractor = new OpenAIExtractor(); // Groq uses OpenAI-compatible format
      sessionTemplate = template || getDefaultTemplate();
      break;
      
    case 'ollama':
      const ollamaConfig: OllamaConfig = {
        baseURL: providerConfig.baseURL || 'http://localhost:11434',
        model: providerConfig.model || 'llama2',
        temperature: providerConfig.temperature,
        topP: providerConfig.topP,
        contextLength: providerConfig.contextLength
      };
      llmProvider = new OllamaProvider(ollamaConfig);
      extractor = new OpenAIExtractor(); // Ollama uses OpenAI-compatible format
      sessionTemplate = template || getDefaultTemplate();
      break;
      
    case 'node-llama-cpp':
      const nodeLlamaSessionConfig: NodeLlamaCppConfig = {
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
      if (!nodeLlamaSessionConfig.modelPath) throw new Error('modelPath required for node-llama-cpp provider');
      llmProvider = new NodeLlamaCppProvider(nodeLlamaSessionConfig);
      extractor = new NodeLlamaCppExtractor();
      sessionTemplate = template || (modelId ? templateRegistry.get(modelId) : undefined) || getDefaultTemplate();
      break;
      
    case 'custom':
      llmProvider = providerConfig.provider;
      extractor = providerConfig.extractor;
      sessionTemplate = template || providerConfig.template || getDefaultTemplate();
      break;
      
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  const service = mcpService || new MCPService();
  
  // Create ChatSession with integrated monitoring
  return new ChatSession(
    sessionId,
    llmProvider,
    extractor,
    sessionTemplate,
    service,
    [],
    options,
    agentId,
    monitoringService
  );
}

// Convenience function for creating monitored sessions
export function createMonitoredChatSession(config: SessionConfig & {
  monitoringOptions?: ChatSessionOptions['monitoring'];
}): ChatSession {
  const { monitoringOptions, ...sessionConfig } = config;
  
  const options = sessionConfig.options || {};
  options.monitoring = {
    enabled: true,
    trackTokens: true,
    trackCosts: true,
    trackTools: true,
    ...monitoringOptions
  };

  return createChatSession({
    ...sessionConfig,
    options
  });
}

export function createChatSessionRegistry(): ChatSessionRegistry {
  return new ChatSessionRegistry();
}

export function createMCPService(): MCPService {
  return new MCPService();
}

export function createMonitoringService(config?: any): MonitoringService {
  return new MonitoringService(config);
}

// Storage factory functions
export function createMemoryStorage(): MemorySessionStorage {
  return new MemorySessionStorage();
}

export function createFileStorage(basePath?: string): FileSessionStorage {
  return new FileSessionStorage(basePath);
}

export function createDatabaseStorage(connectionString: string): DatabaseSessionStorage {
  return new DatabaseSessionStorage(connectionString);
}

function getDefaultTemplate(): Template {
  return {
    name: 'default',
    content: '{{#each Messages}}{{#if (eq role "user")}}User: {{content}}\n{{/if}}{{#if (eq role "assistant")}}Assistant: {{content}}\n{{/if}}{{#if (eq role "system")}}System: {{content}}\n{{/if}}{{/each}}Assistant: ',
    stop: ['User:', 'System:']
  };
}
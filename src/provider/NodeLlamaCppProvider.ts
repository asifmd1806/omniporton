import { LLMProvider, ProviderResponse, StreamChunk, CompletionParams } from './LLMProvider';
import { HTTPRetryHandler } from '../utils/RetryHandler';
import type { ChatMessage } from '../chat/types';
import { validateMediaForProvider } from '../providers/multimodal';

export interface NodeLlamaCppConfig {
  modelPath: string;
  contextSize?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  repeatPenalty?: number;
  seed?: number;
  threads?: number;
  gpuLayers?: number;
  mmap?: boolean;
  mlock?: boolean;
  vocabOnly?: boolean;
  useFp16?: boolean;
  logitsAll?: boolean;
  embedding?: boolean;
  offloadKqv?: boolean;
  flashAttention?: boolean;
}

export interface ModelCapabilities {
  supportsVision: boolean;
  supportedImageFormats: string[];
  maxImageSize?: number;
  maxImages?: number;
}

export class NodeLlamaCppProvider implements LLMProvider {
  readonly name = 'node-llama-cpp';
  readonly type = 'local' as const;
  
  private config: NodeLlamaCppConfig;
  private retryHandler: HTTPRetryHandler;
  private llama: any; // LlamaCpp instance
  private model: any; // LlamaModel instance
  private context: any; // LlamaContext instance
  private chatSession: any; // LlamaChatSession instance
  private capabilities: ModelCapabilities;
  private isInitialized: boolean = false;

  constructor(config: NodeLlamaCppConfig) {
    this.config = {
      contextSize: 4096,
      temperature: 0.7,
      topK: 40,
      topP: 0.9,
      repeatPenalty: 1.1,
      threads: 4,
      gpuLayers: 0,
      mmap: true,
      mlock: false,
      vocabOnly: false,
      useFp16: false,
      logitsAll: false,
      embedding: false,
      offloadKqv: true,
      flashAttention: false,
      ...config
    };

    this.retryHandler = new HTTPRetryHandler({
      maxAttempts: 3,
      baseDelay: 500,
      maxDelay: 5000,
      backoffFactor: 2,
      jitter: true
    });

    this.capabilities = {
      supportsVision: false,
      supportedImageFormats: [],
      maxImageSize: undefined,
      maxImages: 0
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Dynamic import to handle optional dependency
      const { getLlama } = await import('node-llama-cpp');
      
      this.llama = await getLlama();
      this.model = await this.llama.loadModel({
        modelPath: this.config.modelPath,
        gpuLayers: this.config.gpuLayers,
        useMmap: this.config.mmap,
        useMlock: this.config.mlock,
        vocabOnly: this.config.vocabOnly,
        useFp16: this.config.useFp16,
        logitsAll: this.config.logitsAll,
        embedding: this.config.embedding
      });

      this.context = await this.model.createContext({
        contextSize: this.config.contextSize,
        threads: this.config.threads,
        offloadKqv: this.config.offloadKqv,
        flashAttention: this.config.flashAttention
      });

      // Create chat session using modern API
      const { LlamaChatSession } = await import('node-llama-cpp');
      this.chatSession = new LlamaChatSession({
        contextSequence: this.context.getSequence()
      });

      // Detect model capabilities
      await this.detectModelCapabilities();
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize node-llama-cpp: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async detectModelCapabilities(): Promise<void> {
    try {
      // Check if model supports vision by examining metadata or trying a vision-specific prompt
      const modelMetadata = this.model.metadata || {};
      const modelName = modelMetadata.name || this.config.modelPath.toLowerCase();
      
      // Common vision model patterns
      const visionPatterns = [
        'llava', 'minicpm-v', 'cogvlm', 'qwen-vl', 'internvl', 
        'blip', 'instructblip', 'bakllava', 'vision'
      ];
      
      const isVisionModel = visionPatterns.some(pattern => 
        modelName.includes(pattern.toLowerCase())
      );

      if (isVisionModel) {
        this.capabilities = {
          supportsVision: true,
          supportedImageFormats: ['image/jpeg', 'image/png'],
          maxImageSize: 2048 * 2048, // 2MP default limit
          maxImages: 1 // Most models support single image
        };
      }
    } catch (error) {
      console.warn('Could not detect model capabilities:', error);
      // Default to text-only capabilities
      this.capabilities = {
        supportsVision: false,
        supportedImageFormats: [],
        maxImages: 0
      };
    }
  }

  getCapabilities(): ModelCapabilities {
    return { ...this.capabilities };
  }

  supportsMultiModal(): boolean {
    return this.capabilities.supportsVision;
  }

  supportsTools(): boolean {
    return true; // Basic tool support through structured output
  }

  supportsStreaming(): boolean {
    return true;
  }

  private validateMultiModalContent(messages: ChatMessage[]): void {
    const hasImages = messages.some(msg => {
      if (typeof msg.content === 'string') return false;
      if (Array.isArray(msg.content)) {
        return msg.content.some(item => 
          typeof item === 'object' && 'type' in item && item.type === 'image'
        );
      }
      return typeof msg.content === 'object' && 'type' in msg.content && msg.content.type === 'image';
    });

    if (hasImages && !this.capabilities.supportsVision) {
      throw new Error(
        `Model ${this.config.modelPath} does not support vision capabilities. ` +
        'Please use a vision-enabled model like LLaVA, MiniCPM-V, or similar.'
      );
    }

    if (hasImages) {
      // Validate each image against provider capabilities
      for (const message of messages) {
        if (typeof message.content !== 'string' && message.content) {
          const content = Array.isArray(message.content) ? message.content : [message.content];
          for (const item of content) {
            if (typeof item === 'object' && 'type' in item && item.type === 'image') {
              const validation = validateMediaForProvider('node-llama-cpp', item as any);
              if (!validation.valid) {
                throw new Error(`Invalid image content: ${validation.errors.join(', ')}`);
              }
            }
          }
        }
      }
    }
  }

  private formatMessagesForLlama(messages: ChatMessage[]): string {
    // Convert messages to a format suitable for llama.cpp
    // This is a basic implementation - you may need to adjust based on your model's format
    return messages.map(msg => {
      const role = msg.role === 'assistant' ? 'Assistant' : 
                   msg.role === 'system' ? 'System' : 'User';
      
      if (typeof msg.content === 'string') {
        return `${role}: ${msg.content}`;
      }
      
      // Handle multimodal content
      if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter(item => typeof item === 'string' || (typeof item === 'object' && item.type === 'text'))
          .map(item => typeof item === 'string' ? item : item.text || '')
          .join(' ');
        
        const hasImages = msg.content.some(item => 
          typeof item === 'object' && item.type === 'image'
        );
        
        return `${role}: ${hasImages ? '[IMAGE] ' : ''}${textParts}`;
      }
      
      if (typeof msg.content === 'object') {
        if (msg.content.type === 'text') {
          return `${role}: ${msg.content.text || ''}`;
        }
        if (msg.content.type === 'image') {
          return `${role}: [IMAGE] Image content`;
        }
      }
      
      return `${role}: ${String(msg.content)}`;
    }).join('\n') + '\nAssistant:';
  }

  async completion(params: CompletionParams): Promise<ProviderResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.retryHandler.execute(async () => {
      // Validate multimodal content
      this.validateMultiModalContent(params.messages);

      const prompt = this.formatMessagesForLlama(params.messages);
      
      // Use LlamaChatSession API
      const response = await this.chatSession.prompt(prompt, {
        maxTokens: params.max_tokens || 1000,
        temperature: this.config.temperature,
        topK: this.config.topK,
        topP: this.config.topP,
        repeatPenalty: this.config.repeatPenalty,
        seed: this.config.seed
      });

      return {
        content: response || '',
        usage: {
          prompt_tokens: 0, // node-llama-cpp doesn't expose token counts directly
          completion_tokens: 0,
          total_tokens: 0
        },
        raw: { response },
        finished: true
      };
    }, {
      operationName: 'node-llama-cpp completion'
    });
  }

  async stream(
    params: CompletionParams,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.retryHandler.execute(async () => {
      // Validate multimodal content
      this.validateMultiModalContent(params.messages);

      const prompt = this.formatMessagesForLlama(params.messages);
      
      let fullResponse = '';
      let tokensGenerated = 0;
      
      const response = await this.context.evaluate({
        inputText: prompt,
        maxTokens: params.max_tokens || 1000,
        temperature: this.config.temperature,
        topK: this.config.topK,
        topP: this.config.topP,
        repeatPenalty: this.config.repeatPenalty,
        seed: this.config.seed,
        onToken: (token: string) => {
          fullResponse += token;
          tokensGenerated++;
          
          if (onChunk) {
            onChunk({
              content: token,
              finished: false
            });
          }
        }
      });

      // Send final chunk
      if (onChunk) {
        onChunk({
          content: '',
          finished: true
        });
      }
    }, {
      operationName: 'node-llama-cpp streaming'
    });
  }

  async dispose(): Promise<void> {
    try {
      if (this.context) {
        await this.context.dispose();
      }
      if (this.model) {
        await this.model.dispose();
      }
      this.isInitialized = false;
    } catch (error) {
      console.warn('Error disposing node-llama-cpp resources:', error);
    }
  }
}
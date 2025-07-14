import type { MediaContent, MessageContent, TextContent } from '../chat/types';

/**
 * Multi-modal provider utilities for converting between different provider formats
 */

/**
 * OpenAI format for multi-modal messages
 */
export interface OpenAIMessageContent {
  type: 'text' | 'image_url' | 'audio' | 'video';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
  audio?: {
    data: string;
    format: string;
  };
  video?: {
    data: string;
    format: string;
  };
}

/**
 * Anthropic Claude format for multi-modal messages
 */
export interface ClaudeMessageContent {
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * Google Gemini format for multi-modal messages
 */
export interface GeminiMessageContent {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  fileData?: {
    mimeType: string;
    fileUri: string;
  };
}

/**
 * Convert MessageContent to OpenAI format
 */
export function toOpenAIFormat(content: string | MessageContent): OpenAIMessageContent[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (Array.isArray(content)) {
    return content.map(item => convertToOpenAI(item));
  }

  return [convertToOpenAI(content)];
}

function convertToOpenAI(item: TextContent | MediaContent): OpenAIMessageContent {
  if (item.type === 'text') {
    return { type: 'text', text: item.text };
  }

  const media = item as MediaContent;
  
  switch (media.type) {
    case 'image':
      return {
        type: 'image_url',
        image_url: {
          url: media.url || `data:${media.mimeType};base64,${media.data}`,
          detail: 'auto'
        }
      };
    
    case 'audio':
      if (!media.data) {
        throw new Error('Audio content requires base64 data for OpenAI');
      }
      return {
        type: 'audio',
        audio: {
          data: media.data,
          format: media.mimeType?.split('/')[1] || 'wav'
        }
      };
    
    case 'video':
      if (!media.data) {
        throw new Error('Video content requires base64 data for OpenAI');
      }
      return {
        type: 'video',
        video: {
          data: media.data,
          format: media.mimeType?.split('/')[1] || 'mp4'
        }
      };
    
    default:
      throw new Error(`Unsupported media type for OpenAI: ${media.type}`);
  }
}

/**
 * Convert MessageContent to Claude format
 */
export function toClaudeFormat(content: string | MessageContent): ClaudeMessageContent[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (Array.isArray(content)) {
    return content.map(item => convertToClaude(item));
  }

  return [convertToClaude(content)];
}

function convertToClaude(item: TextContent | MediaContent): ClaudeMessageContent {
  if (item.type === 'text') {
    return { type: 'text', text: item.text };
  }

  const media = item as MediaContent;
  
  if (!media.data || !media.mimeType) {
    throw new Error('Claude requires base64 data and mimeType for media content');
  }

  return {
    type: media.type === 'document' ? 'document' : media.type,
    source: {
      type: 'base64',
      media_type: media.mimeType,
      data: media.data
    }
  };
}

/**
 * Convert MessageContent to Gemini format
 */
export function toGeminiFormat(content: string | MessageContent): GeminiMessageContent[] {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  if (Array.isArray(content)) {
    return content.map(item => convertToGemini(item));
  }

  return [convertToGemini(content)];
}

function convertToGemini(item: TextContent | MediaContent): GeminiMessageContent {
  if (item.type === 'text') {
    return { text: item.text };
  }

  const media = item as MediaContent;
  
  if (media.url) {
    if (!media.mimeType) {
      throw new Error('Gemini requires mimeType for URL-based media');
    }
    return {
      fileData: {
        mimeType: media.mimeType,
        fileUri: media.url
      }
    };
  }

  if (media.data && media.mimeType) {
    return {
      inlineData: {
        mimeType: media.mimeType,
        data: media.data
      }
    };
  }

  throw new Error('Gemini requires either URL or base64 data with mimeType');
}

/**
 * Check if a provider supports multi-modal content
 */
export function supportsMultiModal(providerName: string): boolean {
  const supportedProviders = ['openai', 'claude', 'gemini', 'ollama', 'node-llama-cpp'];
  return supportedProviders.includes(providerName.toLowerCase());
}

/**
 * Check if specific media type is supported by provider
 */
export function supportsMediaType(providerName: string, mediaType: MediaContent['type']): boolean {
  const provider = providerName.toLowerCase();
  
  switch (provider) {
    case 'openai':
      return ['image', 'audio', 'video'].includes(mediaType);
    
    case 'claude':
      return ['image', 'audio', 'video', 'document'].includes(mediaType);
    
    case 'gemini':
      return ['image', 'audio', 'video', 'document'].includes(mediaType);
    
    case 'mistral':
      return ['image'].includes(mediaType); // Limited multi-modal support
    
    case 'groq':
      return false; // No multi-modal support yet
    
    case 'ollama':
      return ['image'].includes(mediaType); // Depends on model (e.g., llava)
    
    case 'node-llama-cpp':
      return ['image'].includes(mediaType); // Model-dependent vision support
    
    default:
      return false;
  }
}

/**
 * Get supported MIME types for a provider and media type
 */
export function getSupportedMimeTypes(providerName: string, mediaType: MediaContent['type']): string[] {
  const provider = providerName.toLowerCase();
  
  switch (provider) {
    case 'openai':
      switch (mediaType) {
        case 'image':
          return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        case 'audio':
          return ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
        case 'video':
          return ['video/mp4', 'video/avi', 'video/mov'];
        default:
          return [];
      }
    
    case 'claude':
      switch (mediaType) {
        case 'image':
          return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        case 'audio':
          return ['audio/wav', 'audio/mp3', 'audio/mpeg'];
        case 'video':
          return ['video/mp4', 'video/avi'];
        case 'document':
          return ['application/pdf', 'text/plain', 'application/json'];
        default:
          return [];
      }
    
    case 'gemini':
      switch (mediaType) {
        case 'image':
          return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        case 'audio':
          return ['audio/wav', 'audio/mp3', 'audio/mpeg'];
        case 'video':
          return ['video/mp4', 'video/avi', 'video/mov'];
        case 'document':
          return ['application/pdf', 'text/plain'];
        default:
          return [];
      }
    
    case 'ollama':
      switch (mediaType) {
        case 'image':
          return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        default:
          return [];
      }
    
    case 'node-llama-cpp':
      switch (mediaType) {
        case 'image':
          return ['image/jpeg', 'image/png']; // Conservative format support
        default:
          return [];
      }
    
    default:
      return [];
  }
}

/**
 * Convert MessageContent to node-llama-cpp format
 */
export function toNodeLlamaCppFormat(content: string | MessageContent): Array<{ type: 'text' | 'image'; text?: string; image?: string; url?: string }> {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (Array.isArray(content)) {
    return content.map(item => convertToNodeLlamaCpp(item));
  }

  return [convertToNodeLlamaCpp(content)];
}

function convertToNodeLlamaCpp(item: TextContent | MediaContent): { type: 'text' | 'image'; text?: string; image?: string; url?: string } {
  if (item.type === 'text') {
    return { type: 'text', text: item.text };
  }

  const media = item as MediaContent;
  
  if (media.type === 'image') {
    if (media.url) {
      return { type: 'image', url: media.url };
    }
    if (media.data && media.mimeType) {
      return { 
        type: 'image', 
        image: `data:${media.mimeType};base64,${media.data}` 
      };
    }
    throw new Error('Image content requires either URL or base64 data for node-llama-cpp');
  }
  
  throw new Error(`Unsupported media type for node-llama-cpp: ${media.type}`);
}

/**
 * Validate media content for a specific provider
 */
export function validateMediaForProvider(
  providerName: string, 
  media: MediaContent
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!supportsMultiModal(providerName)) {
    errors.push(`Provider ${providerName} does not support multi-modal content`);
    return { valid: false, errors };
  }
  
  if (!supportsMediaType(providerName, media.type)) {
    errors.push(`Provider ${providerName} does not support ${media.type} content`);
  }
  
  if (media.mimeType) {
    const supportedTypes = getSupportedMimeTypes(providerName, media.type);
    if (supportedTypes.length > 0 && !supportedTypes.includes(media.mimeType)) {
      errors.push(`Provider ${providerName} does not support MIME type ${media.mimeType} for ${media.type}`);
    }
  }
  
  const provider = providerName.toLowerCase();
  
  // Provider-specific validation
  if (provider === 'claude') {
    if (!media.data || !media.mimeType) {
      errors.push('Claude requires base64 data and mimeType for all media');
    }
  }
  
  if (provider === 'openai') {
    if (media.type === 'audio' || media.type === 'video') {
      if (!media.data) {
        errors.push(`OpenAI requires base64 data for ${media.type} content`);
      }
    }
  }
  
  if (provider === 'node-llama-cpp') {
    if (media.type === 'image') {
      if (!media.data && !media.url) {
        errors.push('node-llama-cpp requires either base64 data or URL for image content');
      }
      // Additional size validation could be added here
      if (media.mimeType && !['image/jpeg', 'image/png'].includes(media.mimeType)) {
        errors.push(`node-llama-cpp only supports JPEG and PNG images, got ${media.mimeType}`);
      }
    } else {
      errors.push(`node-llama-cpp only supports image content, ${media.type} is not supported`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
// Model-related types for llama.rn integration

export type ModelId = string;
export type ModelPath = string;

// Multi-modal model capabilities
export interface ModelCapabilities {
  supportsText: boolean;
  supportsImages: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsDocuments: boolean;
  maxImageSize?: number;
  maxAudioDuration?: number;
  maxVideoDuration?: number;
  supportedImageFormats?: string[];
  supportedAudioFormats?: string[];
  supportedVideoFormats?: string[];
  supportedDocumentFormats?: string[];
}

export interface RegisteredModel {
  id: ModelId;
  path: ModelPath;
  context?: any; // llama.rn context
  capabilities?: ModelCapabilities;
} 
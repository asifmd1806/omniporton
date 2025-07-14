/**
 * Model management module: handles model registry, loading, and info.
 * 
 * This module provides functionality for registering, loading, and managing
 * local LLM models with support for multi-modal capabilities.
 * 
 * @example
 * ```typescript
 * // Register specialized models for different use cases
 * registerModel('medical-llava', './models/medical-llava-7b.gguf', {
 *   supportsText: true,
 *   supportsImages: true,
 *   supportedImageFormats: ['image/jpeg', 'image/png', 'image/dicom'],
 *   supportsAudio: false,
 *   supportsVideo: false,
 *   supportsDocuments: true
 * });
 * 
 * registerModel('legal-claude', './models/claude-3-opus-legal.gguf', {
 *   supportsText: true,
 *   supportsImages: false,
 *   supportsDocuments: true,
 *   supportedDocumentFormats: ['application/pdf', 'application/msword']
 * });
 * ```
 */

// Dynamic import to handle optional dependency
// import { LlamaCpp, LlamaModel } from "node-llama-cpp";
import { ModelId, ModelPath, RegisteredModel, ModelCapabilities } from './types';

const modelRegistry = new Map<ModelId, RegisteredModel>();

/**
 * Register a model with the system
 * 
 * @param id - Unique identifier for the model
 * @param path - Path to the model file
 * @param capabilities - Optional capabilities specification
 * 
 * @example
 * ```typescript
 * // Register financial analysis model
 * registerModel('financial-analyst', './models/claude-3-sonnet-financial.gguf', {
 *   supportsText: true,
 *   supportsImages: true,
 *   supportsDocuments: true,
 *   supportedDocumentFormats: ['application/pdf', 'text/csv', 'application/vnd.ms-excel'],
 *   supportedImageFormats: ['image/jpeg', 'image/png']
 * });
 * 
 * // Register manufacturing quality control model
 * registerModel('quality-inspector', './models/llava-manufacturing-13b.gguf', {
 *   supportsText: true,
 *   supportsImages: true,
 *   maxImageCount: 10,
 *   supportedImageFormats: ['image/jpeg', 'image/png', 'image/bmp']
 * });
 * ```
 */
export function registerModel(id: ModelId, path: ModelPath, capabilities?: ModelCapabilities): void {
  if (modelRegistry.has(id))
    throw new Error(`Model with id '${id}' already registered.`);
  modelRegistry.set(id, { id, path, capabilities });
}

/**
 * Get the context for a registered model
 * 
 * @param id - The model identifier
 * @param params - Optional initialization parameters
 * @returns Promise that resolves to the model context
 * 
 * @example
 * ```typescript
 * // Production configuration for customer service
 * const customerServiceContext = await getModelContext('customer-service-llama', {
 *   contextSize: 2048,
 *   temperature: 0.2,
 *   maxTokens: 1024,
 *   stopSequences: ['[END]', '[TICKET_CLOSED]']
 * });
 * 
 * // High-precision medical analysis
 * const medicalContext = await getModelContext('medical-llava', {
 *   contextSize: 8192,
 *   temperature: 0.1,
 *   maxTokens: 2048,
 *   threads: 16
 * });
 * ```
 */
export async function getModelContext(
  id: ModelId,
  params: Record<string, any> = {},
): Promise<any> {
  const model = modelRegistry.get(id);
  if (!model) throw new Error(`Model with id '${id}' not registered.`);
  if (!model.context) {
    try {
      // Dynamic import to handle optional dependency
      const { getLlama } = await import('node-llama-cpp');
      
      const llama = await getLlama();
      const llamaModel = await llama.loadModel({ modelPath: model.path, ...params });
      model.context = llamaModel.createContext(params);
    } catch (error) {
      throw new Error(`Failed to initialize model context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return model.context;
}

export async function getModelInfo(id: ModelId): Promise<any> {
  const model = modelRegistry.get(id);
  if (!model) throw new Error(`Model with id '${id}' not registered.`);
  
  try {
    // Dynamic import to handle optional dependency
    const { getLlama } = await import('node-llama-cpp');
    
    const llama = await getLlama();
    const llamaModel = await llama.loadModel({ modelPath: model.path });
    
    // Return basic model info - node-llama-cpp doesn't have direct equivalent to loadLlamaModelInfo
    return {
      path: model.path,
      id: id,
      capabilities: model.capabilities,
      metadata: (llamaModel as any).metadata || {}
    };
  } catch (error) {
    throw new Error(`Failed to load model info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function listModels(): RegisteredModel[] {
  return Array.from(modelRegistry.values());
}

/**
 * Get the capabilities of a registered model
 * 
 * @param id - The model identifier
 * @returns The model's capabilities or undefined if not found
 * 
 * @example
 * ```typescript
 * // Dynamic feature enablement based on model capabilities
 * const medicalCapabilities = getModelCapabilities('medical-llava');
 * 
 * if (medicalCapabilities?.supportsImages) {
 *   enableXrayAnalysis();
 *   enableMriProcessing();
 * }
 * 
 * if (medicalCapabilities?.supportsDocuments) {
 *   enableLabReportAnalysis();
 *   enableMedicalRecordProcessing();
 * }
 * 
 * // Validate supported formats
 * const supportedFormats = medicalCapabilities?.supportedImageFormats;
 * if (supportedFormats?.includes('image/dicom')) {
 *   enableDicomProcessing();
 * }
 * ```
 */
export function getModelCapabilities(id: ModelId): ModelCapabilities | undefined {
  const model = modelRegistry.get(id);
  return model?.capabilities;
}

/**
 * Check if a model supports multi-modal content
 * 
 * @param id - The model identifier
 * @returns True if the model supports any type of multi-modal content
 * 
 * @example
 * ```typescript
 * // Route requests to appropriate models
 * const userRequest = getUserRequest();
 * 
 * if (isMultiModal(userRequest)) {
 *   if (supportsMultiModal('legal-vision-model')) {
 *     // Use vision model for document analysis
 *     const legalAnalysis = await analyzeLegalDocument(userRequest);
 *   } else {
 *     // Extract text and use text-only model
 *     const textContent = extractText(userRequest);
 *     const response = await processTextOnly(textContent);
 *   }
 * }
 * ```
 */
export function supportsMultiModal(id: ModelId): boolean {
  const capabilities = getModelCapabilities(id);
  if (!capabilities) return false;
  
  return capabilities.supportsImages || 
         capabilities.supportsAudio || 
         capabilities.supportsVideo || 
         capabilities.supportsDocuments;
}
 
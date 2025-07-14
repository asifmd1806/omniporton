import type { MediaContent, MessageContent, TextContent } from '../chat/types';

/**
 * Utility functions for handling multi-modal media content
 * 
 * This module provides comprehensive utilities for working with multi-modal content
 * including images, audio, video, and documents in AI chat applications.
 * 
 * @example
 * ```typescript
 * // Medical X-ray analysis
 * const xrayImage = createImageFromUrl('https://hospital.com/xray-001.jpg');
 * const diagnosis = createMultiModalContent(
 *   'Analyze this chest X-ray for pneumonia signs',
 *   xrayImage
 * );
 * 
 * // Financial document processing
 * const financialReport = createDocumentFromData(
 *   reportPdfBase64,
 *   'application/pdf',
 *   'quarterly-earnings.pdf'
 * );
 * ```
 */

/**
 * Creates a text content object for use in multi-modal messages
 * 
 * @param text - The text content to include
 * @returns A TextContent object
 * 
 * @example
 * ```typescript
 * // Customer service response
 * const response = createTextContent(
 *   'Thank you for contacting TechCorp support. Your order #12345 has been processed.'
 * );
 * ```
 */
export function createTextContent(text: string): TextContent {
  return {
    type: 'text',
    text
  };
}

/**
 * Creates a media content object from a URL
 * 
 * @param type - The type of media (image, audio, video, document)
 * @param url - The URL to the media file
 * @param mimeType - Optional MIME type of the media
 * @param metadata - Optional additional metadata
 * @returns A MediaContent object
 * 
 * @example
 * ```typescript
 * const imageContent = createMediaFromUrl('image', 'https://example.com/photo.jpg', 'image/jpeg');
 * ```
 */
export function createMediaFromUrl(
  type: MediaContent['type'],
  url: string,
  mimeType?: string,
  metadata?: Record<string, any>
): MediaContent {
  return {
    type,
    url,
    mimeType,
    metadata
  };
}

/**
 * Creates a media content object from base64 data
 * 
 * @param type - The type of media (image, audio, video, document)
 * @param data - Base64 encoded media data
 * @param mimeType - MIME type of the media
 * @param filename - Optional original filename
 * @param metadata - Optional additional metadata
 * @returns A MediaContent object
 * 
 * @example
 * ```typescript
 * const imageContent = createMediaFromData('image', base64Data, 'image/png', 'screenshot.png');
 * ```
 */
export function createMediaFromData(
  type: MediaContent['type'],
  data: string,
  mimeType: string,
  filename?: string,
  metadata?: Record<string, any>
): MediaContent {
  return {
    type,
    data,
    mimeType,
    filename,
    metadata
  };
}

/**
 * Creates an image content object from URL
 * 
 * @param url - The URL to the image
 * @param mimeType - Optional MIME type (e.g., 'image/jpeg', 'image/png')
 * @returns A MediaContent object for the image
 * 
 * @example
 * ```typescript
 * // Product quality inspection
 * const productImage = createImageFromUrl(
 *   'https://factory.com/qc/circuit-board-001.jpg',
 *   'image/jpeg'
 * );
 * const inspection = createMultiModalContent(
 *   'Inspect this PCB for manufacturing defects and solder joint quality',
 *   productImage
 * );
 * ```
 */
export function createImageFromUrl(url: string, mimeType?: string): MediaContent {
  return createMediaFromUrl('image', url, mimeType);
}

/**
 * Creates an image content object from base64 data
 */
export function createImageFromData(data: string, mimeType: string = 'image/jpeg'): MediaContent {
  return createMediaFromData('image', data, mimeType);
}

/**
 * Creates an audio content object from URL
 */
export function createAudioFromUrl(url: string, mimeType?: string): MediaContent {
  return createMediaFromUrl('audio', url, mimeType);
}

/**
 * Creates an audio content object from base64 data
 */
export function createAudioFromData(data: string, mimeType: string = 'audio/wav'): MediaContent {
  return createMediaFromData('audio', data, mimeType);
}

/**
 * Creates a video content object from URL
 */
export function createVideoFromUrl(url: string, mimeType?: string): MediaContent {
  return createMediaFromUrl('video', url, mimeType);
}

/**
 * Creates a video content object from base64 data
 */
export function createVideoFromData(data: string, mimeType: string = 'video/mp4'): MediaContent {
  return createMediaFromData('video', data, mimeType);
}

/**
 * Creates a document content object from URL
 */
export function createDocumentFromUrl(url: string, mimeType?: string): MediaContent {
  return createMediaFromUrl('document', url, mimeType);
}

/**
 * Creates a document content object from base64 data
 */
export function createDocumentFromData(data: string, mimeType: string, filename?: string): MediaContent {
  return createMediaFromData('document', data, mimeType, filename);
}

/**
 * Combines text and media content into a multi-modal message
 * 
 * @param contents - Variable number of text strings and MediaContent objects
 * @returns A MessageContent array containing all the content
 * 
 * @example
 * ```typescript
 * // Legal document review with multiple attachments
 * const contractReview = createMultiModalContent(
 *   'Review this merger agreement for compliance issues:',
 *   createDocumentFromData(agreementPdf, 'application/pdf', 'merger-agreement.pdf'),
 *   'Pay special attention to liability clauses and termination conditions.',
 *   createDocumentFromData(exhibitA, 'application/pdf', 'exhibit-a.pdf')
 * );
 * ```
 */
export function createMultiModalContent(...contents: (string | MediaContent)[]): MessageContent {
  return contents.map(content => 
    typeof content === 'string' 
      ? createTextContent(content)
      : content
  );
}

/**
 * Checks if content is multi-modal (contains media)
 * 
 * @param content - The content to check
 * @returns True if the content contains media (non-text) elements
 * 
 * @example
 * ```typescript
 * // Routing logic for different processing pipelines
 * const customerMessage = getCustomerMessage();
 * 
 * if (isMultiModal(customerMessage)) {
 *   // Route to vision model for image/document analysis
 *   await visionModel.analyze(customerMessage);
 * } else {
 *   // Route to text-only model for faster processing
 *   await textModel.chat(customerMessage);
 * }
 * ```
 */
export function isMultiModal(content: string | MessageContent): boolean {
  if (typeof content === 'string') return false;
  
  if (Array.isArray(content)) {
    return content.some(item => item.type !== 'text');
  }
  
  return content.type !== 'text';
}

/**
 * Extracts text from message content
 * 
 * @param content - The content to extract text from
 * @returns The concatenated text content
 * 
 * @example
 * ```typescript
 * // Extract text for search indexing
 * const customerInquiry = createMultiModalContent(
 *   'I need help with order #12345',
 *   createImageFromUrl('https://customer.com/receipt.jpg'),
 *   'The product arrived damaged'
 * );
 * 
 * const searchableText = extractText(customerInquiry); 
 * // 'I need help with order #12345 The product arrived damaged'
 * await searchIndex.add(searchableText);
 * ```
 */
export function extractText(content: string | MessageContent): string {
  if (typeof content === 'string') return content;
  
  if (Array.isArray(content)) {
    return content
      .filter(item => item.type === 'text')
      .map(item => (item as TextContent).text)
      .join(' ');
  }
  
  return content.type === 'text' ? (content as TextContent).text : '';
}

/**
 * Extracts media items from message content
 */
export function extractMedia(content: string | MessageContent): MediaContent[] {
  if (typeof content === 'string') return [];
  
  if (Array.isArray(content)) {
    return content.filter(item => item.type !== 'text') as MediaContent[];
  }
  
  return content.type !== 'text' ? [content as MediaContent] : [];
}

/**
 * Validates media content
 */
export function validateMediaContent(media: MediaContent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!media.url && !media.data) {
    errors.push('Media content must have either url or data');
  }
  
  if (media.data && !media.mimeType) {
    errors.push('Media content with data must specify mimeType');
  }
  
  if (media.url && !isValidUrl(media.url)) {
    errors.push('Invalid URL format');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Simple URL validation
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the file extension from a MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'audio/wav': 'wav',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'video/mp4': 'mp4',
    'video/avi': 'avi',
    'video/mov': 'mov',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/json': 'json'
  };
  
  return mimeMap[mimeType.toLowerCase()] || '';
}

/**
 * Gets MIME type from file extension
 */
export function getMimeTypeFromExtension(extension: string): string {
  const extMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'wav': 'audio/wav',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'mp4': 'video/mp4',
    'avi': 'video/avi',
    'mov': 'video/mov',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'json': 'application/json'
  };
  
  return extMap[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Converts a File object to MediaContent
 * 
 * @param file - The File object to convert
 * @returns Promise that resolves to a MediaContent object
 * 
 * @example
 * ```typescript
 * // Insurance claim processing
 * const damagePhoto = await fileToMediaContent(uploadedFile);
 * const claimAnalysis = createMultiModalContent(
 *   'Assess vehicle damage for insurance claim #INS-2024-001',
 *   damagePhoto,
 *   'Estimate repair costs and determine if vehicle is totaled'
 * );
 * 
 * // Medical record processing
 * const xrayFile = await fileToMediaContent(medicalFile);
 * const radiologyReview = createMultiModalContent(
 *   'Review chest X-ray for patient ID: 789456',
 *   xrayFile,
 *   'Look for signs of pneumonia or other respiratory conditions'
 * );
 * ```
 */
export async function fileToMediaContent(file: File): Promise<MediaContent> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const data = reader.result as string;
      const base64Data = data.split(',')[1]; // Remove data:mime;base64, prefix
      
      const mediaType: MediaContent['type'] = 
        file.type.startsWith('image/') ? 'image' :
        file.type.startsWith('audio/') ? 'audio' :
        file.type.startsWith('video/') ? 'video' :
        'document';
      
      resolve({
        type: mediaType,
        data: base64Data,
        mimeType: file.type,
        filename: file.name,
        metadata: {
          size: file.size,
          lastModified: file.lastModified
        }
      });
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
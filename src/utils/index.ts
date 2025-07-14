/**
 * Utilities module: shared helpers, tokenization, etc.
 */
import type { ModelId } from "../model";
import { getModelContext } from "../model";
import { z } from 'zod';

// Export media utilities
export * from './media';

// Export utility classes
export * from './RetryHandler';
export * from './Logger';
export * from './cost';

/**
 * Tokenize text using the specified model.
 */
export async function tokenize(
  modelId: ModelId,
  text: string,
): Promise<number[]> {
  const context = await getModelContext(modelId);
  return await context.tokenize(text);
}

/**
 * Detokenize tokens using the specified model.
 */
export async function detokenize(
  modelId: ModelId,
  tokens: number[],
): Promise<string> {
  const context = await getModelContext(modelId);
  return await context.detokenize(tokens);
}

/**
 * Convert a JSON Schema to a zod schema (basic implementation).
 * Only supports type: object with string/number/boolean properties.
 */
export function zodFromJsonSchema(schema: any): any {
  if (schema.type === 'object' && schema.properties) {
    const shape: Record<string, any> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      const p = prop as any;
      if (p.type === 'string') shape[key] = z.string();
      else if (p.type === 'number' || p.type === 'integer') shape[key] = z.number();
      else if (p.type === 'boolean') shape[key] = z.boolean();
      else if (p.type === 'object') shape[key] = z.any(); // fallback
      else shape[key] = z.any();
    }
    return z.object(shape);
  }
  // Fallback for non-object schemas
  return z.any();
}

// Simple cost estimation utility - no over-engineering
// Just basic provider-aware pricing for observability

interface ProviderPricing {
  input: number;  // cost per 1K tokens
  output: number; // cost per 1K tokens
}

// Basic pricing lookup - only the most common models
const PROVIDER_PRICING: Record<string, Record<string, ProviderPricing>> = {
  openai: {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
  },
  claude: {
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 }
  },
  gemini: {
    'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
    'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
    'gemini-pro': { input: 0.0005, output: 0.0015 }
  },
  groq: {
    'llama-3.1-70b-versatile': { input: 0.00059, output: 0.00079 },
    'llama-3.1-8b-instant': { input: 0.00005, output: 0.00008 },
    'mixtral-8x7b-32768': { input: 0.00024, output: 0.00024 }
  },
  mistral: {
    'mistral-large-latest': { input: 0.004, output: 0.012 },
    'mistral-medium-latest': { input: 0.0027, output: 0.0081 },
    'mistral-small-latest': { input: 0.001, output: 0.003 }
  }
};

// Default pricing for unknown providers/models
const DEFAULT_PRICING: ProviderPricing = {
  input: 0.001,
  output: 0.002
};

// Local providers (no cost)
const LOCAL_PROVIDERS = new Set(['llama.rn', 'ollama']);

/**
 * Simple cost estimation for observability
 */
export function estimateCost(
  provider: string, 
  model: string, 
  inputTokens: number, 
  outputTokens: number
): number {
  // Local providers have no cost
  if (LOCAL_PROVIDERS.has(provider)) {
    return 0;
  }
  
  // Look up provider pricing
  const pricing = PROVIDER_PRICING[provider]?.[model] || DEFAULT_PRICING;
  
  // Calculate cost per 1K tokens
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}

/**
 * Get available pricing info for a provider
 */
export function getProviderPricing(provider: string): Record<string, ProviderPricing> | null {
  return PROVIDER_PRICING[provider] || null;
}

/**
 * Check if provider has cost (not local)
 */
export function hasProviderCost(provider: string): boolean {
  return !LOCAL_PROVIDERS.has(provider);
}
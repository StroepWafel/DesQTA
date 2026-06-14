import type { AIProviderAdapter, AIProviderId } from './types';
import { geminiAdapter } from './providers/gemini';
import { cerebrasAdapter } from './providers/cerebras';

/**
 * Single source of truth for available AI providers. Adding a new provider is
 * a one-file change: build an adapter under providers/ and register it here.
 */
export const PROVIDERS: Record<AIProviderId, AIProviderAdapter> = {
  gemini: geminiAdapter,
  cerebras: cerebrasAdapter,
};

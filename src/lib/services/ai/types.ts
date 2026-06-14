/**
 * Shared types for the generic AIService abstraction.
 *
 * Adding a new provider:
 *   1. Add an entry to AIProviderId.
 *   2. Build an adapter implementing AIProviderAdapter under providers/.
 *   3. Register it in registry.ts.
 *
 * Each adapter is responsible for translating the generic AIRequest into
 * provider-specific HTTP, normalising the response back to AIResponse, and
 * exposing either a dynamic listModels (calls the provider's API) or
 * returning the bundled defaultModels.
 */

export type AIProviderId = 'gemini' | 'cerebras';

export interface AIModel {
  /** Provider-specific model id (sent verbatim in API requests). */
  id: string;
  /** Display name for the model picker UI. */
  label: string;
  /** Optional indicator that this is the preferred / default model. */
  recommended?: boolean;
  /** Token context window. Informational only. */
  contextWindow?: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  messages: AIMessage[];
  temperature?: number;
  /** Maximum tokens to generate. Default ~1024. */
  maxTokens?: number;
  topP?: number;
  /** When set, the adapter SHOULD ask the provider for JSON-formatted output. */
  responseFormat?: 'text' | 'json';
}

export interface AIResponse {
  /** Final assistant text (always present). */
  text: string;
  /** Raw provider payload for callers that need provider-specific details. */
  raw?: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AIProviderAdapter {
  id: AIProviderId;
  displayName: string;
  /** URL where users go to fetch an API key. Used by the setup screens. */
  apiKeyUrl?: string;
  /** Bundled fallback model list when the provider's listing API isn't reachable. */
  defaultModels: AIModel[];
  /**
   * Returns the current list of supported models. Implementations may either
   * call the provider's `/models` endpoint or simply return `defaultModels`.
   * Failures should fall back to `defaultModels`, never throw.
   */
  listModels(apiKey?: string): Promise<AIModel[]>;
  complete(req: AIRequest): Promise<AIResponse>;
}

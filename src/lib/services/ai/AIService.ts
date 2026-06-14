import { invoke } from '@tauri-apps/api/core';
import type {
  AIModel,
  AIProviderAdapter,
  AIProviderId,
  AIRequest,
  AIResponse,
} from './types';
import { PROVIDERS } from './registry';

/**
 * Generic AI facade. Callers shouldn't care which provider they're talking to
 * — they describe `{ provider, apiKey, model, messages }` and get back a
 * normalised `AIResponse`. Provider-specific quirks (Gemini's `systemInstruction`,
 * Cerebras' `response_format`, etc.) are absorbed by the adapters.
 */
export class AIService {
  static listProviders(): AIProviderAdapter[] {
    return Object.values(PROVIDERS);
  }

  static getProvider(id: AIProviderId): AIProviderAdapter {
    return PROVIDERS[id];
  }

  static async listModels(id: AIProviderId, apiKey?: string): Promise<AIModel[]> {
    return PROVIDERS[id].listModels(apiKey);
  }

  static async complete(req: AIRequest): Promise<AIResponse> {
    return PROVIDERS[req.provider].complete(req);
  }

  /**
   * Convenience: ask the AI for JSON and parse the first JSON object out of
   * the response. Throws if no JSON object can be located. Use this for grade
   * predictions, lesson summaries, quizzes, etc.
   */
  static async completeJSON<T = unknown>(req: AIRequest): Promise<T> {
    const res = await this.complete({ ...req, responseFormat: 'json' });
    const match = res.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in AI response');
    return JSON.parse(match[0]) as T;
  }

  /** Read the active provider id from persisted settings. */
  static async getActiveProvider(): Promise<AIProviderId> {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['ai_provider'] });
      const raw = subset?.ai_provider as string | undefined;
      if (raw === 'gemini' || raw === 'cerebras') return raw;
    } catch {
      // best-effort
    }
    return 'gemini';
  }

  /** Read the API key for a given provider from persisted settings. */
  static async getApiKey(provider: AIProviderId): Promise<string | null> {
    try {
      const key = provider === 'cerebras' ? 'cerebras_api_key' : 'gemini_api_key';
      const subset = await invoke<any>('get_settings_subset', { keys: [key] });
      const raw = subset?.[key];
      return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    } catch {
      return null;
    }
  }

  /** Read the persisted model id for the given provider, or the adapter default. */
  static async getModel(provider: AIProviderId): Promise<string> {
    try {
      const key = provider === 'cerebras' ? 'cerebras_model' : 'gemini_model';
      const subset = await invoke<any>('get_settings_subset', { keys: [key] });
      const raw = subset?.[key];
      if (typeof raw === 'string' && raw.trim()) return raw.trim();
    } catch {
      // best-effort
    }
    const adapter = PROVIDERS[provider];
    return adapter.defaultModels.find((m) => m.recommended)?.id ?? adapter.defaultModels[0].id;
  }
}

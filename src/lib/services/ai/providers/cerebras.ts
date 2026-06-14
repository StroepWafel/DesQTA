import type { AIModel, AIProviderAdapter, AIRequest, AIResponse } from '../types';

const CEREBRAS_BASE = 'https://api.cerebras.ai/v1';

const DEFAULTS: AIModel[] = [
  { id: 'gpt-oss-120b', label: 'GPT-OSS 120B', recommended: true },
  { id: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
  { id: 'qwen-3-235b-a22b-instruct-2507', label: 'Qwen 3 235B Instruct' },
];

export const cerebrasAdapter: AIProviderAdapter = {
  id: 'cerebras',
  displayName: 'Cerebras',
  apiKeyUrl: 'https://cloud.cerebras.ai/',
  defaultModels: DEFAULTS,

  async listModels(apiKey?: string): Promise<AIModel[]> {
    if (!apiKey) return DEFAULTS;
    try {
      const res = await fetch(`${CEREBRAS_BASE}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'DesQTA/1.0',
        },
      });
      if (!res.ok) return DEFAULTS;
      const data: any = await res.json();
      const arr = Array.isArray(data?.data) ? data.data : [];
      const models: AIModel[] = arr
        .map((m: any) => {
          const id = String(m?.id || '');
          if (!id) return null;
          return { id, label: id } as AIModel;
        })
        .filter((m: AIModel | null): m is AIModel => m !== null);
      const seen = new Set(models.map((m) => m.id));
      for (const d of DEFAULTS) if (!seen.has(d.id)) models.unshift(d);
      return models.length ? models : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  },

  async complete(req: AIRequest): Promise<AIResponse> {
    const body: any = {
      model: req.model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: req.temperature ?? 0.3,
      max_tokens: req.maxTokens ?? 1024,
      top_p: req.topP ?? 0.95,
    };
    if (req.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(`${CEREBRAS_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${req.apiKey}`,
        'User-Agent': 'DesQTA/1.0',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Cerebras API error: ${res.status}${errText ? ` - ${errText.slice(0, 200)}` : ''}`);
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('Invalid response from Cerebras API');
    return {
      text,
      raw: data,
      usage: {
        promptTokens: data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.completion_tokens,
        totalTokens: data?.usage?.total_tokens,
      },
    };
  },
};

import type { AIModel, AIProviderAdapter, AIRequest, AIResponse } from '../types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const DEFAULTS: AIModel[] = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (fast, free tier)', recommended: true },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

function mapMessages(messages: AIRequest['messages']): {
  systemInstruction?: { parts: { text: string }[] };
  contents: Array<{ role: 'user' | 'model'; parts: { text: string }[] }>;
} {
  const systemTexts: string[] = [];
  const contents: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemTexts.push(m.content);
      continue;
    }
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }
  return {
    systemInstruction: systemTexts.length
      ? { parts: [{ text: systemTexts.join('\n\n') }] }
      : undefined,
    contents,
  };
}

export const geminiAdapter: AIProviderAdapter = {
  id: 'gemini',
  displayName: 'Gemini',
  apiKeyUrl: 'https://aistudio.google.com/app/apikey',
  defaultModels: DEFAULTS,

  async listModels(apiKey?: string): Promise<AIModel[]> {
    if (!apiKey) return DEFAULTS;
    try {
      const res = await fetch(`${GEMINI_BASE}/models?key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) return DEFAULTS;
      const data: any = await res.json();
      const arr = Array.isArray(data?.models) ? data.models : [];
      const models: AIModel[] = arr
        .filter((m: any) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m: any) => {
          const id = (m?.name || '').replace(/^models\//, '');
          const label = m?.displayName || id;
          return { id, label };
        })
        .filter((m: AIModel) => !!m.id);
      // Merge in our defaults so recommended models always appear first.
      const seen = new Set(models.map((m) => m.id));
      for (const d of DEFAULTS) if (!seen.has(d.id)) models.unshift(d);
      return models.length ? models : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  },

  async complete(req: AIRequest): Promise<AIResponse> {
    const { systemInstruction, contents } = mapMessages(req.messages);
    const body: any = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.3,
        topK: 40,
        topP: req.topP ?? 0.95,
        maxOutputTokens: req.maxTokens ?? 1024,
        ...(req.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
      },
    };
    if (systemInstruction) body.systemInstruction = systemInstruction;

    const res = await fetch(
      `${GEMINI_BASE}/models/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(req.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API error: ${res.status}${errText ? ` - ${errText.slice(0, 200)}` : ''}`);
    }
    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) throw new Error('Invalid response from Gemini API');
    return {
      text,
      raw: data,
      usage: {
        promptTokens: data?.usageMetadata?.promptTokenCount,
        completionTokens: data?.usageMetadata?.candidatesTokenCount,
        totalTokens: data?.usageMetadata?.totalTokenCount,
      },
    };
  },
};

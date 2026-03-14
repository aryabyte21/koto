import type { Provider, TranslationBatch, TranslationResult } from "./base.js";

export class CustomProvider implements Provider {
  name = "custom";
  private baseUrl: string;
  private apiKey: string;

  constructor(config: { baseUrl?: string; apiKey?: string }) {
    this.baseUrl = config.baseUrl ?? "";
    this.apiKey = config.apiKey ?? process.env.CUSTOM_PROVIDER_API_KEY ?? "";
  }

  async translate(batch: TranslationBatch): Promise<TranslationResult> {
    if (!this.baseUrl) {
      throw new Error("Custom provider requires a baseUrl in config.");
    }

    const strings = Array.from(batch.strings.entries()).map(([key, value]) => ({
      key,
      value,
    }));

    const start = performance.now();

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        strings,
        sourceLocale: batch.sourceLocale,
        targetLocale: batch.targetLocale,
        systemPrompt: batch.systemPrompt,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Custom provider error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      translations: { key: string; value: string }[];
      usage?: { inputTokens: number; outputTokens: number };
    };

    const latencyMs = performance.now() - start;
    const translations = new Map<string, string>();
    for (const t of data.translations) {
      translations.set(t.key, t.value);
    }

    return {
      batchId: batch.id,
      translations,
      usage: data.usage,
      latencyMs,
    };
  }

  async validate(): Promise<{ ok: boolean; error?: string }> {
    if (!this.baseUrl) {
      return { ok: false, error: "Missing baseUrl. Set baseUrl in provider config." };
    }
    try {
      const response = await fetch(this.baseUrl, {
        method: "GET",
        headers: {
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
      });
      if (!response.ok) {
        const body = await response.text();
        return { ok: false, error: `Health check returned ${response.status}: ${body}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Connection failed: ${(err as Error).message}` };
    }
  }

  estimateCost(_inputTokens: number, _outputTokens: number): number {
    // Custom provider cost is unknown; return 0
    return 0;
  }
}

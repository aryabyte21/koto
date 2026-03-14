import type { Provider, TranslationBatch, TranslationResult } from "./base.js";
import { parseNumberedResponse, formatUserMessage } from "./parse.js";

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.15, output: 0.6 },
};

export class GoogleProvider implements Provider {
  name = "google";
  private model: string;
  private apiKey: string;

  constructor(config: { model?: string; apiKey?: string }) {
    this.model = config.model ?? "gemini-2.5-flash";
    this.apiKey = config.apiKey ?? process.env.GOOGLE_API_KEY ?? "";
  }

  private get endpoint(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
  }

  async translate(batch: TranslationBatch): Promise<TranslationResult> {
    const keys = Array.from(batch.strings.keys());
    const userMessage = formatUserMessage(batch.strings);
    const start = performance.now();

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: batch.systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google API error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      candidates?: { content: { parts: { text: string }[] } }[];
      usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
      };
    };

    const latencyMs = performance.now() - start;
    const content =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const translations = parseNumberedResponse(content, keys);

    return {
      batchId: batch.id,
      translations,
      usage: data.usageMetadata
        ? {
            inputTokens: data.usageMetadata.promptTokenCount,
            outputTokens: data.usageMetadata.candidatesTokenCount,
          }
        : undefined,
      latencyMs,
    };
  }

  async validate(): Promise<{ ok: boolean; error?: string }> {
    if (!this.apiKey) {
      return {
        ok: false,
        error: "Missing API key. Set GOOGLE_API_KEY or pass apiKey in config.",
      };
    }
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "hi" }],
            },
          ],
          generationConfig: { maxOutputTokens: 1 },
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        return { ok: false, error: `API returned ${response.status}: ${body}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Connection failed: ${(err as Error).message}` };
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    const rates =
      COST_PER_MILLION[this.model] ?? COST_PER_MILLION["gemini-2.5-flash"];
    return (
      (inputTokens / 1_000_000) * rates.input +
      (outputTokens / 1_000_000) * rates.output
    );
  }
}

import type { Provider, TranslationBatch, TranslationResult } from "./base.js";
import { parseNumberedResponse, formatUserMessage } from "./parse.js";

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
};

export class AnthropicProvider implements Provider {
  name = "anthropic";
  private model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { model?: string; apiKey?: string; baseUrl?: string }) {
    this.model = config.model ?? "claude-sonnet-4-20250514";
    this.apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com";
  }

  async translate(batch: TranslationBatch): Promise<TranslationResult> {
    const keys = Array.from(batch.strings.keys());
    const userMessage = formatUserMessage(batch.strings);
    const start = performance.now();

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: batch.systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
      usage?: { input_tokens: number; output_tokens: number };
    };

    const latencyMs = performance.now() - start;
    const content =
      data.content.find((c) => c.type === "text")?.text ?? "";
    const translations = parseNumberedResponse(content, keys);

    return {
      batchId: batch.id,
      translations,
      usage: data.usage
        ? {
            inputTokens: data.usage.input_tokens,
            outputTokens: data.usage.output_tokens,
          }
        : undefined,
      latencyMs,
    };
  }

  async validate(): Promise<{ ok: boolean; error?: string }> {
    if (!this.apiKey) {
      return {
        ok: false,
        error: "Missing API key. Set ANTHROPIC_API_KEY or pass apiKey in config.",
      };
    }
    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
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
      COST_PER_MILLION[this.model] ??
      COST_PER_MILLION["claude-sonnet-4-20250514"];
    return (
      (inputTokens / 1_000_000) * rates.input +
      (outputTokens / 1_000_000) * rates.output
    );
  }
}

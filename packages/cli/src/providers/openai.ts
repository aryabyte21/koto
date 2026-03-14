import type { Provider, TranslationBatch, TranslationResult } from "./base.js";
import { parseNumberedResponse, formatUserMessage } from "./parse.js";

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
};

export class OpenAIProvider implements Provider {
  name = "openai";
  private model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { model?: string; apiKey?: string; baseUrl?: string }) {
    this.model = config.model ?? "gpt-4o-mini";
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseUrl = config.baseUrl ?? "https://api.openai.com";
  }

  async translate(batch: TranslationBatch): Promise<TranslationResult> {
    const keys = Array.from(batch.strings.keys());
    const userMessage = formatUserMessage(batch.strings);
    const start = performance.now();

    const response = await fetch(
      `${this.baseUrl}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: batch.systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.3,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const latencyMs = performance.now() - start;
    const content = data.choices[0]?.message?.content ?? "";
    const translations = parseNumberedResponse(content, keys);

    return {
      batchId: batch.id,
      translations,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          }
        : undefined,
      latencyMs,
    };
  }

  async validate(): Promise<{ ok: boolean; error?: string }> {
    if (!this.apiKey) {
      return { ok: false, error: "Missing API key. Set OPENAI_API_KEY or pass apiKey in config." };
    }
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
          }),
        },
      );
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
    const rates = COST_PER_MILLION[this.model] ?? COST_PER_MILLION["gpt-4o-mini"];
    return (
      (inputTokens / 1_000_000) * rates.input +
      (outputTokens / 1_000_000) * rates.output
    );
  }
}

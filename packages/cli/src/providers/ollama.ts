import type { Provider, TranslationBatch, TranslationResult } from "./base.js";

function formatUserMessage(strings: Map<string, string>): string {
  const entries = Array.from(strings.values());
  return entries.map((v, i) => `${i + 1}. ${v}`).join("\n");
}

function parseNumberedResponse(
  text: string,
  keys: string[],
): Map<string, string> {
  const result = new Map<string, string>();
  const lines = text.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    const match = line.match(/^(\d+)\.\s*(.+)$/);
    if (match) {
      const index = parseInt(match[1], 10) - 1;
      if (index >= 0 && index < keys.length) {
        result.set(keys[index], match[2].trim());
      }
    }
  }
  return result;
}

export class OllamaProvider implements Provider {
  name = "ollama";
  private model: string;
  private baseUrl: string;

  constructor(config: { model?: string; baseUrl?: string }) {
    this.model = config.model ?? "llama3.1";
    this.baseUrl = config.baseUrl ?? "http://localhost:11434";
  }

  async translate(batch: TranslationBatch): Promise<TranslationResult> {
    const keys = Array.from(batch.strings.keys());
    const userMessage = formatUserMessage(batch.strings);
    const start = performance.now();

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [
          { role: "system", content: batch.systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      message?: { content: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const latencyMs = performance.now() - start;
    const content = data.message?.content ?? "";
    const translations = parseNumberedResponse(content, keys);

    return {
      batchId: batch.id,
      translations,
      usage:
        data.prompt_eval_count != null && data.eval_count != null
          ? {
              inputTokens: data.prompt_eval_count,
              outputTokens: data.eval_count,
            }
          : undefined,
      latencyMs,
    };
  }

  async validate(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return {
          ok: false,
          error: `Ollama returned ${response.status}. Is it running?`,
        };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: `Cannot connect to Ollama at ${this.baseUrl}. Is it running?`,
      };
    }
  }

  estimateCost(): number {
    return 0;
  }
}

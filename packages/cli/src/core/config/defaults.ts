import type { ResolvedConfig } from "./schema.js";

export const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.5-flash",
  ollama: "llama3.1",
};

export const defaults = {
  sourceLocale: "en",
  contexts: {
    default: {},
  },
  typegen: {
    enabled: false,
  },
  quality: {
    enabled: true,
    minScore: 0.7,
  },
  batch: {
    size: 50,
    concurrency: 3,
  },
} as const satisfies Partial<ResolvedConfig>;

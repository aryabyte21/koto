export interface TranslationBatch {
  id: string;
  strings: Map<string, string>;
  sourceLocale: string;
  targetLocale: string;
  systemPrompt: string;
}

export interface TranslationResult {
  batchId: string;
  translations: Map<string, string>;
  usage?: { inputTokens: number; outputTokens: number };
  latencyMs: number;
}

export interface Provider {
  name: string;
  translate(batch: TranslationBatch): Promise<TranslationResult>;
  validate(): Promise<{ ok: boolean; error?: string }>;
  estimateCost(inputTokens: number, outputTokens: number): number;
}

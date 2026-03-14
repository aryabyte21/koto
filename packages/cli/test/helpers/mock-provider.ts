import type { Provider, TranslationBatch, TranslationResult } from '../../src/providers/base.js';

export class MockProvider implements Provider {
  name = 'mock';
  translateCalls: TranslationBatch[] = [];
  validateCalls = 0;

  private translationFn: (key: string, value: string, locale: string) => string;

  constructor(
    translationFn?: (key: string, value: string, locale: string) => string,
  ) {
    this.translationFn = translationFn ?? ((_key, value, locale) => `[${locale}] ${value}`);
  }

  async translate(batch: TranslationBatch): Promise<TranslationResult> {
    this.translateCalls.push(batch);
    const translations = new Map<string, string>();

    for (const [key, value] of batch.strings) {
      translations.set(
        key,
        this.translationFn(key, value, batch.targetLocale),
      );
    }

    return {
      batchId: batch.id,
      translations,
      usage: {
        inputTokens: batch.strings.size * 10,
        outputTokens: batch.strings.size * 15,
      },
      latencyMs: 50,
    };
  }

  async validate(): Promise<{ ok: boolean; error?: string }> {
    this.validateCalls++;
    return { ok: true };
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens * 0.15 + outputTokens * 0.6) / 1_000_000;
  }
}

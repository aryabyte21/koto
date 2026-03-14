import type { TranslationBatch } from '../../providers/base.js';

export function createBatches(
  keys: Map<string, string>,
  sourceLocale: string,
  targetLocale: string,
  systemPrompt: string,
  batchSize: number,
): TranslationBatch[] {
  const entries = [...keys.entries()];
  const batches: TranslationBatch[] = [];

  for (let i = 0; i < entries.length; i += batchSize) {
    const chunk = entries.slice(i, i + batchSize);
    const strings = new Map<string, string>();

    for (const [key, value] of chunk) {
      strings.set(key, value);
    }

    batches.push({
      id: `batch-${Math.floor(i / batchSize)}`,
      strings,
      sourceLocale,
      targetLocale,
      systemPrompt,
    });
  }

  return batches;
}

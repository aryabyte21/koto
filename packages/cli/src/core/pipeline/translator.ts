import type { Provider, TranslationBatch, TranslationResult } from '../../providers/base.js';
import { logger } from '../../utils/logger.js';

export interface TranslateOptions {
  concurrency: number;
  onBatchComplete?: (result: TranslationResult) => void;
}

export async function translateBatches(
  provider: Provider,
  batches: TranslationBatch[],
  options: TranslateOptions,
): Promise<TranslationResult[]> {
  const results: TranslationResult[] = [];

  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += options.concurrency) {
    const chunk = batches.slice(i, i + options.concurrency);
    const batchResults = await Promise.all(
      chunk.map(async (batch) => {
        try {
          const result = await provider.translate(batch);
          options.onBatchComplete?.(result);
          return result;
        } catch (err) {
          logger.error(`Batch ${batch.id} failed: ${(err as Error).message}`);
          // Return empty result on failure
          return {
            batchId: batch.id,
            translations: new Map<string, string>(),
            latencyMs: 0,
          } satisfies TranslationResult;
        }
      }),
    );

    results.push(...batchResults);
  }

  return results;
}

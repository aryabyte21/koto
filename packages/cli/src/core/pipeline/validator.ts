import { scoreTranslation } from '../quality/scorer.js';
import type { QualityScore } from '../quality/scorer.js';

export interface ValidationResult {
  key: string;
  locale: string;
  source: string;
  translation: string;
  quality: QualityScore;
}

export function validateTranslations(
  translations: Map<string, string>,
  sourceKeys: Map<string, string>,
  targetLocale: string,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [key, translation] of translations) {
    const source = sourceKeys.get(key);
    if (!source) continue;

    const quality = scoreTranslation(source, translation, targetLocale);
    results.push({ key, locale: targetLocale, source, translation, quality });
  }

  return results;
}

export function getFailedValidations(results: ValidationResult[]): ValidationResult[] {
  return results.filter((r) => !r.quality.passed);
}

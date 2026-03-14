import pc from 'picocolors';
import { loadConfig } from '../core/config/loader.js';
import { runPipeline } from '../core/pipeline/index.js';
import { printIntro } from '../ui/intro.js';
import { TranslationProgress } from '../ui/progress.js';
import { printSummary, printDryRunSummary } from '../ui/summary.js';
import { getLanguageFlag } from '../utils/language.js';
import { VERSION } from '../utils/version.js';

export interface TranslateOptions {
  locale?: string;
  context?: string;
  dryRun?: boolean;
  force?: boolean;
  failOnError?: boolean;
}

export async function translateCommand(
  cwd: string,
  options: TranslateOptions = {},
): Promise<void> {
  printIntro(VERSION);

  const config = await loadConfig(cwd);
  const targetLocales = options.locale
    ? options.locale.split(',').map((l) => l.trim()).filter(Boolean)
    : config.targetLocales;

  if (options.locale) {
    const invalid = targetLocales.filter((l) => !config.targetLocales.includes(l));
    if (invalid.length > 0) {
      throw new Error(
        `Unknown locale(s): ${invalid.join(', ')}. Available: ${config.targetLocales.join(', ')}`,
      );
    }
  }

  // Compute total keys for progress display
  const totalLabel = options.dryRun ? 'Previewing' : 'Translating';
  const localeFlags = targetLocales.map((l) => getLanguageFlag(l)).join(' ');
  console.log(
    `  ${pc.bold(totalLabel)} → ${localeFlags} ${pc.dim(`(${targetLocales.length} locale${targetLocales.length > 1 ? 's' : ''})`)}\n`,
  );

  const progress = new TranslationProgress(targetLocales, 0);
  let runningCacheHits = 0;
  let runningTranslated = 0;
  // Track cumulative totals per locale across multiple source files
  const localeTotals = new Map<string, number>();
  const localeDone = new Map<string, number>();  // completed translations across files
  const localeFileOffset = new Map<string, number>(); // offset before current file started

  const result = await runPipeline(config, cwd, {
    dryRun: options.dryRun,
    force: options.force,
    locales: targetLocales,
    context: options.context,
    callbacks: {
      onFileStart(_file, locale, totalKeys) {
        // Save current done count as offset for this file
        localeFileOffset.set(locale, localeDone.get(locale) ?? 0);
        // Accumulate total
        localeTotals.set(locale, (localeTotals.get(locale) ?? 0) + totalKeys);
        progress.update(locale, localeDone.get(locale) ?? 0, localeTotals.get(locale)!);
      },
      onBatchComplete(_file, locale, translatedInFile, _totalInFile) {
        // translatedInFile is absolute within the current file
        const offset = localeFileOffset.get(locale) ?? 0;
        localeDone.set(locale, offset + translatedInFile);
        progress.update(locale, localeDone.get(locale)!, localeTotals.get(locale)!);
      },
      onLocaleComplete(_locale, stats) {
        runningCacheHits += stats.cached;
        runningTranslated += stats.translated;
        progress.setCacheHits(runningCacheHits);
        progress.setTranslated(runningTranslated);
      },
      onQualityIssue(_key, _locale, _issue) {
        // Collected in result.totalIssues
      },
    },
  });

  if (options.dryRun) {
    printDryRunSummary(result);
  } else {
    printSummary(result);
  }

  if (options.failOnError && result.totalIssues > 0) {
    process.exitCode = 1;
  }
}

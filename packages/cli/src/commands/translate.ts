import pc from 'picocolors';
import { loadConfig } from '../core/config/loader.js';
import { runPipeline } from '../core/pipeline/index.js';
import { printCompact } from '../ui/intro.js';
import { TranslationProgress } from '../ui/progress.js';
import { printSummary, printDryRunSummary } from '../ui/summary.js';
import { getLanguageFlag } from '../utils/language.js';

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
  const version = '0.1.0';
  printCompact(version);

  const config = await loadConfig(cwd);
  const targetLocales = options.locale
    ? options.locale.split(',').map((l) => l.trim())
    : config.targetLocales;

  // Compute total keys for progress display
  const totalLabel = options.dryRun ? 'Previewing' : 'Translating';
  const localeFlags = targetLocales.map((l) => getLanguageFlag(l)).join(' ');
  console.log(
    `  ${pc.bold(totalLabel)} → ${localeFlags} ${pc.dim(`(${targetLocales.length} locale${targetLocales.length > 1 ? 's' : ''})`)}\n`,
  );

  const progress = new TranslationProgress(targetLocales, 0);
  let initialRender = true;

  const result = await runPipeline(config, cwd, {
    dryRun: options.dryRun,
    force: options.force,
    locales: targetLocales,
    context: options.context,
    callbacks: {
      onFileStart(_file, _locale, totalKeys) {
        if (initialRender) {
          for (const l of targetLocales) {
            progress.update(l, 0, totalKeys);
          }
          initialRender = false;
        }
      },
      onBatchComplete(_file, locale, translated, total) {
        progress.update(locale, translated, total);
      },
      onLocaleComplete(locale, stats) {
        progress.update(locale, stats.translated + stats.cached, stats.total);
        progress.setCacheHits(result.totalCached);
        progress.setTranslated(result.totalTranslated);
      },
      onQualityIssue(key, locale, issue) {
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

import pc from 'picocolors';
import type { PipelineResult } from '../core/pipeline/index.js';
import { getLanguageFlag } from '../utils/language.js';
import { formatCost } from '../utils/cost.js';

export function printSummary(result: PipelineResult): void {
  const elapsed = (result.durationMs / 1000).toFixed(1);
  const localeEntries = Object.entries(result.locales);

  console.log('');
  console.log(`  ${pc.green(pc.bold('✓'))} ${pc.bold('Translation complete')}`);
  console.log('');

  // Per-locale breakdown
  for (const [locale, stats] of localeEntries) {
    const flag = getLanguageFlag(locale);
    const status = stats.issues > 0
      ? pc.yellow(`⚠ ${stats.issues} issue${stats.issues > 1 ? 's' : ''}`)
      : pc.green('✓');

    console.log(
      `  ${flag}  ${locale.padEnd(8)} ` +
      `${pc.bold(String(stats.translated))} translated, ` +
      `${pc.dim(String(stats.cached) + ' cached')} ` +
      `${status}`,
    );
  }

  console.log('');

  // Stats line
  const statsLine = [
    `${pc.yellow('⚡')} Cache hits: ${pc.bold(String(result.totalCached))}`,
    `${pc.blue('🔤')} Translated: ${pc.bold(String(result.totalTranslated))}`,
    `${pc.dim('⏱')}  ${elapsed}s`,
  ];
  console.log(`  ${statsLine.join(` ${pc.dim('│')} `)}`);

  // Cost
  if (result.costUsd > 0) {
    console.log(`  ${pc.green('💰')} Estimated cost: ${pc.bold(formatCost(result.costUsd))}`);
  }

  // Quality issues
  if (result.totalIssues > 0) {
    console.log('');
    console.log(`  ${pc.yellow('⚠')}  ${result.totalIssues} quality issue${result.totalIssues > 1 ? 's' : ''} found. Run ${pc.cyan('koto diff')} to review.`);
  }

  // Files updated
  const fileCount = localeEntries.length;
  console.log('');
  console.log(`  ${pc.dim(`${fileCount} locale file${fileCount > 1 ? 's' : ''} updated.`)}`);

  if (result.totalTranslated > 0) {
    console.log(`  ${pc.dim('Run')} ${pc.cyan('koto types')} ${pc.dim('to update TypeScript types.')}`);
  }
  console.log('');
}

export function printDryRunSummary(result: PipelineResult): void {
  console.log('');
  console.log(`  ${pc.yellow(pc.bold('⊘'))} ${pc.bold('Dry run')} — no files were modified`);
  console.log('');

  for (const [locale, stats] of Object.entries(result.locales)) {
    const flag = getLanguageFlag(locale);
    console.log(
      `  ${flag}  ${locale.padEnd(8)} ${pc.bold(String(stats.translated))} keys to translate`,
    );
  }

  console.log('');
  console.log(`  ${pc.dim('Run without')} ${pc.cyan('--dry-run')} ${pc.dim('to translate.')}`);
  console.log('');
}

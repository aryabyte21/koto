import pc from 'picocolors';
import { getLanguageFlag, getLanguageName } from '../utils/language.js';
import { formatCost } from '../utils/cost.js';

const BAR_WIDTH = 32;

interface LocaleProgress {
  locale: string;
  translated: number;
  total: number;
  done: boolean;
}

export class TranslationProgress {
  private locales: Map<string, LocaleProgress> = new Map();
  private startTime: number;
  private cacheHits = 0;
  private totalTranslated = 0;
  private costUsd = 0;
  private lineCount = 0;

  constructor(targetLocales: string[], totalKeysPerLocale: number) {
    this.startTime = Date.now();
    for (const locale of targetLocales) {
      this.locales.set(locale, {
        locale,
        translated: 0,
        total: totalKeysPerLocale,
        done: false,
      });
    }
  }

  update(locale: string, translated: number, total: number): void {
    const progress = this.locales.get(locale);
    if (progress) {
      progress.translated = translated;
      progress.total = total;
      progress.done = translated >= total;
    }
    this.render();
  }

  setCacheHits(hits: number): void {
    this.cacheHits = hits;
  }

  setTranslated(count: number): void {
    this.totalTranslated = count;
  }

  setCost(usd: number): void {
    this.costUsd = usd;
  }

  render(): void {
    const isTTY = process.stdout.isTTY;

    // Move cursor up to overwrite previous render (TTY only)
    if (this.lineCount > 0 && isTTY) {
      process.stdout.write(`\x1b[${this.lineCount}A`);
    }

    // In non-TTY mode, only render when all locales are done to avoid spam
    if (!isTTY && ![...this.locales.values()].every((l) => l.done || l.total === 0)) {
      return;
    }

    const lines: string[] = [];

    for (const progress of this.locales.values()) {
      const flag = getLanguageFlag(progress.locale);
      const name = getLanguageName(progress.locale);
      const label = `${flag}  ${progress.locale.padEnd(6)}`;

      const ratio = progress.total > 0 ? progress.translated / progress.total : 0;
      const filled = Math.round(ratio * BAR_WIDTH);
      const empty = BAR_WIDTH - filled;

      const bar = progress.done
        ? pc.green('█'.repeat(BAR_WIDTH))
        : pc.cyan('█'.repeat(filled)) + pc.dim('░'.repeat(empty));

      const count = `${progress.translated}/${progress.total}`;
      const status = progress.done ? pc.green(' ✓') : '';

      lines.push(`  ${label} ${bar} ${pc.dim(count)}${status}`);
    }

    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);

    lines.push('');
    lines.push(
      `  ${pc.yellow('⚡')} Cache: ${pc.bold(String(this.cacheHits))} ` +
      `${pc.dim('│')} ${pc.blue('🔤')} Translated: ${pc.bold(String(this.totalTranslated))} ` +
      `${pc.dim('│')} ${pc.dim('⏱')}  ${elapsed}s`,
    );

    if (this.costUsd > 0) {
      lines.push(`  ${pc.green('💰')} Estimated cost: ${pc.bold(formatCost(this.costUsd))}`);
    }

    const output = lines.join('\n') + '\n';
    process.stdout.write(output);
    this.lineCount = lines.length;
  }
}

export function renderProgressBar(current: number, total: number, width: number = BAR_WIDTH): string {
  const ratio = total > 0 ? current / total : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  if (current >= total) {
    return pc.green('█'.repeat(width));
  }
  return pc.cyan('█'.repeat(filled)) + pc.dim('░'.repeat(empty));
}

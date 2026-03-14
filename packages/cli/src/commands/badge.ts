import pc from 'picocolors';
import { readLockfile, type Lockfile } from '../core/cache/lockfile.js';
import { loadConfig } from '../core/config/loader.js';
import { printCompact } from '../ui/intro.js';
import { getLanguageFlag } from '../utils/language.js';

export interface LocaleCoverage {
  locale: string;
  translated: number;
  total: number;
  percentage: number;
}

export interface CoverageReport {
  locales: LocaleCoverage[];
  totalKeys: number;
  overallPercentage: number;
}

export function computeCoverage(
  lockfile: Lockfile,
  targetLocales: string[],
): CoverageReport {
  const entries = lockfile.entries;

  let totalKeys = 0;
  const localeTranslated = new Map<string, number>();

  for (const locale of targetLocales) {
    localeTranslated.set(locale, 0);
  }

  for (const [_file, keys] of Object.entries(entries)) {
    for (const [_key, entry] of Object.entries(keys)) {
      totalKeys++;
      for (const locale of targetLocales) {
        if (entry.translations[locale]) {
          localeTranslated.set(locale, (localeTranslated.get(locale) ?? 0) + 1);
        }
      }
    }
  }

  const locales: LocaleCoverage[] = targetLocales.map((locale) => {
    const translated = localeTranslated.get(locale) ?? 0;
    const percentage = totalKeys > 0 ? Math.round((translated / totalKeys) * 100) : 0;
    return { locale, translated, total: totalKeys, percentage };
  });

  const totalTranslated = locales.reduce((sum, l) => sum + l.translated, 0);
  const totalPossible = totalKeys * targetLocales.length;
  const overallPercentage =
    totalPossible > 0 ? Math.round((totalTranslated / totalPossible) * 100) : 0;

  return { locales, totalKeys, overallPercentage };
}

export function generateBadgeUrl(percentage: number, localeCount: number): string {
  const label = `i18n-${percentage}%25_·_${localeCount}_languages_🌍-blue`;
  return `https://img.shields.io/badge/${label}`;
}

export function generateBadgeMarkdown(percentage: number, localeCount: number): string {
  const url = generateBadgeUrl(percentage, localeCount);
  return `![i18n](${url})`;
}

export async function badgeCommand(cwd: string): Promise<void> {
  printCompact('0.1.0');

  const config = await loadConfig(cwd);
  const lockfile = await readLockfile(cwd);
  const report = computeCoverage(lockfile, config.targetLocales);

  console.log(`  ${pc.bold('i18n Coverage Report')}\n`);

  for (const lc of report.locales) {
    const flag = getLanguageFlag(lc.locale);
    const pctStr = `${lc.percentage}%`;
    const color = lc.percentage === 100 ? pc.green(pctStr) : lc.percentage >= 80 ? pc.yellow(pctStr) : pc.red(pctStr);
    console.log(
      `  ${flag}  ${lc.locale.padEnd(8)} ${String(lc.translated).padStart(4)}/${lc.total} keys (${color})`,
    );
  }

  console.log(
    `\n  ${pc.bold('Overall:')} ${report.overallPercentage}% across ${report.locales.length} locales\n`,
  );

  const markdown = generateBadgeMarkdown(report.overallPercentage, report.locales.length);
  console.log(`  ${pc.bold('Add to your README:')}\n`);
  console.log(`  ${pc.cyan(markdown)}\n`);
}

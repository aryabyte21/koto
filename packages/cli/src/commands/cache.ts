import pc from 'picocolors';
import { readLockfile, writeLockfile } from '../core/cache/lockfile.js';
import { printCompact } from '../ui/intro.js';
import { getLanguageFlag } from '../utils/language.js';

export async function cacheStatsCommand(cwd: string): Promise<void> {
  printCompact('0.1.0');

  const lockfile = await readLockfile(cwd);
  const entries = lockfile.entries;

  let totalKeys = 0;
  const localeStats = new Map<string, number>();

  for (const [_file, keys] of Object.entries(entries)) {
    for (const [_key, entry] of Object.entries(keys)) {
      totalKeys++;
      for (const locale of Object.keys(entry.translations)) {
        localeStats.set(locale, (localeStats.get(locale) ?? 0) + 1);
      }
    }
  }

  const fileCount = Object.keys(entries).length;

  console.log(`  ${pc.bold('Cache statistics')}`);
  console.log(pc.dim('  ' + '─'.repeat(40)));
  console.log(`  Files tracked:    ${pc.bold(String(fileCount))}`);
  console.log(`  Source keys:      ${pc.bold(String(totalKeys))}`);
  console.log('');

  if (localeStats.size > 0) {
    console.log(`  ${pc.bold('Translations per locale:')}`);
    const sortedLocales = [...localeStats.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [locale, count] of sortedLocales) {
      const flag = getLanguageFlag(locale);
      const pct = totalKeys > 0 ? Math.round((count / totalKeys) * 100) : 0;
      console.log(`  ${flag}  ${locale.padEnd(8)} ${String(count).padStart(5)} keys (${pct}%)`);
    }
  } else {
    console.log(pc.dim('  No translations cached yet.'));
  }

  console.log('');
}

export async function cacheClearCommand(cwd: string): Promise<void> {
  printCompact('0.1.0');

  await writeLockfile(cwd, { version: 1, entries: {} });
  console.log(`  ${pc.green('✓')} Cache cleared.\n`);
}

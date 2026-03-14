import { loadConfig } from '../core/config/loader.js';
import { readLockfile, writeLockfile, diffLockfile, seedLockfileFromExisting } from '../core/cache/lockfile.js';
import { getFormat } from '../formats/registry.js';
import { readFile } from '../utils/fs.js';
import { printIntro } from '../ui/intro.js';
import { printDiff, printDiffJson } from '../ui/diff-view.js';
import type { LocaleDiff, DiffEntry } from '../ui/diff-view.js';
import { logger } from '../utils/logger.js';
import path from 'node:path';
import { VERSION } from '../utils/version.js';

export interface DiffOptions {
  json?: boolean;
  locale?: string;
}

export async function diffCommand(cwd: string, options: DiffOptions = {}): Promise<void> {
  if (!options.json) {
    printIntro(VERSION);
  }

  const config = await loadConfig(cwd);
  const lockfile = await readLockfile(cwd);

  // Seed lockfile from existing translations on first run
  const isEmptyLockfile = Object.keys(lockfile.entries).length === 0;
  if (isEmptyLockfile) {
    let totalSeeded = 0;
    for (const pattern of config.files) {
      const sourcePath = pattern.replace('[locale]', config.sourceLocale);
      const absSource = path.resolve(cwd, sourcePath);
      try {
        const sourceContent = await readFile(absSource);
        const format = getFormat(sourcePath);
        const sourceKeys = format.parse(sourceContent).keys;
        for (const locale of config.targetLocales) {
          const targetPath = pattern.replace('[locale]', locale);
          const absTarget = path.resolve(cwd, targetPath);
          try {
            const targetContent = await readFile(absTarget);
            const targetKeys = format.parse(targetContent).keys;
            totalSeeded += seedLockfileFromExisting(lockfile, pattern, sourceKeys, targetKeys, locale);
          } catch { /* target doesn't exist */ }
        }
      } catch { /* source doesn't exist */ }
    }
    if (totalSeeded > 0) {
      logger.info(`Found ${totalSeeded} existing translations — added to lockfile.`);
      await writeLockfile(cwd, lockfile);
    }
  }

  const diffs: LocaleDiff[] = [];
  const requestedLocales = options.locale
    ? options.locale.split(',').map((locale) => locale.trim()).filter(Boolean)
    : config.targetLocales;
  const invalidLocales = requestedLocales.filter((locale) => !config.targetLocales.includes(locale));
  if (invalidLocales.length > 0) {
    throw new Error(
      `Unknown locale(s) for diff: ${invalidLocales.join(', ')}. Available target locales: ${config.targetLocales.join(', ')}`,
    );
  }

  for (const locale of requestedLocales) {
    const entries: DiffEntry[] = [];

    for (const pattern of config.files) {
      const sourcePath = pattern.replace('[locale]', config.sourceLocale);
      const absolutePath = path.resolve(cwd, sourcePath);

      let content: string;
      try {
        content = await readFile(absolutePath);
      } catch {
        continue;
      }

      const format = getFormat(sourcePath);
      const parsed = format.parse(content);
      const diff = diffLockfile(lockfile, pattern, parsed.keys, [locale]);

      for (const key of diff.added) {
        entries.push({
          key,
          type: 'added',
          sourceValue: parsed.keys.get(key),
        });
      }

      for (const key of diff.changed) {
        entries.push({
          key,
          type: 'changed',
          sourceValue: parsed.keys.get(key),
        });
      }

      for (const key of diff.removed) {
        entries.push({ key, type: 'removed' });
      }
    }

    if (entries.length > 0) {
      diffs.push({ locale, entries });
    }
  }

  if (options.json) {
    printDiffJson(diffs);
  } else {
    printDiff(diffs);
  }
}

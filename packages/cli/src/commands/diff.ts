import { loadConfig } from '../core/config/loader.js';
import { readLockfile, diffLockfile } from '../core/cache/lockfile.js';
import { getFormat } from '../formats/registry.js';
import { readFile } from '../utils/fs.js';
import { printCompact } from '../ui/intro.js';
import { printDiff, printDiffJson } from '../ui/diff-view.js';
import type { LocaleDiff, DiffEntry } from '../ui/diff-view.js';
import path from 'node:path';

export interface DiffOptions {
  json?: boolean;
}

export async function diffCommand(cwd: string, options: DiffOptions = {}): Promise<void> {
  if (!options.json) {
    printCompact('0.1.0');
  }

  const config = await loadConfig(cwd);
  const lockfile = await readLockfile(cwd);
  const diffs: LocaleDiff[] = [];

  for (const locale of config.targetLocales) {
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

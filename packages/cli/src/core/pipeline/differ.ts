import { hashString } from '../cache/hasher.js';
import type { Lockfile } from '../cache/lockfile.js';

export interface KeyDiff {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
}

export function diffKeys(
  lockfile: Lockfile,
  filePath: string,
  currentKeys: Map<string, string>,
  targetLocale: string,
): KeyDiff {
  const fileEntries = lockfile.entries[filePath] ?? {};
  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const [key, value] of currentKeys) {
    const entry = fileEntries[key];

    if (!entry) {
      added.push(key);
      continue;
    }

    const currentHash = hashString(value);
    if (currentHash !== entry.hash) {
      changed.push(key);
      continue;
    }

    if (!entry.translations[targetLocale]) {
      added.push(key);
      continue;
    }

    unchanged.push(key);
  }

  const currentKeySet = new Set(currentKeys.keys());
  const removed = Object.keys(fileEntries).filter((k) => !currentKeySet.has(k));

  return { added, changed, removed, unchanged };
}

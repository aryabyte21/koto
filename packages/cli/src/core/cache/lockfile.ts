import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { hashString } from "./hasher.js";

export interface LockfileTranslation {
  hash: string;
  at: string;
}

export interface LockfileEntry {
  hash: string;
  translations: Record<string, LockfileTranslation>;
}

export interface Lockfile {
  version: 1;
  entries: Record<string, Record<string, LockfileEntry>>;
}

export interface LocaleDiff {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
}

export interface DiffResult extends LocaleDiff {
  byLocale: Record<string, LocaleDiff>;
}

const LOCKFILE_NAME = "koto.lock";

/**
 * Heuristic: does this value look like something that shouldn't be translated?
 * Only matches clearly non-translatable content — conservative to avoid skipping real translations.
 */
function looksLikeUntranslatableValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  // Very short (1-2 chars like ":", "-", "x")
  if (trimmed.length <= 2) return true;
  // All uppercase (acronyms: "COPPA", "VPC", "API")
  if (/^[A-Z][A-Z0-9_\s.-]*$/.test(trimmed) && trimmed.length <= 10) return true;
  // URL or email
  if (/^https?:\/\//.test(trimmed) || /^\S+@\S+\.\S+$/.test(trimmed)) return true;
  // Pure number or version-like ("0", "1.0", "2007 SP1")
  if (/^[\d.,\s]+$/.test(trimmed)) return true;
  // camelCase or snake_case identifier (not a human-readable word)
  if (/^[a-z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)+$/.test(trimmed)) return true;
  if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(trimmed)) return true;
  return false;
}

function emptyLockfile(): Lockfile {
  return { version: 1, entries: {} };
}

/**
 * Seed a lockfile from existing translations on disk.
 * For each source key that already has a translation in the target file,
 * mark it as translated in the lockfile so it won't be re-translated.
 */
export function seedLockfileFromExisting(
  lockfile: Lockfile,
  filePath: string,
  sourceKeys: Map<string, string>,
  targetKeys: Map<string, string>,
  locale: string,
): number {
  let seeded = 0;

  if (!lockfile.entries[filePath]) {
    lockfile.entries[filePath] = {};
  }

  for (const [key, sourceValue] of sourceKeys) {
    const targetValue = targetKeys.get(key);
    if (!targetValue) continue;

    // Treat as "already handled" if:
    // 1. Translation differs from source (genuinely translated), OR
    // 2. Value is identical but looks intentional (brand names, short tokens, numbers, URLs)
    const isTranslated = targetValue !== sourceValue;
    const isIntentionallyIdentical = targetValue === sourceValue && looksLikeUntranslatableValue(sourceValue);

    if (isTranslated || isIntentionallyIdentical) {
      if (!lockfile.entries[filePath][key]) {
        lockfile.entries[filePath][key] = {
          hash: hashString(sourceValue),
          translations: {},
        };
      }
      if (!lockfile.entries[filePath][key].translations[locale]) {
        lockfile.entries[filePath][key].translations[locale] = {
          hash: hashString(targetValue),
          at: new Date().toISOString(),
        };
        seeded++;
      }
    }
  }

  return seeded;
}

export async function readLockfile(cwd: string): Promise<Lockfile> {
  const filepath = join(cwd, LOCKFILE_NAME);
  try {
    const raw = await readFile(filepath, "utf8");
    const parsed = JSON.parse(raw) as Lockfile;
    if (parsed.version !== 1) {
      return emptyLockfile();
    }
    return parsed;
  } catch {
    return emptyLockfile();
  }
}

export async function writeLockfile(
  cwd: string,
  lockfile: Lockfile,
): Promise<void> {
  const filepath = join(cwd, LOCKFILE_NAME);
  const tmpPath = filepath + ".tmp";
  const content = JSON.stringify(lockfile, null, 2) + "\n";
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, filepath);
}

export function diffLockfile(
  lockfile: Lockfile,
  filePath: string,
  keys: Map<string, string>,
  targetLocales: string[],
  targetKeys?: Map<string, Map<string, string>>,
): DiffResult {
  const fileEntries = lockfile.entries[filePath] ?? {};
  const byLocale: Record<string, LocaleDiff> = {};

  for (const locale of targetLocales) {
    const added: string[] = [];
    const changed: string[] = [];
    const unchanged: string[] = [];
    const localeTargetKeys = targetKeys?.get(locale);

    for (const [key, value] of keys) {
      const entry = fileEntries[key];
      const currentHash = hashString(value);

      if (!entry) {
        added.push(key);
        continue;
      }

      if (entry.hash !== currentHash) {
        changed.push(key);
        continue;
      }

      if (!entry.translations[locale]) {
        added.push(key);
        continue;
      }

      // Lockfile says translated, but verify the key actually exists in the target file
      if (localeTargetKeys && !localeTargetKeys.has(key)) {
        added.push(key);
        continue;
      }

      unchanged.push(key);
    }

    const removed: string[] = [];
    for (const key of Object.keys(fileEntries)) {
      if (!keys.has(key)) {
        removed.push(key);
      }
    }

    byLocale[locale] = { added, changed, removed, unchanged };
  }

  const first = byLocale[targetLocales[0]] ?? { added: [], changed: [], removed: [], unchanged: [] };
  return { ...first, byLocale };
}

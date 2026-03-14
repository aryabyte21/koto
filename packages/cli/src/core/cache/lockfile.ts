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

function emptyLockfile(): Lockfile {
  return { version: 1, entries: {} };
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
): DiffResult {
  const fileEntries = lockfile.entries[filePath] ?? {};
  const byLocale: Record<string, LocaleDiff> = {};

  for (const locale of targetLocales) {
    const added: string[] = [];
    const changed: string[] = [];
    const unchanged: string[] = [];

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

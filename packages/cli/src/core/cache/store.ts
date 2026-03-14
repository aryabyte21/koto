import { readLockfile } from "./lockfile.js";

export class TranslationCache {
  private cache = new Map<string, string>();
  private _hits = 0;
  private _misses = 0;

  private cacheKey(sourceHash: string, targetLocale: string): string {
    return `${sourceHash}:${targetLocale}`;
  }

  get(sourceHash: string, targetLocale: string): string | null {
    const key = this.cacheKey(sourceHash, targetLocale);
    const value = this.cache.get(key);
    if (value !== undefined) {
      this._hits++;
      return value;
    }
    this._misses++;
    return null;
  }

  set(sourceHash: string, targetLocale: string, translation: string): void {
    const key = this.cacheKey(sourceHash, targetLocale);
    this.cache.set(key, translation);
  }

  async load(cwd: string): Promise<void> {
    const lockfile = await readLockfile(cwd);

    for (const fileEntries of Object.values(lockfile.entries)) {
      for (const entry of Object.values(fileEntries)) {
        for (const [locale, translation] of Object.entries(
          entry.translations,
        )) {
          this.cache.set(`${entry.hash}:${locale}`, translation.hash);
        }
      }
    }
  }

  stats(): { hits: number; misses: number; size: number } {
    return {
      hits: this._hits,
      misses: this._misses,
      size: this.cache.size,
    };
  }
}

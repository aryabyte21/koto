import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { jsonNestedFormat } from '../../src/formats/json-nested.js';
import { hashString } from '../../src/core/cache/hasher.js';
import {
  readLockfile,
  writeLockfile,
  diffLockfile,
  type Lockfile,
  type LockfileEntry,
} from '../../src/core/cache/lockfile.js';
import { MockProvider } from '../helpers/mock-provider.js';
import { shield, restore } from '../../src/core/placeholders/shield.js';
import { DEFAULT_PATTERNS } from '../../src/core/placeholders/patterns.js';

const FILE_PATTERN = 'locales/[locale].json';

describe('lockfile incremental translation', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'koto-incremental-'));
    await mkdir(path.join(tmpDir, 'locales'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function simulateTranslation(
    keys: Map<string, string>,
    lockfile: Lockfile,
    locale: string,
    provider: MockProvider,
  ): Promise<{ translated: Map<string, string>; lockfile: Lockfile; diff: ReturnType<typeof diffLockfile> }> {
    const diff = diffLockfile(lockfile, FILE_PATTERN, keys, [locale]);
    const keysToTranslate = [...diff.added, ...diff.changed];

    if (keysToTranslate.length === 0) {
      return { translated: new Map(), lockfile, diff };
    }

    // Shield
    const shielded = new Map<string, { shielded: string; tokens: Map<string, string> }>();
    for (const key of keysToTranslate) {
      shielded.set(key, shield(keys.get(key)!, DEFAULT_PATTERNS));
    }

    // Translate
    const batch = {
      id: 'batch-0',
      strings: new Map<string, string>(),
      sourceLocale: 'en',
      targetLocale: locale,
      systemPrompt: 'Translate.',
    };
    for (const [key, { shielded: s }] of shielded) {
      batch.strings.set(key, s);
    }
    const result = await provider.translate(batch);

    // Restore and update lockfile
    const translated = new Map<string, string>();
    for (const [key, translatedShielded] of result.translations) {
      const info = shielded.get(key)!;
      const restored = restore(translatedShielded, info.tokens);
      translated.set(key, restored);

      if (!lockfile.entries[FILE_PATTERN]) {
        lockfile.entries[FILE_PATTERN] = {};
      }
      lockfile.entries[FILE_PATTERN][key] = {
        hash: hashString(keys.get(key)!),
        translations: {
          ...lockfile.entries[FILE_PATTERN]?.[key]?.translations,
          [locale]: {
            hash: hashString(restored),
            at: new Date().toISOString(),
          },
        },
      };
    }

    return { translated, lockfile, diff };
  }

  describe('run 1: fresh translation (no lockfile)', () => {
    it('identifies all keys as added when no lockfile exists', async () => {
      const source = { greeting: 'Hello', farewell: 'Goodbye', thanks: 'Thank you' };
      await writeFile(
        path.join(tmpDir, 'locales', 'en.json'),
        JSON.stringify(source, null, 2),
      );

      const lockfile = await readLockfile(tmpDir);
      expect(lockfile.entries).toEqual({});

      const content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      const parsed = jsonNestedFormat.parse(content);

      const diff = diffLockfile(lockfile, FILE_PATTERN, parsed.keys, ['fr']);

      expect(diff.added).toHaveLength(3);
      expect(diff.added).toContain('greeting');
      expect(diff.added).toContain('farewell');
      expect(diff.added).toContain('thanks');
      expect(diff.changed).toHaveLength(0);
      expect(diff.unchanged).toHaveLength(0);
    });

    it('translates all keys and writes lockfile on first run', async () => {
      const source = { greeting: 'Hello', farewell: 'Goodbye' };
      await writeFile(
        path.join(tmpDir, 'locales', 'en.json'),
        JSON.stringify(source, null, 2),
      );

      const content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      const parsed = jsonNestedFormat.parse(content);
      const provider = new MockProvider();
      let lockfile = await readLockfile(tmpDir);

      const { translated, lockfile: updatedLockfile } = await simulateTranslation(
        parsed.keys,
        lockfile,
        'fr',
        provider,
      );

      expect(translated.size).toBe(2);
      expect(translated.get('greeting')).toBe('[fr] Hello');
      expect(translated.get('farewell')).toBe('[fr] Goodbye');

      // Write lockfile
      await writeLockfile(tmpDir, updatedLockfile);

      // Verify lockfile persisted
      const readBack = await readLockfile(tmpDir);
      expect(Object.keys(readBack.entries[FILE_PATTERN])).toHaveLength(2);
      expect(readBack.entries[FILE_PATTERN]['greeting'].hash).toBe(hashString('Hello'));
    });
  });

  describe('run 2: incremental update', () => {
    it('skips unchanged keys and only translates new and changed keys', async () => {
      const provider = new MockProvider();

      // Run 1: initial translation
      const sourceV1 = { greeting: 'Hello', farewell: 'Goodbye' };
      await writeFile(
        path.join(tmpDir, 'locales', 'en.json'),
        JSON.stringify(sourceV1, null, 2),
      );

      let content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      let parsed = jsonNestedFormat.parse(content);
      let lockfile = await readLockfile(tmpDir);

      const run1 = await simulateTranslation(parsed.keys, lockfile, 'fr', provider);
      await writeLockfile(tmpDir, run1.lockfile);

      expect(run1.diff.added).toHaveLength(2);
      expect(provider.translateCalls).toHaveLength(1);

      // Run 2: change one key, add one new key
      const sourceV2 = {
        greeting: 'Hi there',       // changed
        farewell: 'Goodbye',        // unchanged
        newKey: 'Brand new',        // added
      };
      await writeFile(
        path.join(tmpDir, 'locales', 'en.json'),
        JSON.stringify(sourceV2, null, 2),
      );

      content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      parsed = jsonNestedFormat.parse(content);
      lockfile = await readLockfile(tmpDir);

      const run2 = await simulateTranslation(parsed.keys, lockfile, 'fr', provider);

      // Only the changed and new keys should be translated
      expect(run2.diff.changed).toEqual(['greeting']);
      expect(run2.diff.added).toEqual(['newKey']);
      expect(run2.diff.unchanged).toEqual(['farewell']);

      // Provider should have been called once more (batch with 2 keys)
      expect(provider.translateCalls).toHaveLength(2);
      const lastBatch = provider.translateCalls[1];
      expect(lastBatch.strings.size).toBe(2);
      expect(lastBatch.strings.has('greeting')).toBe(true);
      expect(lastBatch.strings.has('newKey')).toBe(true);
      expect(lastBatch.strings.has('farewell')).toBe(false);
    });

    it('detects no changes when source is identical', async () => {
      const provider = new MockProvider();

      const source = { greeting: 'Hello' };
      await writeFile(
        path.join(tmpDir, 'locales', 'en.json'),
        JSON.stringify(source, null, 2),
      );

      let content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      let parsed = jsonNestedFormat.parse(content);
      let lockfile = await readLockfile(tmpDir);

      const run1 = await simulateTranslation(parsed.keys, lockfile, 'fr', provider);
      await writeLockfile(tmpDir, run1.lockfile);

      // Run 2 with identical source
      content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      parsed = jsonNestedFormat.parse(content);
      lockfile = await readLockfile(tmpDir);

      const run2 = await simulateTranslation(parsed.keys, lockfile, 'fr', provider);

      expect(run2.diff.added).toHaveLength(0);
      expect(run2.diff.changed).toHaveLength(0);
      expect(run2.diff.unchanged).toEqual(['greeting']);
      expect(run2.translated.size).toBe(0);

      // Provider was only called once (from run 1)
      expect(provider.translateCalls).toHaveLength(1);
    });
  });

  describe('removed keys', () => {
    it('detects keys that were removed from the source', async () => {
      const provider = new MockProvider();

      // Run 1
      const sourceV1 = { greeting: 'Hello', farewell: 'Goodbye', extra: 'Extra' };
      await writeFile(
        path.join(tmpDir, 'locales', 'en.json'),
        JSON.stringify(sourceV1, null, 2),
      );

      let content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      let parsed = jsonNestedFormat.parse(content);
      let lockfile = await readLockfile(tmpDir);

      const run1 = await simulateTranslation(parsed.keys, lockfile, 'fr', provider);
      await writeLockfile(tmpDir, run1.lockfile);

      // Run 2: remove 'extra' key
      const sourceV2 = { greeting: 'Hello', farewell: 'Goodbye' };
      await writeFile(
        path.join(tmpDir, 'locales', 'en.json'),
        JSON.stringify(sourceV2, null, 2),
      );

      content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      parsed = jsonNestedFormat.parse(content);
      lockfile = await readLockfile(tmpDir);

      const diff = diffLockfile(lockfile, FILE_PATTERN, parsed.keys, ['fr']);

      expect(diff.removed).toEqual(['extra']);
      expect(diff.unchanged).toHaveLength(2);
      expect(diff.added).toHaveLength(0);
      expect(diff.changed).toHaveLength(0);
    });
  });

  describe('multi-locale incremental', () => {
    it('treats each locale independently for incremental tracking', async () => {
      const provider = new MockProvider();
      const source = { greeting: 'Hello' };

      await writeFile(
        path.join(tmpDir, 'locales', 'en.json'),
        JSON.stringify(source, null, 2),
      );

      const content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      const parsed = jsonNestedFormat.parse(content);

      // Run 1: translate to French only
      let lockfile = await readLockfile(tmpDir);
      const frRun = await simulateTranslation(parsed.keys, lockfile, 'fr', provider);
      await writeLockfile(tmpDir, frRun.lockfile);

      // Now check diff for French (should be unchanged) and German (should be added)
      lockfile = await readLockfile(tmpDir);

      const frDiff = diffLockfile(lockfile, FILE_PATTERN, parsed.keys, ['fr']);
      expect(frDiff.unchanged).toEqual(['greeting']);
      expect(frDiff.added).toHaveLength(0);

      const deDiff = diffLockfile(lockfile, FILE_PATTERN, parsed.keys, ['de']);
      expect(deDiff.added).toEqual(['greeting']);
      expect(deDiff.unchanged).toHaveLength(0);
    });
  });

  describe('lockfile persistence', () => {
    it('survives write and read cycle with complex entries', async () => {
      const lockfile: Lockfile = {
        version: 1,
        entries: {
          [FILE_PATTERN]: {
            'greeting': {
              hash: hashString('Hello'),
              translations: {
                fr: { hash: hashString('[fr] Hello'), at: '2025-01-01T00:00:00.000Z' },
                de: { hash: hashString('[de] Hello'), at: '2025-01-01T00:00:00.000Z' },
              },
            },
            'nested.key': {
              hash: hashString('Deep value'),
              translations: {
                fr: { hash: hashString('[fr] Deep value'), at: '2025-01-01T00:00:00.000Z' },
              },
            },
          },
        },
      };

      await writeLockfile(tmpDir, lockfile);
      const read = await readLockfile(tmpDir);

      expect(read.version).toBe(1);
      expect(Object.keys(read.entries[FILE_PATTERN])).toHaveLength(2);
      expect(read.entries[FILE_PATTERN]['greeting'].translations.fr.hash).toBe(
        hashString('[fr] Hello'),
      );
      expect(read.entries[FILE_PATTERN]['greeting'].translations.de.hash).toBe(
        hashString('[de] Hello'),
      );
      expect(read.entries[FILE_PATTERN]['nested.key'].translations.fr.hash).toBe(
        hashString('[fr] Deep value'),
      );
    });

    it('returns empty lockfile when file does not exist', async () => {
      const lockfile = await readLockfile(tmpDir);
      expect(lockfile.version).toBe(1);
      expect(lockfile.entries).toEqual({});
    });
  });
});

import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MockProvider } from '../helpers/mock-provider.js';
import { jsonNestedFormat } from '../../src/formats/json-nested.js';
import { resolveContext } from '../../src/core/context/index.js';
import { buildSystemPrompt } from '../../src/core/context/prompt.js';
import { shield, restore } from '../../src/core/placeholders/shield.js';
import { DEFAULT_PATTERNS } from '../../src/core/placeholders/patterns.js';
import { hashString } from '../../src/core/cache/hasher.js';
import {
  readLockfile,
  writeLockfile,
  diffLockfile,
  type Lockfile,
} from '../../src/core/cache/lockfile.js';
import { scoreTranslation } from '../../src/core/quality/scorer.js';
import type { ResolvedConfig } from '../../src/core/config/schema.js';

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    sourceLocale: 'en',
    targetLocales: ['fr', 'de'],
    files: ['locales/[locale].json'],
    provider: { name: 'openai', model: 'gpt-4o-mini' },
    contexts: {},
    typegen: { enabled: false },
    quality: { enabled: true, minScore: 0.7 },
    batch: { size: 50, concurrency: 3 },
    ...overrides,
  };
}

describe('pipeline integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'koto-pipeline-'));
    await mkdir(path.join(tmpDir, 'locales'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('source file extraction', () => {
    it('reads and parses a flat JSON source file', async () => {
      const source = {
        greeting: 'Hello',
        farewell: 'Goodbye',
        nested: { deep: 'Value' },
      };
      await writeFile(
        path.join(tmpDir, 'locales', 'en.json'),
        JSON.stringify(source, null, 2),
      );

      const content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      const parsed = jsonNestedFormat.parse(content);

      expect(parsed.keys.size).toBe(3);
      expect(parsed.keys.get('greeting')).toBe('Hello');
      expect(parsed.keys.get('farewell')).toBe('Goodbye');
      expect(parsed.keys.get('nested.deep')).toBe('Value');
    });

    it('handles empty source file gracefully', async () => {
      await writeFile(path.join(tmpDir, 'locales', 'en.json'), '{}');
      const content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      const parsed = jsonNestedFormat.parse(content);

      expect(parsed.keys.size).toBe(0);
    });
  });

  describe('diffing against lockfile', () => {
    it('marks all keys as added when lockfile is empty', async () => {
      const lockfile: Lockfile = { version: 1, entries: {} };
      const keys = new Map([
        ['greeting', 'Hello'],
        ['farewell', 'Goodbye'],
      ]);

      const diff = diffLockfile(lockfile, 'locales/[locale].json', keys, ['fr']);

      expect(diff.added).toEqual(['greeting', 'farewell']);
      expect(diff.changed).toEqual([]);
      expect(diff.unchanged).toEqual([]);
    });

    it('marks changed keys when source hash differs', () => {
      const lockfile: Lockfile = {
        version: 1,
        entries: {
          'locales/[locale].json': {
            greeting: {
              hash: hashString('Old Hello'),
              translations: { fr: { hash: hashString('[fr] Old Hello'), at: new Date().toISOString() } },
            },
          },
        },
      };
      const keys = new Map([['greeting', 'Hello']]);
      const diff = diffLockfile(lockfile, 'locales/[locale].json', keys, ['fr']);

      expect(diff.changed).toEqual(['greeting']);
      expect(diff.added).toEqual([]);
      expect(diff.unchanged).toEqual([]);
    });

    it('marks keys as unchanged when hash matches and translation exists', () => {
      const lockfile: Lockfile = {
        version: 1,
        entries: {
          'locales/[locale].json': {
            greeting: {
              hash: hashString('Hello'),
              translations: { fr: { hash: hashString('[fr] Hello'), at: new Date().toISOString() } },
            },
          },
        },
      };
      const keys = new Map([['greeting', 'Hello']]);
      const diff = diffLockfile(lockfile, 'locales/[locale].json', keys, ['fr']);

      expect(diff.unchanged).toEqual(['greeting']);
      expect(diff.added).toEqual([]);
      expect(diff.changed).toEqual([]);
    });

    it('detects removed keys', () => {
      const lockfile: Lockfile = {
        version: 1,
        entries: {
          'locales/[locale].json': {
            oldKey: {
              hash: hashString('Old value'),
              translations: { fr: { hash: hashString('[fr] Old value'), at: new Date().toISOString() } },
            },
          },
        },
      };
      const keys = new Map<string, string>();
      const diff = diffLockfile(lockfile, 'locales/[locale].json', keys, ['fr']);

      expect(diff.removed).toEqual(['oldKey']);
    });
  });

  describe('batching', () => {
    it('creates correct batch structure for translation', () => {
      const keys = new Map([
        ['greeting', 'Hello'],
        ['farewell', 'Goodbye'],
        ['thanks', 'Thank you'],
      ]);

      // Shield placeholders (none here, but test the pipeline stage)
      const shielded = new Map<string, { shielded: string; tokens: Map<string, string> }>();
      for (const [key, value] of keys) {
        shielded.set(key, shield(value, DEFAULT_PATTERNS));
      }

      // Verify shielded strings are unchanged when there are no placeholders
      for (const [key, value] of keys) {
        expect(shielded.get(key)!.shielded).toBe(value);
        expect(shielded.get(key)!.tokens.size).toBe(0);
      }
    });

    it('shields placeholders before batching', () => {
      const value = 'Hello {{name}}, you have {count} items';
      const result = shield(value, DEFAULT_PATTERNS);

      expect(result.shielded).not.toContain('{{name}}');
      expect(result.shielded).not.toContain('{count}');
      expect(result.tokens.size).toBe(2);

      // Verify restore brings them back
      const restored = restore(result.shielded, result.tokens);
      expect(restored).toBe(value);
    });
  });

  describe('translation via mock provider', () => {
    it('translates a batch and returns results', async () => {
      const provider = new MockProvider();

      const batch = {
        id: 'batch-0',
        strings: new Map([
          ['greeting', 'Hello'],
          ['farewell', 'Goodbye'],
        ]),
        sourceLocale: 'en',
        targetLocale: 'fr',
        systemPrompt: 'Translate from en to fr.',
      };

      const result = await provider.translate(batch);

      expect(result.translations.size).toBe(2);
      expect(result.translations.get('greeting')).toBe('[fr] Hello');
      expect(result.translations.get('farewell')).toBe('[fr] Goodbye');
      expect(result.usage?.inputTokens).toBe(20);
      expect(result.usage?.outputTokens).toBe(30);
    });
  });

  describe('writing translations', () => {
    it('serializes translations to nested JSON', () => {
      const translations = new Map([
        ['greeting', 'Bonjour'],
        ['nested.deep', 'Valeur'],
      ]);

      const output = jsonNestedFormat.serialize(translations);
      const parsed = JSON.parse(output);

      expect(parsed.greeting).toBe('Bonjour');
      expect(parsed.nested.deep).toBe('Valeur');
    });

    it('preserves structure from original file when serializing', () => {
      const original = JSON.stringify(
        { greeting: 'Hello', nested: { deep: 'Value' } },
        null,
        2,
      ) + '\n';

      const translations = new Map([
        ['greeting', 'Bonjour'],
        ['nested.deep', 'Valeur'],
      ]);

      const output = jsonNestedFormat.serialize(translations, original);
      const parsed = JSON.parse(output);

      expect(parsed.greeting).toBe('Bonjour');
      expect(parsed.nested.deep).toBe('Valeur');
      // Preserves original indent
      expect(output).toContain('  "greeting"');
    });

    it('writes translation files to disk', async () => {
      const translations = new Map([
        ['greeting', 'Bonjour'],
        ['farewell', 'Au revoir'],
      ]);

      const output = jsonNestedFormat.serialize(translations);
      const targetPath = path.join(tmpDir, 'locales', 'fr.json');
      await writeFile(targetPath, output, 'utf-8');

      const written = await readFile(targetPath, 'utf-8');
      const parsed = JSON.parse(written);

      expect(parsed.greeting).toBe('Bonjour');
      expect(parsed.farewell).toBe('Au revoir');
    });
  });

  describe('lockfile update', () => {
    it('writes and reads lockfile entries', async () => {
      const lockfile: Lockfile = {
        version: 1,
        entries: {
          'locales/[locale].json': {
            greeting: {
              hash: hashString('Hello'),
              translations: {
                fr: { hash: hashString('Bonjour'), at: '2025-01-01T00:00:00.000Z' },
              },
            },
          },
        },
      };

      await writeLockfile(tmpDir, lockfile);
      const read = await readLockfile(tmpDir);

      expect(read.version).toBe(1);
      expect(read.entries['locales/[locale].json'].greeting.hash).toBe(hashString('Hello'));
      expect(read.entries['locales/[locale].json'].greeting.translations.fr.hash).toBe(
        hashString('Bonjour'),
      );
    });
  });

  describe('quality validation', () => {
    it('passes quality check for reasonable translations', () => {
      const result = scoreTranslation('Hello', 'Bonjour', 'fr');
      expect(result.score).toBeGreaterThan(0);
      expect(result.passed).toBe(true);
    });

    it('flags empty translations', () => {
      const result = scoreTranslation('Hello world', '', 'fr');
      expect(result.passed).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('full pipeline flow (manual stages)', () => {
    it('runs the complete translation pipeline end-to-end', async () => {
      const config = makeConfig({ targetLocales: ['fr'] });
      const provider = new MockProvider();

      // Step 1: Write source file
      const sourceData = {
        greeting: 'Hello',
        farewell: 'Goodbye',
        nested: {
          welcome: 'Welcome, {{name}}!',
        },
      };
      await writeFile(
        path.join(tmpDir, 'locales', 'en.json'),
        JSON.stringify(sourceData, null, 2),
      );

      // Step 2: Read source file
      const sourceContent = await readFile(
        path.join(tmpDir, 'locales', 'en.json'),
        'utf-8',
      );
      const format = jsonNestedFormat;
      const parsed = format.parse(sourceContent);

      expect(parsed.keys.size).toBe(3);
      expect(parsed.keys.get('nested.welcome')).toBe('Welcome, {{name}}!');

      // Step 3: Diff against empty lockfile
      const lockfile = await readLockfile(tmpDir);
      const diff = diffLockfile(lockfile, 'locales/[locale].json', parsed.keys, ['fr']);

      expect(diff.added).toHaveLength(3);
      expect(diff.changed).toHaveLength(0);
      expect(diff.unchanged).toHaveLength(0);

      // Step 4: Shield placeholders
      const shieldedStrings = new Map<string, { shielded: string; tokens: Map<string, string> }>();
      for (const key of diff.added) {
        const value = parsed.keys.get(key)!;
        shieldedStrings.set(key, shield(value, DEFAULT_PATTERNS));
      }

      expect(shieldedStrings.get('nested.welcome')!.tokens.size).toBe(1);

      // Step 5: Translate via mock provider
      const context = resolveContext('locales/[locale].json', config.contexts);
      const systemPrompt = buildSystemPrompt(context, 'en', 'fr');

      const batch = {
        id: 'batch-0',
        strings: new Map<string, string>(),
        sourceLocale: 'en',
        targetLocale: 'fr',
        systemPrompt,
      };
      for (const [key, { shielded }] of shieldedStrings) {
        batch.strings.set(key, shielded);
      }

      const batchResult = await provider.translate(batch);
      expect(batchResult.translations.size).toBe(3);

      // Step 6: Restore placeholders
      const translatedKeys = new Map<string, string>();
      for (const [key, translatedShielded] of batchResult.translations) {
        const shieldInfo = shieldedStrings.get(key)!;
        const translated = restore(translatedShielded, shieldInfo.tokens);
        translatedKeys.set(key, translated);
      }

      // The welcome message should have its placeholder restored
      const welcomeTranslation = translatedKeys.get('nested.welcome')!;
      expect(welcomeTranslation).toContain('{{name}}');

      // Step 7: Quality validation
      for (const [key, translated] of translatedKeys) {
        const source = parsed.keys.get(key)!;
        const quality = scoreTranslation(source, translated, 'fr');
        expect(quality.passed).toBe(true);
      }

      // Step 8: Write target file
      const output = format.serialize(translatedKeys);
      const targetPath = path.join(tmpDir, 'locales', 'fr.json');
      await writeFile(targetPath, output, 'utf-8');

      const targetContent = await readFile(targetPath, 'utf-8');
      const targetParsed = JSON.parse(targetContent);
      expect(targetParsed.greeting).toBe('[fr] Hello');
      expect(targetParsed.farewell).toBe('[fr] Goodbye');
      expect(targetParsed.nested.welcome).toContain('{{name}}');

      // Step 9: Update lockfile
      for (const [key, translated] of translatedKeys) {
        const source = parsed.keys.get(key)!;
        if (!lockfile.entries['locales/[locale].json']) {
          lockfile.entries['locales/[locale].json'] = {};
        }
        lockfile.entries['locales/[locale].json'][key] = {
          hash: hashString(source),
          translations: {
            fr: { hash: hashString(translated), at: new Date().toISOString() },
          },
        };
      }
      await writeLockfile(tmpDir, lockfile);

      // Step 10: Verify lockfile was written
      const updatedLockfile = await readLockfile(tmpDir);
      expect(Object.keys(updatedLockfile.entries['locales/[locale].json'])).toHaveLength(3);
      expect(updatedLockfile.entries['locales/[locale].json']['greeting'].hash).toBe(
        hashString('Hello'),
      );
    });

    it('handles multiple target locales', async () => {
      const config = makeConfig({ targetLocales: ['fr', 'de'] });
      const provider = new MockProvider();

      await writeFile(
        path.join(tmpDir, 'locales', 'en.json'),
        JSON.stringify({ hello: 'Hello' }, null, 2),
      );

      const content = await readFile(path.join(tmpDir, 'locales', 'en.json'), 'utf-8');
      const parsed = jsonNestedFormat.parse(content);

      for (const locale of config.targetLocales) {
        const diff = diffLockfile(
          { version: 1, entries: {} },
          'locales/[locale].json',
          parsed.keys,
          [locale],
        );

        expect(diff.added).toEqual(['hello']);

        const batch = {
          id: `batch-${locale}-0`,
          strings: new Map([['hello', 'Hello']]),
          sourceLocale: 'en',
          targetLocale: locale,
          systemPrompt: `Translate to ${locale}`,
        };

        const result = await provider.translate(batch);
        expect(result.translations.get('hello')).toBe(`[${locale}] Hello`);

        const output = jsonNestedFormat.serialize(result.translations);
        await writeFile(path.join(tmpDir, 'locales', `${locale}.json`), output, 'utf-8');
      }

      // Verify both locale files were written
      const frContent = JSON.parse(
        await readFile(path.join(tmpDir, 'locales', 'fr.json'), 'utf-8'),
      );
      const deContent = JSON.parse(
        await readFile(path.join(tmpDir, 'locales', 'de.json'), 'utf-8'),
      );

      expect(frContent.hello).toBe('[fr] Hello');
      expect(deContent.hello).toBe('[de] Hello');
    });
  });
});

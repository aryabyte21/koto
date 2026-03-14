import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { diffCommand } from '../../src/commands/diff.js';

describe('diff command', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'koto-diff-'));
    await mkdir(path.join(tmpDir, 'locales'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('respects --locale filtering in JSON mode', async () => {
    await writeFile(
      path.join(tmpDir, 'koto.config.json'),
      JSON.stringify(
        {
          sourceLocale: 'en',
          targetLocales: ['fr', 'es'],
          files: ['locales/[locale].json'],
          provider: { name: 'openai', model: 'gpt-4o-mini' },
        },
        null,
        2,
      ),
      'utf-8',
    );
    await writeFile(
      path.join(tmpDir, 'locales', 'en.json'),
      JSON.stringify(
        {
          greeting: 'Hello',
          checkout: 'Pay now',
        },
        null,
        2,
      ),
      'utf-8',
    );

    // Empty lockfile means all keys should appear as added.
    await writeFile(
      path.join(tmpDir, 'koto-lock.json'),
      JSON.stringify({ version: 1, entries: {} }, null, 2),
      'utf-8',
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    try {
      await diffCommand(tmpDir, { json: true, locale: 'fr' });
    } finally {
      console.log = originalLog;
    }

    const output = JSON.parse(logs.join('\n')) as Record<string, { added: string[] }>;
    expect(Object.keys(output)).toEqual(['fr']);
    expect(output.fr.added.sort()).toEqual(['checkout', 'greeting']);
  });
});

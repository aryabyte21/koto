import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readLockfile,
  writeLockfile,
  diffLockfile,
  type Lockfile,
} from '../../src/core/cache/lockfile.js';
import { hashString } from '../../src/core/cache/hasher.js';

describe('readLockfile', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'koto-lockfile-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns empty lockfile on missing file', async () => {
    const result = await readLockfile(tempDir);
    expect(result).toEqual({ version: 1, entries: {} });
  });

  it('returns empty lockfile for invalid JSON', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(tempDir, 'koto.lock'), 'not json', 'utf8');
    const result = await readLockfile(tempDir);
    expect(result).toEqual({ version: 1, entries: {} });
  });
});

describe('writeLockfile + readLockfile round-trip', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'koto-lockfile-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes and reads back the same lockfile', async () => {
    const lockfile: Lockfile = {
      version: 1,
      entries: {
        'locales/en.json': {
          greeting: {
            hash: hashString('Hello'),
            translations: {
              fr: { hash: hashString('Bonjour'), at: '2025-01-01T00:00:00Z' },
            },
          },
        },
      },
    };

    await writeLockfile(tempDir, lockfile);
    const read = await readLockfile(tempDir);
    expect(read).toEqual(lockfile);
  });
});

describe('diffLockfile', () => {
  const filePath = 'locales/en.json';

  it('identifies added keys (no existing entries)', () => {
    const lockfile: Lockfile = { version: 1, entries: {} };
    const keys = new Map([
      ['greeting', 'Hello'],
      ['farewell', 'Goodbye'],
    ]);

    const result = diffLockfile(lockfile, filePath, keys, ['fr']);
    expect(result.added).toEqual(['greeting', 'farewell']);
    expect(result.changed).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });

  it('identifies changed keys when hash differs', () => {
    const lockfile: Lockfile = {
      version: 1,
      entries: {
        [filePath]: {
          greeting: {
            hash: hashString('Hi'),
            translations: {
              fr: { hash: hashString('Salut'), at: '2025-01-01T00:00:00Z' },
            },
          },
        },
      },
    };
    const keys = new Map([['greeting', 'Hello']]);

    const result = diffLockfile(lockfile, filePath, keys, ['fr']);
    expect(result.changed).toEqual(['greeting']);
    expect(result.added).toHaveLength(0);
  });

  it('identifies unchanged keys when hash matches', () => {
    const value = 'Hello';
    const lockfile: Lockfile = {
      version: 1,
      entries: {
        [filePath]: {
          greeting: {
            hash: hashString(value),
            translations: {
              fr: { hash: hashString('Bonjour'), at: '2025-01-01T00:00:00Z' },
            },
          },
        },
      },
    };
    const keys = new Map([['greeting', value]]);

    const result = diffLockfile(lockfile, filePath, keys, ['fr']);
    expect(result.unchanged).toEqual(['greeting']);
    expect(result.added).toHaveLength(0);
    expect(result.changed).toHaveLength(0);
  });

  it('identifies removed keys', () => {
    const lockfile: Lockfile = {
      version: 1,
      entries: {
        [filePath]: {
          greeting: {
            hash: hashString('Hello'),
            translations: {
              fr: { hash: hashString('Bonjour'), at: '2025-01-01T00:00:00Z' },
            },
          },
          old_key: {
            hash: hashString('Old'),
            translations: {
              fr: { hash: hashString('Ancien'), at: '2025-01-01T00:00:00Z' },
            },
          },
        },
      },
    };
    const keys = new Map([['greeting', 'Hello']]);

    const result = diffLockfile(lockfile, filePath, keys, ['fr']);
    expect(result.removed).toEqual(['old_key']);
  });

  it('marks key as added when hash matches but locale translation missing', () => {
    const value = 'Hello';
    const lockfile: Lockfile = {
      version: 1,
      entries: {
        [filePath]: {
          greeting: {
            hash: hashString(value),
            translations: {
              fr: { hash: hashString('Bonjour'), at: '2025-01-01T00:00:00Z' },
            },
          },
        },
      },
    };
    const keys = new Map([['greeting', value]]);

    // de locale not in translations
    const result = diffLockfile(lockfile, filePath, keys, ['de']);
    expect(result.byLocale['de'].added).toEqual(['greeting']);
  });

  it('provides per-locale breakdowns', () => {
    const lockfile: Lockfile = {
      version: 1,
      entries: {
        [filePath]: {
          greeting: {
            hash: hashString('Hello'),
            translations: {
              fr: { hash: hashString('Bonjour'), at: '2025-01-01T00:00:00Z' },
            },
          },
        },
      },
    };
    const keys = new Map([['greeting', 'Hello']]);

    const result = diffLockfile(lockfile, filePath, keys, ['fr', 'de']);
    expect(result.byLocale['fr'].unchanged).toEqual(['greeting']);
    expect(result.byLocale['de'].added).toEqual(['greeting']);
  });
});

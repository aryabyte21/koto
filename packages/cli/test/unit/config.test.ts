import { existsSync } from 'node:fs';
import { kotoConfigSchema, defineConfig, type KotoConfig } from '../../src/core/config/schema.js';
import { findConfigFile } from '../../src/core/config/loader.js';
import { defaults, DEFAULT_MODEL_BY_PROVIDER } from '../../src/core/config/defaults.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('defineConfig', () => {
  it('returns the config object unchanged', () => {
    const config: KotoConfig = {
      sourceLocale: 'en',
      targetLocales: ['fr', 'de'],
      files: ['locales/[locale].json'],
      provider: { name: 'openai' },
    };
    expect(defineConfig(config)).toBe(config);
  });

  it('preserves all optional fields', () => {
    const config: KotoConfig = {
      sourceLocale: 'en',
      targetLocales: ['ja'],
      files: ['src/i18n/[locale].json'],
      provider: { name: 'anthropic', model: 'claude-sonnet-4-20250514', apiKey: 'sk-test' },
      contexts: { default: { tone: 'casual' } },
      typegen: { enabled: true, outputPath: './types.ts' },
      quality: { enabled: true, minScore: 0.8 },
      batch: { size: 20, concurrency: 5 },
    };
    const result = defineConfig(config);
    expect(result).toEqual(config);
  });
});

describe('kotoConfigSchema', () => {
  it('validates a minimal valid config', () => {
    const result = kotoConfigSchema.parse({
      targetLocales: ['fr'],
      files: ['locales/[locale].json'],
      provider: { name: 'openai' },
    });
    expect(result.sourceLocale).toBe('en');
    expect(result.targetLocales).toEqual(['fr']);
    expect(result.provider.name).toBe('openai');
  });

  it('validates a full config with all optional fields', () => {
    const result = kotoConfigSchema.parse({
      sourceLocale: 'de',
      targetLocales: ['en', 'fr'],
      files: ['i18n/[locale].json'],
      provider: { name: 'anthropic', model: 'claude-sonnet-4-20250514', apiKey: 'key', baseUrl: 'https://api.example.com' },
      contexts: { default: { tone: 'formal', instructions: 'Be polite' } },
      typegen: { enabled: true, outputPath: 'types.ts' },
      quality: { enabled: true, minScore: 0.9 },
      batch: { size: 10, concurrency: 2 },
    });
    expect(result.sourceLocale).toBe('de');
    expect(result.provider.model).toBe('claude-sonnet-4-20250514');
  });

  it('applies default sourceLocale when omitted', () => {
    const result = kotoConfigSchema.parse({
      targetLocales: ['es'],
      files: ['l/[locale].json'],
      provider: { name: 'google' },
    });
    expect(result.sourceLocale).toBe('en');
  });

  it('rejects config missing targetLocales', () => {
    expect(() =>
      kotoConfigSchema.parse({
        files: ['l.json'],
        provider: { name: 'openai' },
      }),
    ).toThrow();
  });

  it('rejects config missing files', () => {
    expect(() =>
      kotoConfigSchema.parse({
        targetLocales: ['fr'],
        provider: { name: 'openai' },
      }),
    ).toThrow();
  });

  it('rejects config missing provider', () => {
    expect(() =>
      kotoConfigSchema.parse({
        targetLocales: ['fr'],
        files: ['l.json'],
      }),
    ).toThrow();
  });

  it('rejects invalid provider name', () => {
    expect(() =>
      kotoConfigSchema.parse({
        targetLocales: ['fr'],
        files: ['l.json'],
        provider: { name: 'invalid-provider' },
      }),
    ).toThrow();
  });

  it('rejects quality.minScore outside 0-1 range', () => {
    expect(() =>
      kotoConfigSchema.parse({
        targetLocales: ['fr'],
        files: ['l.json'],
        provider: { name: 'openai' },
        quality: { minScore: 1.5 },
      }),
    ).toThrow();
  });

  it('rejects negative batch size', () => {
    expect(() =>
      kotoConfigSchema.parse({
        targetLocales: ['fr'],
        files: ['l.json'],
        provider: { name: 'openai' },
        batch: { size: -1 },
      }),
    ).toThrow();
  });
});

describe('findConfigFile', () => {
  const mockedExistsSync = vi.mocked(existsSync);

  beforeEach(() => {
    mockedExistsSync.mockReset();
  });

  it('finds koto.config.ts first', () => {
    mockedExistsSync.mockReturnValue(true);
    const result = findConfigFile('/project');
    expect(result).toBe('/project/koto.config.ts');
  });

  it('finds koto.config.js when ts does not exist', () => {
    mockedExistsSync.mockImplementation((p) => {
      return String(p).endsWith('koto.config.js');
    });
    const result = findConfigFile('/project');
    expect(result).toBe('/project/koto.config.js');
  });

  it('finds koto.config.json when ts and js do not exist', () => {
    mockedExistsSync.mockImplementation((p) => {
      return String(p).endsWith('koto.config.json');
    });
    const result = findConfigFile('/project');
    expect(result).toBe('/project/koto.config.json');
  });

  it('returns null when no config file exists', () => {
    mockedExistsSync.mockReturnValue(false);
    const result = findConfigFile('/project');
    expect(result).toBeNull();
  });
});

describe('defaults', () => {
  it('has expected default values', () => {
    expect(defaults.sourceLocale).toBe('en');
    expect(defaults.quality.enabled).toBe(true);
    expect(defaults.quality.minScore).toBe(0.7);
    expect(defaults.typegen.enabled).toBe(false);
    expect(defaults.batch.size).toBe(50);
    expect(defaults.batch.concurrency).toBe(3);
  });

  it('provides default models for all providers', () => {
    expect(DEFAULT_MODEL_BY_PROVIDER['openai']).toBe('gpt-4o-mini');
    expect(DEFAULT_MODEL_BY_PROVIDER['anthropic']).toBe('claude-sonnet-4-20250514');
    expect(DEFAULT_MODEL_BY_PROVIDER['google']).toBe('gemini-2.5-flash');
    expect(DEFAULT_MODEL_BY_PROVIDER['ollama']).toBe('llama3.1');
  });
});

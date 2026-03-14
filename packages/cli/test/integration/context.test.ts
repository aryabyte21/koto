import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveContext, type ContextConfig } from '../../src/core/context/index.js';
import { buildSystemPrompt } from '../../src/core/context/prompt.js';

describe('context resolution integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'koto-context-'));
    await mkdir(path.join(tmpDir, 'locales'), { recursive: true });
    await mkdir(path.join(tmpDir, 'locales', 'legal'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('context matching', () => {
    const contexts: Record<string, ContextConfig> = {
      default: {
        tone: 'friendly',
        instructions: 'Use casual, approachable language.',
      },
      legal: {
        tone: 'formal',
        instructions: 'Use precise legal terminology. Do not paraphrase legal terms.',
        files: ['locales/legal/*'],
      },
    };

    it('resolves default context for standard locale files', () => {
      const ctx = resolveContext('locales/[locale].json', contexts);

      expect(ctx.name).toBe('default');
      expect(ctx.tone).toBe('friendly');
      expect(ctx.instructions).toBe('Use casual, approachable language.');
    });

    it('resolves legal context for files matching the legal pattern', () => {
      const ctx = resolveContext('locales/legal/en.json', contexts);

      expect(ctx.name).toBe('legal');
      expect(ctx.tone).toBe('formal');
      expect(ctx.instructions).toContain('precise legal terminology');
    });

    it('generates different system prompts for each context', () => {
      const defaultCtx = resolveContext('locales/[locale].json', contexts);
      const legalCtx = resolveContext('locales/legal/en.json', contexts);

      const defaultPrompt = buildSystemPrompt(defaultCtx, 'en', 'fr');
      const legalPrompt = buildSystemPrompt(legalCtx, 'en', 'fr');

      // Both should reference the source and target locales
      expect(defaultPrompt).toContain('en');
      expect(defaultPrompt).toContain('fr');
      expect(legalPrompt).toContain('en');
      expect(legalPrompt).toContain('fr');

      // Tones should differ
      expect(defaultPrompt).toContain('friendly');
      expect(legalPrompt).toContain('formal');

      // Instructions should differ
      expect(defaultPrompt).toContain('casual, approachable');
      expect(legalPrompt).toContain('precise legal terminology');

      // Prompts must be different
      expect(defaultPrompt).not.toBe(legalPrompt);
    });
  });

  describe('fallback behavior', () => {
    it('falls back to neutral tone when no contexts are defined', () => {
      const ctx = resolveContext('locales/[locale].json', {});

      expect(ctx.name).toBe('default');
      expect(ctx.tone).toBe('neutral');
      expect(ctx.instructions).toBe('');
    });

    it('falls back to default when file does not match any named context', () => {
      const contexts: Record<string, ContextConfig> = {
        default: { tone: 'casual' },
        marketing: {
          tone: 'enthusiastic',
          files: ['marketing/*'],
        },
      };

      const ctx = resolveContext('locales/[locale].json', contexts);

      expect(ctx.name).toBe('default');
      expect(ctx.tone).toBe('casual');
    });
  });

  describe('multiple named contexts', () => {
    it('resolves the correct context for each file pattern', () => {
      const contexts: Record<string, ContextConfig> = {
        default: { tone: 'neutral' },
        marketing: {
          tone: 'enthusiastic',
          instructions: 'Be exciting and persuasive.',
          files: ['locales/marketing/*'],
        },
        legal: {
          tone: 'formal',
          instructions: 'Be precise and unambiguous.',
          files: ['locales/legal/*'],
        },
        support: {
          tone: 'empathetic',
          instructions: 'Be helpful and understanding.',
          files: ['locales/support/*'],
        },
      };

      expect(resolveContext('locales/marketing/en.json', contexts).name).toBe('marketing');
      expect(resolveContext('locales/legal/en.json', contexts).name).toBe('legal');
      expect(resolveContext('locales/support/en.json', contexts).name).toBe('support');
      expect(resolveContext('locales/[locale].json', contexts).name).toBe('default');
    });
  });

  describe('system prompt generation', () => {
    it('includes glossary terms when provided in context', () => {
      const ctx = resolveContext('locales/[locale].json', {
        default: { tone: 'neutral' },
      });
      ctx.glossaryTerms = {
        'Sign up': "S'inscrire",
        Dashboard: 'Tableau de bord',
      };

      const prompt = buildSystemPrompt(ctx, 'en', 'fr');

      expect(prompt).toContain('Glossary');
      expect(prompt).toContain("Sign up = S'inscrire");
      expect(prompt).toContain('Dashboard = Tableau de bord');
    });

    it('omits glossary section when no terms exist', () => {
      const ctx = resolveContext('locales/[locale].json', {
        default: { tone: 'neutral' },
      });

      const prompt = buildSystemPrompt(ctx, 'en', 'fr');

      expect(prompt).not.toContain('Glossary');
    });

    it('includes placeholder preservation rules', () => {
      const ctx = resolveContext('locales/[locale].json', {});
      const prompt = buildSystemPrompt(ctx, 'en', 'de');

      expect(prompt).toContain('__PH_N__');
      expect(prompt).toContain('Do not add explanations');
    });
  });
});

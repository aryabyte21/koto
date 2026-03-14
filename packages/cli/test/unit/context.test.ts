import { resolveContext, type ContextConfig } from '../../src/core/context/index.js';
import { buildSystemPrompt, } from '../../src/core/context/prompt.js';
import type { ResolvedContext } from '../../src/core/context/index.js';

describe('resolveContext', () => {
  it('matches file to context by pattern', () => {
    const contexts: Record<string, ContextConfig> = {
      default: { tone: 'neutral' },
      marketing: {
        tone: 'enthusiastic',
        instructions: 'Use exciting language',
        files: ['locales/marketing/*'],
      },
    };

    const result = resolveContext('locales/marketing/en.json', contexts);
    expect(result.name).toBe('marketing');
    expect(result.tone).toBe('enthusiastic');
    expect(result.instructions).toBe('Use exciting language');
  });

  it('falls back to default context when no pattern matches', () => {
    const contexts: Record<string, ContextConfig> = {
      default: { tone: 'formal', instructions: 'Keep it professional' },
      marketing: {
        tone: 'casual',
        files: ['locales/marketing/*'],
      },
    };

    const result = resolveContext('locales/common/en.json', contexts);
    expect(result.name).toBe('default');
    expect(result.tone).toBe('formal');
    expect(result.instructions).toBe('Keep it professional');
  });

  it('returns neutral defaults when no default context exists', () => {
    const contexts: Record<string, ContextConfig> = {};
    const result = resolveContext('locales/en.json', contexts);
    expect(result.name).toBe('default');
    expect(result.tone).toBe('neutral');
    expect(result.instructions).toBe('');
  });

  it('skips contexts without files array', () => {
    const contexts: Record<string, ContextConfig> = {
      default: { tone: 'neutral' },
      nofiles: { tone: 'casual' },
    };

    const result = resolveContext('locales/en.json', contexts);
    expect(result.name).toBe('default');
  });

  it('uses first matching context in iteration order', () => {
    const contexts: Record<string, ContextConfig> = {
      default: { tone: 'neutral' },
      first: { tone: 'casual', files: ['locales/*'] },
      second: { tone: 'formal', files: ['locales/*'] },
    };

    const result = resolveContext('locales/en.json', contexts);
    expect(result.name).toBe('first');
  });

  it('sets glossaryPath from context config', () => {
    const contexts: Record<string, ContextConfig> = {
      default: { tone: 'neutral', glossary: 'glossary.json' },
    };

    const result = resolveContext('locales/en.json', contexts);
    expect(result.glossaryPath).toBe('glossary.json');
  });
});

describe('buildSystemPrompt', () => {
  it('includes tone and language info', () => {
    const context: ResolvedContext = {
      name: 'default',
      tone: 'professional',
      instructions: '',
    };

    const prompt = buildSystemPrompt(context, 'en', 'fr');
    expect(prompt).toContain('en');
    expect(prompt).toContain('English');
    expect(prompt).toContain('fr');
    expect(prompt).toContain('French');
    expect(prompt).toContain('Tone: professional');
  });

  it('includes instructions when provided', () => {
    const context: ResolvedContext = {
      name: 'marketing',
      tone: 'casual',
      instructions: 'Use exciting, energetic language',
    };

    const prompt = buildSystemPrompt(context, 'en', 'es');
    expect(prompt).toContain('Use exciting, energetic language');
  });

  it('includes glossary terms', () => {
    const context: ResolvedContext = {
      name: 'default',
      tone: 'neutral',
      instructions: '',
      glossaryTerms: {
        'Dashboard': 'Tableau de bord',
        'Settings': 'Parametres',
      },
    };

    const prompt = buildSystemPrompt(context, 'en', 'fr');
    expect(prompt).toContain('Glossary');
    expect(prompt).toContain('Dashboard = Tableau de bord');
    expect(prompt).toContain('Settings = Parametres');
  });

  it('omits glossary section when no glossary terms', () => {
    const context: ResolvedContext = {
      name: 'default',
      tone: 'neutral',
      instructions: '',
    };

    const prompt = buildSystemPrompt(context, 'en', 'de');
    expect(prompt).not.toContain('Glossary');
  });

  it('omits glossary section when glossaryTerms is empty', () => {
    const context: ResolvedContext = {
      name: 'default',
      tone: 'neutral',
      instructions: '',
      glossaryTerms: {},
    };

    const prompt = buildSystemPrompt(context, 'en', 'de');
    expect(prompt).not.toContain('Glossary');
  });

  it('includes rules section', () => {
    const context: ResolvedContext = {
      name: 'default',
      tone: 'neutral',
      instructions: '',
    };

    const prompt = buildSystemPrompt(context, 'en', 'ja');
    expect(prompt).toContain('Rules:');
    expect(prompt).toContain('__PH_N__');
  });
});

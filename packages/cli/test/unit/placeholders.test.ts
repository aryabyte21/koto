import { shield, restore, validate } from '../../src/core/placeholders/shield.js';
import { DEFAULT_PATTERNS } from '../../src/core/placeholders/patterns.js';

describe('shield', () => {
  it('shields {{var}} mustache placeholders', () => {
    const result = shield('Hello, {{name}}!');
    expect(result.shielded).toBe('Hello, __PH_1__!');
    expect(result.tokens.get('__PH_1__')).toBe('{{name}}');
  });

  it('shields multiple mustache placeholders', () => {
    const result = shield('{{greeting}}, {{name}}! You have {{count}} items.');
    expect(result.shielded).toBe('__PH_1__, __PH_2__! You have __PH_3__ items.');
    expect(result.tokens.size).toBe(3);
  });

  it('shields {var} ICU simple placeholders', () => {
    const result = shield('You have {count} items');
    expect(result.shielded).toBe('You have __PH_1__ items');
    expect(result.tokens.get('__PH_1__')).toBe('{count}');
  });

  it('shields <Tag /> JSX self-closing tags', () => {
    const result = shield('Click <Button /> to continue');
    expect(result.shielded).toBe('Click __PH_1__ to continue');
    expect(result.tokens.get('__PH_1__')).toBe('<Button />');
  });

  it('shields <Tag> and </Tag> JSX open/close tags', () => {
    const result = shield('Read our <Link>terms</Link> page');
    expect(result.shielded).toContain('__PH_1__');
    expect(result.tokens.size).toBeGreaterThanOrEqual(1);
  });

  it('shields %s and %d printf placeholders', () => {
    const result = shield('Hello %s, you have %d items');
    expect(result.shielded).toBe('Hello __PH_1__, you have __PH_2__ items');
    expect(result.tokens.get('__PH_1__')).toBe('%s');
    expect(result.tokens.get('__PH_2__')).toBe('%d');
  });

  it('shields {0}, {1} numbered placeholders', () => {
    const result = shield('{0} of {1} completed');
    expect(result.shielded).toBe('__PH_1__ of __PH_2__ completed');
    expect(result.tokens.get('__PH_1__')).toBe('{0}');
    expect(result.tokens.get('__PH_2__')).toBe('{1}');
  });

  it('shields mixed placeholders in one string', () => {
    const result = shield('{{user}} has %d items in {category}');
    expect(result.tokens.size).toBe(3);
    expect(result.shielded).toContain('__PH_1__');
    expect(result.shielded).toContain('__PH_2__');
    expect(result.shielded).toContain('__PH_3__');
  });

  it('returns original text when no placeholders exist', () => {
    const result = shield('Hello world');
    expect(result.shielded).toBe('Hello world');
    expect(result.tokens.size).toBe(0);
  });

  it('handles overlapping patterns by preferring longer match', () => {
    // {{{triple}}} should match mustache-unescaped (longer) rather than mustache + icu-simple
    const result = shield('Value: {{{raw}}}');
    expect(result.tokens.size).toBe(1);
    expect(result.tokens.get('__PH_1__')).toBe('{{{raw}}}');
  });

  it('shields mustache over ICU when {{var}} present', () => {
    // {{name}} should match as mustache, not as nested ICU
    const result = shield('Hi {{name}}');
    expect(result.tokens.get('__PH_1__')).toBe('{{name}}');
  });
});

describe('restore', () => {
  it('restores all placeholders correctly', () => {
    const tokens = new Map([
      ['__PH_1__', '{{name}}'],
      ['__PH_2__', '{count}'],
    ]);
    const restored = restore('Hola __PH_1__, tienes __PH_2__ elementos', tokens);
    expect(restored).toBe('Hola {{name}}, tienes {count} elementos');
  });

  it('restores a single placeholder', () => {
    const tokens = new Map([['__PH_1__', '%s']]);
    const restored = restore('Bonjour __PH_1__', tokens);
    expect(restored).toBe('Bonjour %s');
  });

  it('warns on missing tokens', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tokens = new Map([
      ['__PH_1__', '{{name}}'],
      ['__PH_2__', '{{missing}}'],
    ]);
    const restored = restore('Translated __PH_1__ text', tokens);
    expect(restored).toBe('Translated {{name}} text');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('__PH_2__'),
    );
    warnSpy.mockRestore();
  });

  it('does not warn when all tokens are present', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tokens = new Map([['__PH_1__', '{name}']]);
    restore('Hello __PH_1__', tokens);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('validate', () => {
  it('detects missing placeholders', () => {
    const result = validate('Hello {{name}} and {{age}}', 'Hola {{name}}');
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('{{age}}');
    expect(result.extra).toHaveLength(0);
  });

  it('detects extra placeholders', () => {
    const result = validate('Hello {{name}}', 'Hola {{name}} {{extra}}');
    expect(result.valid).toBe(false);
    expect(result.extra).toContain('{{extra}}');
    expect(result.missing).toHaveLength(0);
  });

  it('passes on correct translations', () => {
    const result = validate(
      'Hello {{name}}, you have {count} items',
      'Hola {{name}}, tienes {count} elementos',
    );
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
    expect(result.details).toBe('All placeholders preserved');
  });

  it('validates strings with no placeholders', () => {
    const result = validate('Hello world', 'Hola mundo');
    expect(result.valid).toBe(true);
  });

  it('detects both missing and extra placeholders', () => {
    const result = validate('Hello {name}', 'Hola {user}');
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('{name}');
    expect(result.extra).toContain('{user}');
  });

  it('handles duplicate placeholders correctly', () => {
    const result = validate('{name} and {name}', '{name}');
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('{name}');
  });
});

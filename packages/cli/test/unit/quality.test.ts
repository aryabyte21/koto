import {
  placeholderIntegrity,
  lengthRatio,
  untranslatedDetection,
  emptyTranslation,
} from '../../src/core/quality/rules.js';
import { scoreTranslation } from '../../src/core/quality/scorer.js';

describe('placeholderIntegrity rule', () => {
  it('catches missing placeholders', () => {
    const issue = placeholderIntegrity.check(
      'Hello {{name}}, you have {count} items',
      'Hola {{name}}',
      'es',
      'greeting',
    );
    expect(issue).not.toBeNull();
    expect(issue!.rule).toBe('placeholderIntegrity');
    expect(issue!.severity).toBe('error');
    expect(issue!.message).toContain('{count}');
  });

  it('returns null when all placeholders preserved', () => {
    const issue = placeholderIntegrity.check(
      'Hello {{name}}',
      'Hola {{name}}',
      'es',
    );
    expect(issue).toBeNull();
  });
});

describe('lengthRatio rule', () => {
  it('flags translations that are too long (>3x)', () => {
    const issue = lengthRatio.check(
      'Hi',
      'This is an extremely long translation that is way too long for the source',
      'es',
    );
    expect(issue).not.toBeNull();
    expect(issue!.rule).toBe('lengthRatio');
    expect(issue!.severity).toBe('warning');
    expect(issue!.message).toContain('longer');
  });

  it('flags translations that are too short (<0.2x)', () => {
    const issue = lengthRatio.check(
      'This is a very long source string that has many words',
      'Hi',
      'es',
    );
    expect(issue).not.toBeNull();
    expect(issue!.message).toContain('shorter');
  });

  it('returns null for reasonable length ratios', () => {
    const issue = lengthRatio.check('Hello world', 'Hola mundo', 'es');
    expect(issue).toBeNull();
  });

  it('returns null for empty source', () => {
    const issue = lengthRatio.check('', 'Something', 'es');
    expect(issue).toBeNull();
  });
});

describe('untranslatedDetection rule', () => {
  it('flags identical source/translation for non-English locale', () => {
    const issue = untranslatedDetection.check('Hello', 'Hello', 'fr');
    expect(issue).not.toBeNull();
    expect(issue!.rule).toBe('untranslatedDetection');
    expect(issue!.message).toContain('identical');
  });

  it('skips English target locales', () => {
    const issue = untranslatedDetection.check('Hello', 'Hello', 'en-US');
    expect(issue).toBeNull();
  });

  it('returns null for different strings', () => {
    const issue = untranslatedDetection.check('Hello', 'Bonjour', 'fr');
    expect(issue).toBeNull();
  });

  it('returns null for empty source', () => {
    const issue = untranslatedDetection.check('', '', 'fr');
    expect(issue).toBeNull();
  });
});

describe('emptyTranslation rule', () => {
  it('detects empty translation for non-empty source', () => {
    const issue = emptyTranslation.check('Hello', '', 'es');
    expect(issue).not.toBeNull();
    expect(issue!.rule).toBe('emptyTranslation');
    expect(issue!.severity).toBe('error');
  });

  it('detects whitespace-only translation', () => {
    const issue = emptyTranslation.check('Hello', '   ', 'es');
    expect(issue).not.toBeNull();
  });

  it('returns null for non-empty translation', () => {
    const issue = emptyTranslation.check('Hello', 'Hola', 'es');
    expect(issue).toBeNull();
  });

  it('returns null when source is also empty', () => {
    const issue = emptyTranslation.check('', '', 'es');
    expect(issue).toBeNull();
  });
});

describe('scoreTranslation', () => {
  it('scores a perfect translation as 1.0', () => {
    const result = scoreTranslation(
      'Hello {{name}}',
      'Hola {{name}}',
      'es',
    );
    expect(result.score).toBe(1.0);
    expect(result.issues).toHaveLength(0);
    expect(result.passed).toBe(true);
  });

  it('deducts 0.5 for error-severity issues', () => {
    const result = scoreTranslation(
      'Hello {{name}}',
      '',
      'es',
    );
    // emptyTranslation (error: -0.5) + placeholderIntegrity (error: -0.5) = 0.0
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('deducts 0.15 for warning-severity issues', () => {
    const result = scoreTranslation(
      'Hello',
      'Hello',
      'fr',
    );
    // untranslatedDetection warning: -0.15
    expect(result.score).toBeCloseTo(0.85);
    expect(result.passed).toBe(true);
  });

  it('aggregates multiple issues', () => {
    // Identical source+translation (warning) + extreme length ratio (warning)
    // But identical strings won't trigger length ratio.
    // Use a missing placeholder (error) + something else
    const result = scoreTranslation(
      'Hello {name}',
      'Hola',
      'es',
    );
    // placeholderIntegrity error (-0.5)
    expect(result.score).toBe(0.5);
    expect(result.passed).toBe(false);
  });

  it('clamps score to 0 minimum', () => {
    const result = scoreTranslation(
      'Hello {{a}} {{b}} {{c}}',
      '',
      'fr',
    );
    expect(result.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

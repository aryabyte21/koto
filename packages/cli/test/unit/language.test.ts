import {
  getLanguageName,
  getLanguageFlag,
  isValidLocaleCode,
} from '../../src/utils/language.js';

describe('getLanguageName', () => {
  it('returns correct name for common locale codes', () => {
    expect(getLanguageName('en')).toBe('English');
    expect(getLanguageName('fr')).toBe('French');
    expect(getLanguageName('ja')).toBe('Japanese');
    expect(getLanguageName('de')).toBe('German');
    expect(getLanguageName('zh')).toBe('Chinese');
  });

  it('returns correct name for regional variants', () => {
    expect(getLanguageName('pt-BR')).toBe('Brazilian Portuguese');
    expect(getLanguageName('zh-Hans')).toBe('Simplified Chinese');
    expect(getLanguageName('zh-Hant')).toBe('Traditional Chinese');
    expect(getLanguageName('en-US')).toBe('American English');
    expect(getLanguageName('fr-CA')).toBe('Canadian French');
  });

  it('falls back to base language for unknown regional variants', () => {
    expect(getLanguageName('fr-XX')).toBe('French');
    expect(getLanguageName('de-XX')).toBe('German');
  });

  it('returns the code itself for completely unknown codes', () => {
    expect(getLanguageName('xyz')).toBe('xyz');
    expect(getLanguageName('zz-ZZ')).toBe('zz-ZZ');
  });
});

describe('getLanguageFlag', () => {
  it('returns correct flags for common locales', () => {
    expect(getLanguageFlag('fr')).toBe('\u{1F1EB}\u{1F1F7}');
    expect(getLanguageFlag('ja')).toBe('\u{1F1EF}\u{1F1F5}');
    expect(getLanguageFlag('de')).toBe('\u{1F1E9}\u{1F1EA}');
  });

  it('returns correct flags for regional variants', () => {
    expect(getLanguageFlag('pt-BR')).toBe('\u{1F1E7}\u{1F1F7}');
    expect(getLanguageFlag('zh-Hans')).toBe('\u{1F1E8}\u{1F1F3}');
    expect(getLanguageFlag('zh-Hant')).toBe('\u{1F1F9}\u{1F1FC}');
    expect(getLanguageFlag('en-US')).toBe('\u{1F1FA}\u{1F1F8}');
  });

  it('falls back to white flag for unknown codes', () => {
    expect(getLanguageFlag('xyz')).toBe('\u{1F3F3}\uFE0F');
  });
});

describe('isValidLocaleCode', () => {
  it('accepts simple two-letter codes', () => {
    expect(isValidLocaleCode('en')).toBe(true);
    expect(isValidLocaleCode('fr')).toBe(true);
    expect(isValidLocaleCode('ja')).toBe(true);
  });

  it('accepts three-letter codes', () => {
    expect(isValidLocaleCode('fil')).toBe(true);
  });

  it('accepts regional variants with country codes', () => {
    expect(isValidLocaleCode('en-US')).toBe(true);
    expect(isValidLocaleCode('pt-BR')).toBe(true);
    expect(isValidLocaleCode('zh-CN')).toBe(true);
  });

  it('accepts script subtags', () => {
    expect(isValidLocaleCode('zh-Hans')).toBe(true);
    expect(isValidLocaleCode('zh-Hant')).toBe(true);
    expect(isValidLocaleCode('sr-Latn')).toBe(true);
  });

  it('rejects invalid codes', () => {
    expect(isValidLocaleCode('')).toBe(false);
    expect(isValidLocaleCode('e')).toBe(false);
    expect(isValidLocaleCode('english')).toBe(false);
    expect(isValidLocaleCode('EN')).toBe(false);
    expect(isValidLocaleCode('123')).toBe(false);
  });
});

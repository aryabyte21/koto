import { poFormat } from '../../src/formats/po.js';

describe('poFormat.parse', () => {
  it('parses simple msgid/msgstr pairs', () => {
    const content = [
      'msgid "Hello"',
      'msgstr "Hola"',
      '',
      'msgid "Goodbye"',
      'msgstr "Adiós"',
      '',
    ].join('\n');
    const result = poFormat.parse(content);
    expect(result.keys.get('Hello')).toBe('Hola');
    expect(result.keys.get('Goodbye')).toBe('Adiós');
  });

  it('skips header entry (empty msgid)', () => {
    const content = [
      'msgid ""',
      'msgstr "Content-Type: text/plain; charset=UTF-8\\n"',
      '',
      'msgid "Hello"',
      'msgstr "Hola"',
      '',
    ].join('\n');
    const result = poFormat.parse(content);
    expect(result.keys.has('')).toBe(false);
    expect(result.keys.get('Hello')).toBe('Hola');
  });

  it('handles multiline strings', () => {
    const content = [
      'msgid ""',
      '"This is a "',
      '"long string"',
      'msgstr ""',
      '"Esta es una "',
      '"cadena larga"',
      '',
    ].join('\n');
    const result = poFormat.parse(content);
    expect(result.keys.get('This is a long string')).toBe('Esta es una cadena larga');
  });

  it('preserves comments in parse metadata', () => {
    const content = [
      '# Translator comment',
      '#. Developer comment',
      'msgid "Hello"',
      'msgstr "Hola"',
      '',
    ].join('\n');
    const result = poFormat.parse(content);
    expect(result.keys.get('Hello')).toBe('Hola');
  });

  it('handles msgctxt as key prefix', () => {
    const content = [
      'msgctxt "menu"',
      'msgid "File"',
      'msgstr "Archivo"',
      '',
      'msgctxt "dialog"',
      'msgid "File"',
      'msgstr "Fichero"',
      '',
    ].join('\n');
    const result = poFormat.parse(content);
    expect(result.keys.get('menu\x04File')).toBe('Archivo');
    expect(result.keys.get('dialog\x04File')).toBe('Fichero');
  });

  it('handles escaped characters', () => {
    const content = [
      'msgid "Say \\"hello\\""',
      'msgstr "Di \\"hola\\""',
      '',
    ].join('\n');
    const result = poFormat.parse(content);
    expect(result.keys.get('Say "hello"')).toBe('Di "hola"');
  });

  it('handles empty msgstr', () => {
    const content = [
      'msgid "Untranslated"',
      'msgstr ""',
      '',
    ].join('\n');
    const result = poFormat.parse(content);
    expect(result.keys.get('Untranslated')).toBe('');
  });

  it('handles empty file', () => {
    const result = poFormat.parse('');
    expect(result.keys.size).toBe(0);
  });
});

describe('poFormat.serialize', () => {
  it('serializes simple key-value pairs', () => {
    const keys = new Map([
      ['Hello', 'Hola'],
      ['Goodbye', 'Adiós'],
    ]);
    const output = poFormat.serialize(keys);
    expect(output).toContain('msgid "Hello"');
    expect(output).toContain('msgstr "Hola"');
    expect(output).toContain('msgid "Goodbye"');
    expect(output).toContain('msgstr "Adi\\u00f3s"'.replace('\\u00f3', 'ó'));
  });

  it('preserves header on round-trip', () => {
    const original = [
      'msgid ""',
      'msgstr "Content-Type: text/plain; charset=UTF-8\\n"',
      '',
      'msgid "Hello"',
      'msgstr "Hola"',
      '',
    ].join('\n');

    const parsed = poFormat.parse(original);
    const modified = new Map(parsed.keys);
    modified.set('Hello', 'Bonjour');

    const serialized = poFormat.serialize(modified, original);
    expect(serialized).toContain('msgid ""');
    expect(serialized).toContain('Content-Type');
    expect(serialized).toContain('msgstr "Bonjour"');
  });

  it('round-trips parse then serialize', () => {
    const original = [
      'msgid "Hello"',
      'msgstr "Hola"',
      '',
      'msgid "Goodbye"',
      'msgstr "Adiós"',
      '',
    ].join('\n');

    const parsed = poFormat.parse(original);
    const modified = new Map(parsed.keys);
    modified.set('Hello', 'Bonjour');

    const serialized = poFormat.serialize(modified, original);
    const reparsed = poFormat.parse(serialized);

    expect(reparsed.keys.get('Hello')).toBe('Bonjour');
    expect(reparsed.keys.get('Goodbye')).toBe('Adiós');
  });

  it('serializes entries with msgctxt', () => {
    const keys = new Map([
      ['menu\x04File', 'Archivo'],
    ]);
    const output = poFormat.serialize(keys);
    expect(output).toContain('msgctxt "menu"');
    expect(output).toContain('msgid "File"');
    expect(output).toContain('msgstr "Archivo"');
  });

  it('escapes special characters', () => {
    const keys = new Map([['Say "hello"', 'Di "hola"']]);
    const output = poFormat.serialize(keys);
    expect(output).toContain('msgid "Say \\"hello\\""');
    expect(output).toContain('msgstr "Di \\"hola\\""');
  });

  it('adds new keys when serializing with original', () => {
    const original = [
      'msgid "Hello"',
      'msgstr "Hola"',
      '',
    ].join('\n');

    const keys = new Map([
      ['Hello', 'Hola'],
      ['NewKey', 'NuevaClave'],
    ]);

    const serialized = poFormat.serialize(keys, original);
    expect(serialized).toContain('msgid "NewKey"');
    expect(serialized).toContain('msgstr "NuevaClave"');
  });
});

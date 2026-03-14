import { yamlFormat } from '../../src/formats/yaml.js';

describe('yamlFormat.parse', () => {
  it('parses flat key-value pairs', () => {
    const content = `greeting: Hello\nfarewell: Goodbye\n`;
    const result = yamlFormat.parse(content);
    expect(result.keys.get('greeting')).toBe('Hello');
    expect(result.keys.get('farewell')).toBe('Goodbye');
    expect(result.keys.size).toBe(2);
  });

  it('parses nested keys with dot notation', () => {
    const content = [
      'common:',
      '  save: Save',
      '  cancel: Cancel',
      'pages:',
      '  home:',
      '    title: Welcome',
    ].join('\n');
    const result = yamlFormat.parse(content);
    expect(result.keys.get('common.save')).toBe('Save');
    expect(result.keys.get('common.cancel')).toBe('Cancel');
    expect(result.keys.get('pages.home.title')).toBe('Welcome');
  });

  it('parses quoted strings', () => {
    const content = `key1: "Hello, world"\nkey2: 'It''s fine'\n`;
    const result = yamlFormat.parse(content);
    expect(result.keys.get('key1')).toBe('Hello, world');
    expect(result.keys.get('key2')).toBe("It's fine");
  });

  it('parses block scalar (literal |)', () => {
    const content = [
      'description: |',
      '  Line one',
      '  Line two',
      '  Line three',
    ].join('\n');
    const result = yamlFormat.parse(content);
    expect(result.keys.get('description')).toBe('Line one\nLine two\nLine three');
  });

  it('parses block scalar (folded >)', () => {
    const content = [
      'description: >',
      '  This is a',
      '  long paragraph',
    ].join('\n');
    const result = yamlFormat.parse(content);
    expect(result.keys.get('description')).toBe('This is a long paragraph');
  });

  it('handles comments without crashing', () => {
    const content = [
      '# This is a comment',
      'key: value',
      '# Another comment',
      'key2: value2',
    ].join('\n');
    const result = yamlFormat.parse(content);
    expect(result.keys.get('key')).toBe('value');
    expect(result.keys.get('key2')).toBe('value2');
    expect(result.keys.size).toBe(2);
  });

  it('parses arrays of strings', () => {
    const content = [
      'colors:',
      '  - red',
      '  - green',
      '  - blue',
    ].join('\n');
    const result = yamlFormat.parse(content);
    expect(result.keys.get('colors.0')).toBe('red');
    expect(result.keys.get('colors.1')).toBe('green');
    expect(result.keys.get('colors.2')).toBe('blue');
  });

  it('handles empty content', () => {
    const result = yamlFormat.parse('');
    expect(result.keys.size).toBe(0);
  });

  it('handles deeply nested structures', () => {
    const content = [
      'a:',
      '  b:',
      '    c:',
      '      d: deep',
    ].join('\n');
    const result = yamlFormat.parse(content);
    expect(result.keys.get('a.b.c.d')).toBe('deep');
  });

  it('handles escaped characters in double-quoted strings', () => {
    const content = `key: "Hello\\nWorld"\n`;
    const result = yamlFormat.parse(content);
    expect(result.keys.get('key')).toBe('Hello\nWorld');
  });
});

describe('yamlFormat.serialize', () => {
  it('serializes flat keys', () => {
    const keys = new Map([
      ['greeting', 'Hello'],
      ['farewell', 'Goodbye'],
    ]);
    const output = yamlFormat.serialize(keys);
    expect(output).toContain('greeting: Hello');
    expect(output).toContain('farewell: Goodbye');
  });

  it('serializes nested keys', () => {
    const keys = new Map([
      ['common.save', 'Guardar'],
      ['common.cancel', 'Cancelar'],
      ['pages.home.title', 'Inicio'],
    ]);
    const output = yamlFormat.serialize(keys);
    expect(output).toContain('common:');
    expect(output).toContain('  save: Guardar');
    expect(output).toContain('  cancel: Cancelar');
    expect(output).toContain('pages:');
    expect(output).toContain('  home:');
    expect(output).toContain('    title: Inicio');
  });

  it('quotes values that need quoting', () => {
    const keys = new Map([['key', 'value: with colon']]);
    const output = yamlFormat.serialize(keys);
    expect(output).toContain('"value: with colon"');
  });

  it('round-trips parse then serialize', () => {
    const original = [
      'common:',
      '  save: Save',
      '  cancel: Cancel',
      'pages:',
      '  home:',
      '    title: Welcome',
      '',
    ].join('\n');

    const parsed = yamlFormat.parse(original);
    const modified = new Map(parsed.keys);
    modified.set('common.save', 'Guardar');

    const serialized = yamlFormat.serialize(modified, original);
    const reparsed = yamlFormat.parse(serialized);

    expect(reparsed.keys.get('common.save')).toBe('Guardar');
    expect(reparsed.keys.get('common.cancel')).toBe('Cancel');
    expect(reparsed.keys.get('pages.home.title')).toBe('Welcome');
  });

  it('serializes multiline values with block scalar', () => {
    const keys = new Map([['description', 'Line one\nLine two']]);
    const output = yamlFormat.serialize(keys);
    expect(output).toContain('description: |');
    expect(output).toContain('  Line one');
    expect(output).toContain('  Line two');
  });

  it('serializes values that look like booleans as quoted strings', () => {
    const keys = new Map([['key', 'true']]);
    const output = yamlFormat.serialize(keys);
    expect(output).toContain('"true"');
  });
});

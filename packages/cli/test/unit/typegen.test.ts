import {
  formatKeyUnion,
  formatParamsType,
} from '../../src/core/typegen/templates.js';

describe('formatKeyUnion', () => {
  it('generates a union of quoted string keys', () => {
    const result = formatKeyUnion(['greeting', 'farewell', 'title']);
    expect(result).toBe("'greeting' | 'farewell' | 'title'");
  });

  it('returns never for empty keys', () => {
    const result = formatKeyUnion([]);
    expect(result).toBe('never');
  });

  it('handles a single key', () => {
    const result = formatKeyUnion(['only_key']);
    expect(result).toBe("'only_key'");
  });

  it('handles dot-notation keys', () => {
    const result = formatKeyUnion(['common.save', 'pages.home.title']);
    expect(result).toContain("'common.save'");
    expect(result).toContain("'pages.home.title'");
  });
});

describe('formatParamsType', () => {
  it('generates typed params for parameterized keys', () => {
    const params = new Map([
      ['greeting', ['name']],
      ['item_count', ['count']],
    ]);
    const result = formatParamsType(params);
    expect(result).toContain("'greeting'");
    expect(result).toContain('name: string | number');
    expect(result).toContain("'item_count'");
    expect(result).toContain('count: string | number');
  });

  it('returns empty object for no params', () => {
    const result = formatParamsType(new Map());
    expect(result).toBe('{}');
  });

  it('handles multiple params in a single key', () => {
    const params = new Map([
      ['message', ['name', 'count', 'date']],
    ]);
    const result = formatParamsType(params);
    expect(result).toContain('name: string | number');
    expect(result).toContain('count: string | number');
    expect(result).toContain('date: string | number');
  });
});

describe('parameter extraction patterns', () => {
  // Test the regex patterns used in typegen/index.ts extractParams
  function extractParams(value: string): string[] {
    const params: string[] = [];
    const seen = new Set<string>();
    const patterns = [
      /\{\{(\w+)\}\}/g,
      /\{(\w+)(?:,[^}]*)?\}/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(value)) !== null) {
        const param = match[1];
        if (!seen.has(param)) {
          seen.add(param);
          params.push(param);
        }
      }
    }
    return params;
  }

  it('extracts mustache parameters', () => {
    const params = extractParams('Hello {{name}}, welcome!');
    expect(params).toContain('name');
  });

  it('extracts ICU parameters', () => {
    const params = extractParams('You have {count} items');
    expect(params).toContain('count');
  });

  it('extracts multiple parameters from mixed formats', () => {
    const params = extractParams('{{greeting}}, {name}! You have {count} messages.');
    expect(params).toContain('greeting');
    expect(params).toContain('name');
    expect(params).toContain('count');
  });

  it('deduplicates parameters', () => {
    const params = extractParams('{name} and {name}');
    expect(params).toEqual(['name']);
  });

  it('returns empty array for strings without parameters', () => {
    const params = extractParams('Hello world');
    expect(params).toEqual([]);
  });

  it('handles ICU plural parameters', () => {
    const params = extractParams('{count, plural, one {# item} other {# items}}');
    expect(params).toContain('count');
  });
});

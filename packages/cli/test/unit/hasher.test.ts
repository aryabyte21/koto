import { hashString, hashObject } from '../../src/core/cache/hasher.js';

describe('hashString', () => {
  it('returns a consistent SHA-256 hex string', () => {
    const hash1 = hashString('hello');
    const hash2 = hashString('hello');
    expect(hash1).toBe(hash2);
  });

  it('returns a 64-character hex string', () => {
    const hash = hashString('test input');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hashString('hello');
    const hash2 = hashString('world');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for similar inputs', () => {
    const hash1 = hashString('abc');
    const hash2 = hashString('abd');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty string', () => {
    const hash = hashString('');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('handles unicode characters', () => {
    const hash = hashString('こんにちは');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('hashObject', () => {
  it('returns consistent hash regardless of key insertion order', () => {
    const hash1 = hashObject({ a: '1', b: '2', c: '3' });
    const hash2 = hashObject({ c: '3', a: '1', b: '2' });
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different objects', () => {
    const hash1 = hashObject({ key: 'value1' });
    const hash2 = hashObject({ key: 'value2' });
    expect(hash1).not.toBe(hash2);
  });

  it('returns a 64-character hex string', () => {
    const hash = hashObject({ foo: 'bar' });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

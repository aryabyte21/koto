import { hashString } from '../../src/core/cache/hasher.js';
import type { Lockfile } from '../../src/core/cache/lockfile.js';
import {
  computeCoverage,
  generateCoverageHtml,
  generateBadgeUrl,
  generateBadgeMarkdown,
} from '../../src/commands/badge.js';

describe('computeCoverage', () => {
  it('returns zero coverage for an empty lockfile', () => {
    const lockfile: Lockfile = { version: 1, entries: {} };
    const report = computeCoverage(lockfile, ['fr', 'es']);

    expect(report.totalKeys).toBe(0);
    expect(report.overallPercentage).toBe(0);
    expect(report.locales).toHaveLength(2);
    expect(report.locales[0]).toEqual({
      locale: 'fr',
      translated: 0,
      total: 0,
      percentage: 0,
    });
  });

  it('computes 100% when all keys are translated for all locales', () => {
    const lockfile: Lockfile = {
      version: 1,
      entries: {
        'locales/en.json': {
          greeting: {
            hash: hashString('Hello'),
            translations: {
              fr: { hash: hashString('Bonjour'), at: '2025-01-01T00:00:00Z' },
              es: { hash: hashString('Hola'), at: '2025-01-01T00:00:00Z' },
            },
          },
          farewell: {
            hash: hashString('Goodbye'),
            translations: {
              fr: { hash: hashString('Au revoir'), at: '2025-01-01T00:00:00Z' },
              es: { hash: hashString('Adiós'), at: '2025-01-01T00:00:00Z' },
            },
          },
        },
      },
    };

    const report = computeCoverage(lockfile, ['fr', 'es']);

    expect(report.totalKeys).toBe(2);
    expect(report.overallPercentage).toBe(100);
    expect(report.locales[0]).toEqual({
      locale: 'fr',
      translated: 2,
      total: 2,
      percentage: 100,
    });
    expect(report.locales[1]).toEqual({
      locale: 'es',
      translated: 2,
      total: 2,
      percentage: 100,
    });
  });

  it('computes partial coverage when some translations are missing', () => {
    const lockfile: Lockfile = {
      version: 1,
      entries: {
        'locales/en.json': {
          greeting: {
            hash: hashString('Hello'),
            translations: {
              fr: { hash: hashString('Bonjour'), at: '2025-01-01T00:00:00Z' },
            },
          },
          farewell: {
            hash: hashString('Goodbye'),
            translations: {
              fr: { hash: hashString('Au revoir'), at: '2025-01-01T00:00:00Z' },
              es: { hash: hashString('Adiós'), at: '2025-01-01T00:00:00Z' },
            },
          },
        },
      },
    };

    const report = computeCoverage(lockfile, ['fr', 'es']);

    expect(report.totalKeys).toBe(2);
    expect(report.locales[0]).toEqual({
      locale: 'fr',
      translated: 2,
      total: 2,
      percentage: 100,
    });
    expect(report.locales[1]).toEqual({
      locale: 'es',
      translated: 1,
      total: 2,
      percentage: 50,
    });
    // Overall: 3 out of 4 possible = 75%
    expect(report.overallPercentage).toBe(75);
  });

  it('handles multiple files', () => {
    const lockfile: Lockfile = {
      version: 1,
      entries: {
        'locales/en.json': {
          greeting: {
            hash: hashString('Hello'),
            translations: {
              ja: { hash: hashString('こんにちは'), at: '2025-01-01T00:00:00Z' },
            },
          },
        },
        'locales/common.json': {
          ok: {
            hash: hashString('OK'),
            translations: {
              ja: { hash: hashString('OK'), at: '2025-01-01T00:00:00Z' },
            },
          },
        },
      },
    };

    const report = computeCoverage(lockfile, ['ja']);

    expect(report.totalKeys).toBe(2);
    expect(report.overallPercentage).toBe(100);
  });

  it('ignores locales not in the target list', () => {
    const lockfile: Lockfile = {
      version: 1,
      entries: {
        'locales/en.json': {
          greeting: {
            hash: hashString('Hello'),
            translations: {
              fr: { hash: hashString('Bonjour'), at: '2025-01-01T00:00:00Z' },
              de: { hash: hashString('Hallo'), at: '2025-01-01T00:00:00Z' },
            },
          },
        },
      },
    };

    // Only asking about 'fr', 'de' translations should not count
    const report = computeCoverage(lockfile, ['fr']);

    expect(report.locales).toHaveLength(1);
    expect(report.overallPercentage).toBe(100);
  });
});

describe('generateBadgeUrl', () => {
  it('generates a valid shields.io URL with encoded percentage', () => {
    const url = generateBadgeUrl(95, 3);
    expect(url).toBe('https://img.shields.io/badge/i18n-95%25%20%7C%203%20locales-green?style=flat-square');
  });

  it('handles 0% coverage', () => {
    const url = generateBadgeUrl(0, 1);
    expect(url).toContain('0%25');
    expect(url).toContain('1%20locales');
    expect(url).toContain('-red?');
  });

  it('handles 100% coverage', () => {
    const url = generateBadgeUrl(100, 5);
    expect(url).toContain('100%25');
    expect(url).toContain('5%20locales');
    expect(url).toContain('-brightgreen?');
  });
});

describe('generateBadgeMarkdown', () => {
  it('wraps badge URL in markdown image syntax', () => {
    const md = generateBadgeMarkdown(95, 3);
    expect(md).toBe(
      '![i18n](https://img.shields.io/badge/i18n-95%25%20%7C%203%20locales-green?style=flat-square)',
    );
  });

  it('produces valid markdown for any percentage', () => {
    const md = generateBadgeMarkdown(42, 7);
    expect(md).toMatch(/^!\[i18n\]\(https:\/\/img\.shields\.io\/badge\/.+\)$/);
  });
});

describe('generateCoverageHtml', () => {
  it('renders a readable HTML report table with coverage rows', () => {
    const html = generateCoverageHtml({
      totalKeys: 3,
      overallPercentage: 83,
      locales: [
        { locale: 'fr', translated: 3, total: 3, percentage: 100 },
        { locale: 'es', translated: 2, total: 3, percentage: 67 },
      ],
    });

    expect(html).toContain('<title>koto i18n Coverage Report</title>');
    expect(html).toContain('<td>fr</td>');
    expect(html).toContain('<td>100%</td>');
    expect(html).toContain('<td>Needs attention</td>');
    expect(html).toContain('Overall coverage: 83%');
  });
});

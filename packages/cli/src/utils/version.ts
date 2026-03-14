import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // Works both from src/ (dev) and dist/ (built)
    const paths = [
      resolve(__dirname, '../../package.json'),  // from src/utils/
      resolve(__dirname, '../package.json'),      // from dist/
    ];
    for (const p of paths) {
      try {
        const pkg = JSON.parse(readFileSync(p, 'utf-8'));
        if (pkg.version) return pkg.version;
      } catch {
        continue;
      }
    }
  } catch {
    // fallback
  }
  return '0.1.0';
}

export const VERSION = loadVersion();

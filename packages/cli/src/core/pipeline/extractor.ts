import type { ParsedTranslations } from '../../formats/base.js';
import type { FileFormat } from '../../formats/base.js';
import { readFile } from '../../utils/fs.js';
import { getFormat } from '../../formats/registry.js';
import path from 'node:path';

export interface ExtractedFile {
  filePath: string;
  format: FileFormat;
  keys: Map<string, string>;
  rawContent: string;
}

export async function extractSourceFiles(
  patterns: string[],
  sourceLocale: string,
  cwd: string,
): Promise<ExtractedFile[]> {
  const files: ExtractedFile[] = [];

  for (const pattern of patterns) {
    const sourcePath = pattern.replace('[locale]', sourceLocale);
    const absolutePath = path.resolve(cwd, sourcePath);

    try {
      const content = await readFile(absolutePath);
      const format = getFormat(sourcePath);
      const parsed = format.parse(content);

      files.push({
        filePath: pattern,
        format,
        keys: parsed.keys,
        rawContent: content,
      });
    } catch {
      // File not found, skip
    }
  }

  return files;
}

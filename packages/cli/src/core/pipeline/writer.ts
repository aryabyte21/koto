import type { FileFormat } from '../../formats/base.js';
import { readFile, writeFile } from '../../utils/fs.js';
import path from 'node:path';

export async function writeTranslations(
  targetFilePath: string,
  translations: Map<string, string>,
  format: FileFormat,
  cwd: string,
): Promise<void> {
  const absolutePath = path.resolve(cwd, targetFilePath);

  // Try to read existing file for round-trip preservation
  let existingContent: string | undefined;
  try {
    existingContent = await readFile(absolutePath);
  } catch {
    // New file
  }

  // If existing file exists, merge translations into it
  if (existingContent) {
    const existing = format.parse(existingContent);
    for (const [key, value] of translations) {
      existing.keys.set(key, value);
    }
    const output = format.serialize(existing.keys, existingContent);
    await writeFile(absolutePath, output);
  } else {
    const output = format.serialize(translations);
    await writeFile(absolutePath, output);
  }
}

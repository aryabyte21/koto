import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const LOCALE_DIRS = [
  "locales",
  "src/locales",
  "messages",
  "src/messages",
  "lang",
  "src/lang",
  "i18n",
  "src/i18n",
  "public/locales",
];

const LOCALE_FILE_REGEX = /^([a-z]{2,3}(?:-[A-Za-z]{2,4})?)\.(?:json|ya?ml)$/;

export async function detectLocales(
  cwd: string
): Promise<{
  directory: string;
  sourceLocale: string;
  targetLocales: string[];
  pattern: string;
} | null> {
  for (const dir of LOCALE_DIRS) {
    const fullDir = join(cwd, dir);
    const result = await scanDirectory(fullDir, dir);
    if (result) return result;
  }
  return null;
}

async function scanDirectory(
  fullDir: string,
  relativeDir: string
): Promise<{
  directory: string;
  sourceLocale: string;
  targetLocales: string[];
  pattern: string;
} | null> {
  let entries: string[];
  try {
    entries = await readdir(fullDir);
  } catch {
    return null;
  }

  const localeFiles: { locale: string; size: number; ext: string }[] = [];

  for (const entry of entries) {
    const match = entry.match(LOCALE_FILE_REGEX);
    if (!match) continue;

    try {
      const fileStat = await stat(join(fullDir, entry));
      if (fileStat.isFile()) {
        localeFiles.push({
          locale: match[1],
          size: fileStat.size,
          ext: entry.split(".").pop()!,
        });
      }
    } catch {
      // skip unreadable files
    }
  }

  if (localeFiles.length === 0) return null;

  const ext = localeFiles[0].ext;
  const hasEn = localeFiles.some((f) => f.locale === "en");
  const largest = localeFiles.reduce((a, b) => (a.size > b.size ? a : b));
  const sourceLocale = hasEn ? "en" : largest.locale;

  const targetLocales = localeFiles
    .map((f) => f.locale)
    .filter((l) => l !== sourceLocale)
    .sort();

  return {
    directory: relativeDir,
    sourceLocale,
    targetLocales,
    pattern: `${relativeDir}/[locale].${ext}`,
  };
}

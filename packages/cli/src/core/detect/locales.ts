import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

// Common paths where locale files live
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
  // Monorepo / deeper paths
  "packages/i18n/locales",
  "packages/locales",
  "apps/web/locales",
  "apps/web/src/locales",
  "apps/web/messages",
];

const LOCALE_FILE_REGEX = /^([a-z]{2,3}(?:-[A-Za-z]{2,4})?)\.(?:json|ya?ml)$/;
const LOCALE_DIR_REGEX = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/;

export async function detectLocales(
  cwd: string,
): Promise<{
  directory: string;
  sourceLocale: string;
  targetLocales: string[];
  pattern: string;
} | null> {
  for (const dir of LOCALE_DIRS) {
    const fullDir = join(cwd, dir);

    // Try file-per-locale first (locales/en.json, locales/es.json)
    const fileResult = await scanFilePerLocale(fullDir, dir);
    if (fileResult) return fileResult;

    // Try directory-per-locale (locales/en/common.json, locales/es/common.json)
    const dirResult = await scanDirPerLocale(fullDir, dir);
    if (dirResult) return dirResult;
  }
  return null;
}

async function scanFilePerLocale(
  fullDir: string,
  relativeDir: string,
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
      // skip
    }
  }

  if (localeFiles.length < 2) return null;

  const ext = localeFiles[0].ext;
  const hasEn = localeFiles.some((f) => f.locale === "en");
  const largest = localeFiles.reduce((a, b) => (a.size > b.size ? a : b));
  const sourceLocale = hasEn ? "en" : largest.locale;

  return {
    directory: relativeDir,
    sourceLocale,
    targetLocales: localeFiles
      .map((f) => f.locale)
      .filter((l) => l !== sourceLocale)
      .sort(),
    pattern: `${relativeDir}/[locale].${ext}`,
  };
}

async function scanDirPerLocale(
  fullDir: string,
  relativeDir: string,
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

  const localeDirs: { locale: string; file: string }[] = [];

  for (const entry of entries) {
    if (!LOCALE_DIR_REGEX.test(entry)) continue;

    try {
      const entryStat = await stat(join(fullDir, entry));
      if (!entryStat.isDirectory()) continue;

      // Look for JSON/YAML files inside the locale directory
      const innerFiles = await readdir(join(fullDir, entry));
      const jsonFile = innerFiles.find((f) => f.endsWith(".json"));
      if (jsonFile) {
        localeDirs.push({ locale: entry, file: jsonFile });
      }
    } catch {
      // skip
    }
  }

  if (localeDirs.length < 2) return null;

  const hasEn = localeDirs.some((d) => d.locale === "en");
  const sourceLocale = hasEn ? "en" : localeDirs[0].locale;
  const fileName = localeDirs[0].file;

  return {
    directory: relativeDir,
    sourceLocale,
    targetLocales: localeDirs
      .map((d) => d.locale)
      .filter((l) => l !== sourceLocale)
      .sort(),
    pattern: `${relativeDir}/[locale]/${fileName}`,
  };
}

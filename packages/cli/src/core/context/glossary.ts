import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../utils/logger.js";

export async function loadGlossary(
  glossaryPath: string,
  targetLocale: string
): Promise<Record<string, string>> {
  const result = await tryLoadLocaleFile(glossaryPath, targetLocale);
  if (result) return result;

  const perLocale = await tryLoadPerLocaleFile(glossaryPath, targetLocale);
  if (perLocale) return perLocale;

  return {};
}

async function tryLoadLocaleFile(
  glossaryPath: string,
  targetLocale: string
): Promise<Record<string, string> | null> {
  try {
    const raw = await readFile(glossaryPath, "utf-8");
    const data = JSON.parse(raw);

    if (data[targetLocale] && typeof data[targetLocale] === "object") {
      return data[targetLocale] as Record<string, string>;
    }

    if (typeof Object.values(data)[0] === "string") {
      return data as Record<string, string>;
    }

    return null;
  } catch {
    logger.debug(`Glossary not found at ${glossaryPath}`);
    return null;
  }
}

async function tryLoadPerLocaleFile(
  glossaryPath: string,
  targetLocale: string
): Promise<Record<string, string> | null> {
  const perLocalePath = join(glossaryPath, `${targetLocale}.json`);
  try {
    const raw = await readFile(perLocalePath, "utf-8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    logger.debug(`Per-locale glossary not found at ${perLocalePath}`);
    return null;
  }
}

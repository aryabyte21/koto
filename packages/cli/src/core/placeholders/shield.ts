import { DEFAULT_PATTERNS, type PlaceholderPattern } from "./patterns.js";

export interface ShieldResult {
  shielded: string;
  tokens: Map<string, string>;
}

export interface PlaceholderValidation {
  valid: boolean;
  missing: string[];
  extra: string[];
  details: string;
}

interface Match {
  start: number;
  end: number;
  value: string;
  pattern: string;
}

function findAllMatches(
  text: string,
  patterns: PlaceholderPattern[],
): Match[] {
  const matches: Match[] = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        value: m[0],
        pattern: pattern.name,
      });
    }
  }

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const resolved: Match[] = [];
  for (const match of matches) {
    const overlaps = resolved.some(
      (r) => match.start < r.end && match.end > r.start,
    );
    if (!overlaps) {
      resolved.push(match);
    }
  }

  return resolved.sort((a, b) => a.start - b.start);
}

export function shield(
  text: string,
  patterns: PlaceholderPattern[] = DEFAULT_PATTERNS,
): ShieldResult {
  const matches = findAllMatches(text, patterns);
  const tokens = new Map<string, string>();

  if (matches.length === 0) {
    return { shielded: text, tokens };
  }

  let shielded = "";
  let cursor = 0;
  let counter = 1;

  for (const match of matches) {
    shielded += text.slice(cursor, match.start);
    const token = `__PH_${counter}__`;
    tokens.set(token, match.value);
    shielded += token;
    cursor = match.end;
    counter++;
  }

  shielded += text.slice(cursor);

  return { shielded, tokens };
}

export function restore(
  shielded: string,
  tokens: Map<string, string>,
): string {
  let result = shielded;
  const unreplaced: string[] = [];

  for (const [token, original] of tokens) {
    if (result.includes(token)) {
      result = result.replaceAll(token, original);
    } else {
      unreplaced.push(token);
    }
  }

  if (unreplaced.length > 0) {
    console.warn(
      `[koto] Warning: ${unreplaced.length} placeholder token(s) not found in translated text: ${unreplaced.join(", ")}`,
    );
  }

  return result;
}

function extractPlaceholders(
  text: string,
  patterns: PlaceholderPattern[],
): string[] {
  return findAllMatches(text, patterns).map((m) => m.value);
}

export function validate(
  source: string,
  translated: string,
  patterns: PlaceholderPattern[] = DEFAULT_PATTERNS,
): PlaceholderValidation {
  const sourcePlaceholders = extractPlaceholders(source, patterns);
  const translatedPlaceholders = extractPlaceholders(translated, patterns);

  const sourceSet = new Map<string, number>();
  for (const p of sourcePlaceholders) {
    sourceSet.set(p, (sourceSet.get(p) ?? 0) + 1);
  }

  const translatedSet = new Map<string, number>();
  for (const p of translatedPlaceholders) {
    translatedSet.set(p, (translatedSet.get(p) ?? 0) + 1);
  }

  const missing: string[] = [];
  for (const [p, count] of sourceSet) {
    const tCount = translatedSet.get(p) ?? 0;
    for (let i = 0; i < count - tCount; i++) {
      missing.push(p);
    }
  }

  const extra: string[] = [];
  for (const [p, count] of translatedSet) {
    const sCount = sourceSet.get(p) ?? 0;
    for (let i = 0; i < count - sCount; i++) {
      extra.push(p);
    }
  }

  const valid = missing.length === 0 && extra.length === 0;
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing: ${missing.join(", ")}`);
  if (extra.length > 0) parts.push(`extra: ${extra.join(", ")}`);
  const details = valid ? "All placeholders preserved" : parts.join("; ");

  return { valid, missing, extra, details };
}

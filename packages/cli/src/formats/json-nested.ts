import type { FileFormat, ParsedTranslations } from "./base.js";

function flatten(
  obj: unknown,
  prefix: string,
  result: Map<string, string>,
): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === "string") {
    result.set(prefix, obj);
    return;
  }
  if (typeof obj === "number" || typeof obj === "boolean") return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      flatten(obj[i], prefix ? `${prefix}.${i}` : String(i), result);
    }
    return;
  }
  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, result);
    }
  }
}

function setNested(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextIndex = /^\d+$/.test(nextPart);
    if (!(part in current)) {
      current[part] = isNextIndex ? [] : {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function detectIndent(content: string): string {
  const match = content.match(/^(\s+)/m);
  return match ? match[1] : "  ";
}

function rebuildFromOriginal(
  original: unknown,
  translations: Map<string, string>,
  prefix: string,
): unknown {
  if (original === null || original === undefined) return original;
  if (typeof original === "string") {
    return translations.get(prefix) ?? original;
  }
  if (typeof original === "number" || typeof original === "boolean") return original;
  if (Array.isArray(original)) {
    return original.map((item, i) =>
      rebuildFromOriginal(item, translations, prefix ? `${prefix}.${i}` : String(i)),
    );
  }
  if (typeof original === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(original as Record<string, unknown>)) {
      result[key] = rebuildFromOriginal(
        value,
        translations,
        prefix ? `${prefix}.${key}` : key,
      );
    }
    return result;
  }
  return original;
}

export const jsonNestedFormat: FileFormat = {
  name: "json-nested",
  extensions: [".json"],

  parse(content: string): ParsedTranslations {
    const data = JSON.parse(content);
    const keys = new Map<string, string>();
    flatten(data, "", keys);
    return { keys };
  },

  serialize(keys: Map<string, string>, original?: string): string {
    if (original) {
      const indent = detectIndent(original);
      const parsed = JSON.parse(original);
      const rebuilt = rebuildFromOriginal(parsed, keys, "");
      return JSON.stringify(rebuilt, null, indent) + "\n";
    }

    const obj: Record<string, unknown> = {};
    for (const [key, value] of keys) {
      setNested(obj, key, value);
    }
    return JSON.stringify(obj, null, 2) + "\n";
  },
};

import type { FileFormat, ParsedTranslations } from "./base.js";

function detectIndent(content: string): string {
  const match = content.match(/^(\s+)/m);
  return match ? match[1] : "  ";
}

export const jsonFlatFormat: FileFormat = {
  name: "json-flat",
  extensions: [".json"],

  parse(content: string): ParsedTranslations {
    const data = JSON.parse(content) as Record<string, unknown>;
    const keys = new Map<string, string>();
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        keys.set(key, value);
      }
    }
    return { keys };
  },

  serialize(keys: Map<string, string>, original?: string): string {
    const indent = original ? detectIndent(original) : "  ";
    const obj: Record<string, string> = {};

    if (original) {
      const parsed = JSON.parse(original) as Record<string, unknown>;
      for (const key of Object.keys(parsed)) {
        if (keys.has(key)) {
          obj[key] = keys.get(key)!;
        }
      }
      for (const [key, value] of keys) {
        if (!(key in obj)) {
          obj[key] = value;
        }
      }
    } else {
      for (const [key, value] of keys) {
        obj[key] = value;
      }
    }

    return JSON.stringify(obj, null, indent) + "\n";
  },
};

import type { FileFormat, ParsedTranslations } from "./base.js";

function extractObjectLiteral(content: string): string | null {
  // Match export default { ... } as const; or export default { ... };
  // or export const <name> = { ... } as const; or export const <name> = { ... };
  const patterns = [
    /export\s+default\s+(\{[\s\S]*?\})\s*(?:as\s+const\s*)?;?/,
    /export\s+(?:const|let|var)\s+\w+\s*=\s*(\{[\s\S]*?\})\s*(?:as\s+const\s*)?;?/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function parseObjectLiteral(literal: string): Map<string, string> {
  const keys = new Map<string, string>();

  // Normalize: remove trailing commas before closing braces, handle single quotes
  const normalized = literal
    .replace(/,(\s*[}\]])/g, "$1"); // remove trailing commas

  // Simple recursive parser for nested object literals
  parseNestedObject(normalized, "", keys);

  return keys;
}

function parseNestedObject(source: string, prefix: string, keys: Map<string, string>): void {
  // Strip outer braces
  const trimmed = source.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return;
  const inner = trimmed.slice(1, -1);

  // Tokenize key-value pairs at current nesting level
  let depth = 0;
  let current = "";
  const pairs: string[] = [];

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      pairs.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) pairs.push(current.trim());

  for (const pair of pairs) {
    if (!pair) continue;
    // Match key: value
    const keyMatch = pair.match(/^(?:["']([^"']+)["']|(\w+))\s*:\s*([\s\S]*)$/);
    if (!keyMatch) continue;

    const key = keyMatch[1] ?? keyMatch[2];
    const valuePart = keyMatch[3].trim();
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (valuePart.startsWith("{")) {
      // Find matching closing brace
      let braceDepth = 0;
      let end = 0;
      for (let i = 0; i < valuePart.length; i++) {
        if (valuePart[i] === "{") braceDepth++;
        else if (valuePart[i] === "}") {
          braceDepth--;
          if (braceDepth === 0) { end = i; break; }
        }
      }
      parseNestedObject(valuePart.slice(0, end + 1), fullKey, keys);
    } else {
      // Extract string value
      const strMatch = valuePart.match(/^["'`]([\s\S]*?)["'`]/);
      if (strMatch) {
        keys.set(fullKey, strMatch[1]);
      }
    }
  }
}

function setNested(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function serializeValue(value: unknown, indent: number): string {
  const pad = " ".repeat(indent);
  const innerPad = " ".repeat(indent + 2);

  if (typeof value === "string") {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
    return `"${escaped}"`;
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";

    const lines = entries.map(([k, v]) => {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `"${k}"`;
      return `${innerPad}${safeKey}: ${serializeValue(v, indent + 2)}`;
    });

    return `{\n${lines.join(",\n")},\n${pad}}`;
  }

  return String(value);
}

export const typescriptFormat: FileFormat = {
  name: "typescript",
  extensions: [".ts", ".js"],

  parse(content: string): ParsedTranslations {
    const literal = extractObjectLiteral(content);
    if (!literal) {
      return { keys: new Map() };
    }
    const keys = parseObjectLiteral(literal);
    return { keys };
  },

  serialize(keys: Map<string, string>, _original?: string): string {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of keys) {
      setNested(obj, key, value);
    }

    const body = serializeValue(obj, 0);
    return `export default ${body} as const;\n`;
  },
};

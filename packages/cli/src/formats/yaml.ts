import type { FileFormat, ParsedTranslations } from "./base.js";

interface YamlLine {
  raw: string;
  indent: number;
  key?: string;
  value?: string;
  isComment: boolean;
  isBlank: boolean;
  blockScalar?: "|" | ">";
}

function parseLine(raw: string): YamlLine {
  if (raw.trim() === "") return { raw, indent: 0, isComment: false, isBlank: true };
  const indent = raw.search(/\S/);
  const trimmed = raw.trim();

  if (trimmed.startsWith("#")) {
    return { raw, indent, isComment: true, isBlank: false };
  }

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex === -1) {
    return { raw, indent, isComment: false, isBlank: false };
  }

  const key = trimmed.slice(0, colonIndex).trim();
  const rest = trimmed.slice(colonIndex + 1).trim();

  if (rest === "" || rest === "|" || rest === ">") {
    return {
      raw,
      indent,
      key,
      isComment: false,
      isBlank: false,
      blockScalar: rest === "|" ? "|" : rest === ">" ? ">" : undefined,
    };
  }

  return { raw, indent, key, value: unquoteYaml(rest), isComment: false, isBlank: false };
}

function unquoteYaml(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    const inner = s.slice(1, -1);
    if (s.startsWith('"')) {
      return inner.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\").replace(/\\"/g, '"');
    }
    return inner.replace(/''/g, "'");
  }
  return s;
}

function quoteYaml(s: string): string {
  if (s.includes("\n") || s.includes('"') || s.includes("\\") || s.includes(": ") || s.includes("#") || s.startsWith(" ") || s.endsWith(" ") || s === "" || /^[{[\]%@&*!|>'",?-]/.test(s) || s === "true" || s === "false" || s === "null" || s === "yes" || s === "no" || !isNaN(Number(s))) {
    const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t");
    return `"${escaped}"`;
  }
  return s;
}

function parseYamlToMap(content: string): Map<string, string> {
  const lines = content.split("\n");
  const keys = new Map<string, string>();
  const pathStack: { indent: number; key: string }[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = parseLine(lines[i]);

    if (line.isBlank || line.isComment) {
      i++;
      continue;
    }

    if (!line.key) {
      i++;
      continue;
    }

    // Pop stack to find parent
    while (pathStack.length > 0 && pathStack[pathStack.length - 1].indent >= line.indent) {
      pathStack.pop();
    }

    const fullKey = pathStack.length > 0
      ? `${pathStack.map((p) => p.key).join(".")}.${line.key}`
      : line.key;

    if (line.blockScalar) {
      // Collect block scalar lines
      const scalarIndent = line.indent + 2;
      const parts: string[] = [];
      i++;
      while (i < lines.length) {
        const raw = lines[i];
        if (raw.trim() === "") {
          parts.push("");
          i++;
          continue;
        }
        const ind = raw.search(/\S/);
        if (ind < scalarIndent) break;
        parts.push(raw.slice(scalarIndent));
        i++;
      }
      // Remove trailing empty lines
      while (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
      const joiner = line.blockScalar === "|" ? "\n" : " ";
      keys.set(fullKey, parts.join(joiner));
      continue;
    }

    if (line.value !== undefined) {
      // Check if it's an array (next lines start with "- ")
      keys.set(fullKey, line.value);
      i++;
      continue;
    }

    // Check if next non-blank line is an array item
    let nextIdx = i + 1;
    while (nextIdx < lines.length && lines[nextIdx].trim() === "") nextIdx++;
    if (nextIdx < lines.length && lines[nextIdx].trim().startsWith("- ")) {
      // Array items
      const arrayIndent = lines[nextIdx].search(/\S/);
      let arrIndex = 0;
      i = nextIdx;
      while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (trimmed === "") { i++; continue; }
        const ind = lines[i].search(/\S/);
        if (ind < arrayIndent) break;
        if (!trimmed.startsWith("- ")) break;
        const itemValue = unquoteYaml(trimmed.slice(2).trim());
        keys.set(`${fullKey}.${arrIndex}`, itemValue);
        arrIndex++;
        i++;
      }
      continue;
    }

    // It's a parent key, push to stack
    pathStack.push({ indent: line.indent, key: line.key });
    i++;
  }

  return keys;
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

function serializeYamlValue(key: string, value: unknown, indent: number): string {
  const pad = " ".repeat(indent);
  if (typeof value === "string") {
    if (value.includes("\n")) {
      const lines = value.split("\n");
      return `${pad}${key}: |\n${lines.map((l) => `${pad}  ${l}`).join("\n")}\n`;
    }
    return `${pad}${key}: ${quoteYaml(value)}\n`;
  }
  if (Array.isArray(value)) {
    let out = `${pad}${key}:\n`;
    for (const item of value) {
      if (typeof item === "string") {
        out += `${pad}  - ${quoteYaml(item)}\n`;
      }
    }
    return out;
  }
  if (typeof value === "object" && value !== null) {
    let out = `${pad}${key}:\n`;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out += serializeYamlValue(k, v, indent + 2);
    }
    return out;
  }
  return `${pad}${key}: ${String(value)}\n`;
}

function serializeYaml(keys: Map<string, string>): string {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of keys) {
    setNested(obj, key, value);
  }
  let output = "";
  for (const [key, value] of Object.entries(obj)) {
    output += serializeYamlValue(key, value, 0);
  }
  return output;
}

export const yamlFormat: FileFormat = {
  name: "yaml",
  extensions: [".yml", ".yaml"],

  parse(content: string): ParsedTranslations {
    const keys = parseYamlToMap(content);
    return { keys };
  },

  serialize(keys: Map<string, string>, original?: string): string {
    if (original) {
      // Try to preserve structure: parse original, replace values, re-serialize
      const originalKeys = parseYamlToMap(original);
      const merged = new Map(originalKeys);
      for (const [key, value] of keys) {
        merged.set(key, value);
      }
      return serializeYaml(merged);
    }
    return serializeYaml(keys);
  },
};

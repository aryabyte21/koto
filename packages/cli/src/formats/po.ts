import type { FileFormat, ParsedTranslations } from "./base.js";

interface PoEntry {
  comments: string[];
  msgctxt?: string;
  msgid: string;
  msgstr: string;
}

function parseMultilineString(lines: string[], startIndex: number): { value: string; nextIndex: number } {
  let value = "";
  let i = startIndex;

  // First line may have the value on the same line as the keyword
  const firstLine = lines[i].trim();
  const quoteStart = firstLine.indexOf('"');
  if (quoteStart !== -1) {
    value += extractQuotedString(firstLine.slice(quoteStart));
  }
  i++;

  // Continuation lines are just quoted strings
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('"')) {
      value += extractQuotedString(trimmed);
      i++;
    } else {
      break;
    }
  }

  return { value, nextIndex: i };
}

function extractQuotedString(s: string): string {
  const match = s.match(/^"((?:[^"\\]|\\.)*)"/);
  if (!match) return "";
  return unescapePo(match[1]);
}

function unescapePo(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function escapePo(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n");
}

function parsePoEntries(content: string): PoEntry[] {
  const lines = content.split("\n");
  const entries: PoEntry[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Skip blank lines
    if (trimmed === "") {
      i++;
      continue;
    }

    // Collect comments
    const comments: string[] = [];
    while (i < lines.length && lines[i].trim().startsWith("#")) {
      comments.push(lines[i]);
      i++;
    }

    if (i >= lines.length) {
      // Trailing comments with no entry
      if (comments.length > 0) {
        entries.push({ comments, msgid: "", msgstr: "" });
      }
      break;
    }

    // Parse msgctxt if present
    let msgctxt: string | undefined;
    if (lines[i]?.trim().startsWith("msgctxt ")) {
      const result = parseMultilineString(lines, i);
      msgctxt = result.value;
      i = result.nextIndex;
    }

    // Parse msgid
    if (i < lines.length && lines[i]?.trim().startsWith("msgid ")) {
      const idResult = parseMultilineString(lines, i);
      i = idResult.nextIndex;

      // Parse msgstr
      if (i < lines.length && lines[i]?.trim().startsWith("msgstr ")) {
        const strResult = parseMultilineString(lines, i);
        i = strResult.nextIndex;

        entries.push({
          comments,
          msgctxt,
          msgid: idResult.value,
          msgstr: strResult.value,
        });
      } else {
        entries.push({
          comments,
          msgctxt,
          msgid: idResult.value,
          msgstr: "",
        });
      }
    } else {
      i++;
    }
  }

  return entries;
}

function entryKey(entry: PoEntry): string {
  if (entry.msgctxt) {
    return `${entry.msgctxt}\x04${entry.msgid}`;
  }
  return entry.msgid;
}

function formatPoString(keyword: string, value: string): string {
  const escaped = escapePo(value);
  // For multiline or long strings, use continuation format
  if (escaped.includes("\\n") && escaped.length > 70) {
    const parts = escaped.split("\\n");
    let result = `${keyword} ""\n`;
    for (let i = 0; i < parts.length; i++) {
      const suffix = i < parts.length - 1 ? "\\n" : "";
      const part = parts[i] + suffix;
      if (part) {
        result += `"${part}"\n`;
      }
    }
    return result.trimEnd();
  }
  return `${keyword} "${escaped}"`;
}

function serializePo(entries: PoEntry[]): string {
  const parts: string[] = [];

  for (const entry of entries) {
    const lines: string[] = [];

    for (const comment of entry.comments) {
      lines.push(comment);
    }

    if (entry.msgctxt !== undefined) {
      lines.push(formatPoString("msgctxt", entry.msgctxt));
    }

    lines.push(formatPoString("msgid", entry.msgid));
    lines.push(formatPoString("msgstr", entry.msgstr));

    parts.push(lines.join("\n"));
  }

  return parts.join("\n\n") + "\n";
}

export const poFormat: FileFormat = {
  name: "po",
  extensions: [".po", ".pot"],

  parse(content: string): ParsedTranslations {
    const entries = parsePoEntries(content);
    const keys = new Map<string, string>();
    const meta: Record<string, unknown> = { entries };

    for (const entry of entries) {
      // Skip header entry (empty msgid)
      if (entry.msgid === "") continue;

      const key = entryKey(entry);
      keys.set(key, entry.msgstr);
    }

    return { keys, meta };
  },

  serialize(keys: Map<string, string>, original?: string): string {
    if (original) {
      // Preserve original structure, just update msgstr values
      const entries = parsePoEntries(original);
      for (const entry of entries) {
        if (entry.msgid === "") continue;
        const key = entryKey(entry);
        if (keys.has(key)) {
          entry.msgstr = keys.get(key)!;
        }
      }
      // Add any new keys not in original
      const existingKeys = new Set(entries.filter((e) => e.msgid !== "").map(entryKey));
      for (const [key, value] of keys) {
        if (!existingKeys.has(key)) {
          const ctxSep = key.indexOf("\x04");
          if (ctxSep !== -1) {
            entries.push({
              comments: [],
              msgctxt: key.slice(0, ctxSep),
              msgid: key.slice(ctxSep + 1),
              msgstr: value,
            });
          } else {
            entries.push({
              comments: [],
              msgid: key,
              msgstr: value,
            });
          }
        }
      }
      return serializePo(entries);
    }

    // Build entries from scratch
    const entries: PoEntry[] = [];
    for (const [key, value] of keys) {
      const ctxSep = key.indexOf("\x04");
      if (ctxSep !== -1) {
        entries.push({
          comments: [],
          msgctxt: key.slice(0, ctxSep),
          msgid: key.slice(ctxSep + 1),
          msgstr: value,
        });
      } else {
        entries.push({
          comments: [],
          msgid: key,
          msgstr: value,
        });
      }
    }

    return serializePo(entries);
  },
};

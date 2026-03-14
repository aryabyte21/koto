import { logger } from "../utils/logger.js";

const NUMBERED_LINE = /^(\d+)[\.\)\:\-]\s*/;

/**
 * Parses a numbered response from an LLM.
 * Handles multiline translations (continuation lines without a number prefix).
 * Strips spurious quotes that LLMs sometimes wrap translations in.
 */
export function parseNumberedResponse(
  text: string,
  keys: string[],
): Map<string, string> {
  const result = new Map<string, string>();
  const lines = text.split("\n");

  let currentIndex = -1;
  let currentValue = "";

  const flush = () => {
    if (currentIndex >= 0 && currentIndex < keys.length) {
      result.set(keys[currentIndex], stripQuotes(currentValue.trim()));
    }
  };

  for (const line of lines) {
    const match = line.match(NUMBERED_LINE);
    if (match) {
      flush();
      currentIndex = parseInt(match[1], 10) - 1;
      currentValue = line.slice(match[0].length);
    } else if (currentIndex >= 0 && line.trim()) {
      // Continuation line — append to current translation
      currentValue += "\n" + line;
    }
  }
  flush();

  if (result.size !== keys.length) {
    logger.warn(
      `Expected ${keys.length} translations but got ${result.size}. ` +
      `Missing keys: ${keys.filter((k) => !result.has(k)).join(", ")}`,
    );
  }

  return result;
}

function stripQuotes(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith("\u201C") && s.endsWith("\u201D"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

export function formatUserMessage(strings: Map<string, string>): string {
  const entries = Array.from(strings.values());
  return entries.map((v, i) => `${i + 1}. ${v}`).join("\n");
}

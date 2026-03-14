import { logger } from "../utils/logger.js";

/**
 * Parses a numbered response from an LLM.
 * Handles multiple formats: "1. text", "1) text", "1: text"
 * Warns when expected count doesn't match returned count.
 */
export function parseNumberedResponse(
  text: string,
  keys: string[],
): Map<string, string> {
  const result = new Map<string, string>();
  const lines = text.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    // Match "1. text", "1) text", "1: text", "1 - text"
    const match = line.match(/^(\d+)[\.\)\:\-]\s*(.+)$/);
    if (match) {
      const index = parseInt(match[1], 10) - 1;
      if (index >= 0 && index < keys.length) {
        result.set(keys[index], match[2].trim());
      }
    }
  }

  if (result.size !== keys.length) {
    logger.warn(
      `Expected ${keys.length} translations but got ${result.size}. ` +
      `Missing keys: ${keys.filter((k) => !result.has(k)).join(", ")}`,
    );
  }

  return result;
}

export function formatUserMessage(strings: Map<string, string>): string {
  const entries = Array.from(strings.values());
  return entries.map((v, i) => `${i + 1}. ${v}`).join("\n");
}

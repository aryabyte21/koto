import { getLanguageName } from "../../utils/language.js";
import type { ResolvedContext } from "./index.js";

export function buildSystemPrompt(
  context: ResolvedContext,
  sourceLocale: string,
  targetLocale: string
): string {
  const sourceName = getLanguageName(sourceLocale);
  const targetName = getLanguageName(targetLocale);

  const lines: string[] = [
    `You are a professional translator. Translate from ${sourceLocale} (${sourceName}) to ${targetLocale} (${targetName}).`,
    "",
    `Tone: ${context.tone}`,
  ];

  if (context.instructions) {
    lines.push("", context.instructions);
  }

  if (context.glossaryTerms && Object.keys(context.glossaryTerms).length > 0) {
    lines.push(
      "",
      "Glossary — use these exact translations for the following terms:"
    );
    for (const [term, translation] of Object.entries(context.glossaryTerms)) {
      lines.push(`- ${term} = ${translation}`);
    }
  }

  lines.push(
    "",
    "Rules:",
    "- Translate ONLY the text content. Do not translate placeholders marked as __PH_N__.",
    "- Preserve all formatting (newlines, markdown, HTML tags).",
    "- Return translations in the exact same numbered format as the input.",
    "- Do not add explanations or notes."
  );

  return lines.join("\n");
}

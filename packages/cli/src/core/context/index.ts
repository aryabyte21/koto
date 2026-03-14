export interface ContextConfig {
  tone?: string;
  instructions?: string;
  glossary?: string;
  files?: string[];
}

export interface ResolvedContext {
  name: string;
  tone: string;
  instructions: string;
  glossaryPath?: string;
  glossaryTerms?: Record<string, string>;
}

export function resolveContext(
  filePath: string,
  contexts: Record<string, ContextConfig>
): ResolvedContext {
  for (const [name, ctx] of Object.entries(contexts)) {
    if (name === "default") continue;
    if (!ctx.files?.length) continue;

    for (const pattern of ctx.files) {
      if (matchPattern(pattern, filePath)) {
        return {
          name,
          tone: ctx.tone ?? "neutral",
          instructions: ctx.instructions ?? "",
          glossaryPath: ctx.glossary,
        };
      }
    }
  }

  const defaultCtx = contexts["default"];
  if (defaultCtx) {
    return {
      name: "default",
      tone: defaultCtx.tone ?? "neutral",
      instructions: defaultCtx.instructions ?? "",
      glossaryPath: defaultCtx.glossary,
    };
  }

  return {
    name: "default",
    tone: "neutral",
    instructions: "",
  };
}

function matchPattern(pattern: string, filePath: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\[locale\]/g, "[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?")
    .replace(/\*/g, "[^/]*");
  return new RegExp(regexStr).test(filePath);
}

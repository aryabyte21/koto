import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createJiti } from "jiti";
import { ZodError } from "zod";
import { kotoConfigSchema, type KotoConfig, type ResolvedConfig } from "./schema.js";
import { defaults, DEFAULT_MODEL_BY_PROVIDER } from "./defaults.js";

const CONFIG_FILES = [
  "koto.config.ts",
  "koto.config.js",
  "koto.config.json",
];

export function findConfigFile(cwd: string = process.cwd()): string | null {
  for (const file of CONFIG_FILES) {
    const filePath = join(cwd, file);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

async function loadRawConfig(configPath: string): Promise<unknown> {
  if (configPath.endsWith(".json")) {
    let content: string;
    try {
      content = await readFile(configPath, "utf-8");
    } catch (err) {
      throw new Error(
        `Could not read config file at ${configPath}: ${(err as Error).message}`,
      );
    }
    try {
      return JSON.parse(content);
    } catch (err) {
      throw new Error(
        `Config file has a syntax error (${configPath}): ${(err as Error).message}`,
      );
    }
  }

  try {
    const jiti = createJiti(configPath, { interopDefault: true });
    const mod = await jiti.import(configPath);
    return (mod as Record<string, unknown>).default ?? mod;
  } catch (err) {
    throw new Error(
      `Failed to load config file (${configPath}). Check for syntax errors: ${(err as Error).message}`,
    );
  }
}

function resolveDefaults(parsed: KotoConfig): ResolvedConfig {
  const providerName = parsed.provider.name;
  const model =
    parsed.provider.model ??
    DEFAULT_MODEL_BY_PROVIDER[providerName] ??
    providerName;

  return {
    sourceLocale: parsed.sourceLocale ?? defaults.sourceLocale,
    targetLocales: parsed.targetLocales,
    files: parsed.files,
    provider: {
      name: providerName,
      model,
      ...(parsed.provider.apiKey && { apiKey: parsed.provider.apiKey }),
      ...(parsed.provider.baseUrl && { baseUrl: parsed.provider.baseUrl }),
    },
    contexts: parsed.contexts ?? defaults.contexts,
    typegen: {
      enabled: parsed.typegen?.enabled ?? defaults.typegen.enabled,
      ...(parsed.typegen?.outputPath && {
        outputPath: parsed.typegen.outputPath,
      }),
    },
    quality: {
      enabled: parsed.quality?.enabled ?? defaults.quality.enabled,
      minScore: parsed.quality?.minScore ?? defaults.quality.minScore,
    },
    batch: {
      size: parsed.batch?.size ?? defaults.batch.size,
      concurrency: parsed.batch?.concurrency ?? defaults.batch.concurrency,
    },
  };
}

export async function loadConfig(
  cwd: string = process.cwd()
): Promise<ResolvedConfig> {
  const configPath = findConfigFile(cwd);

  if (!configPath) {
    throw new Error(
      `No config file found. Create a koto.config.ts in ${resolve(cwd)}`
    );
  }

  const raw = await loadRawConfig(configPath);

  let parsed: KotoConfig;
  try {
    parsed = kotoConfigSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => {
        const path = i.path.length > 0 ? `  ${i.path.join('.')}: ` : '  ';
        return `${path}${i.message}`;
      });
      throw new Error(`Invalid config (${configPath}):\n${issues.join('\n')}`);
    }
    throw err;
  }

  return resolveDefaults(parsed);
}

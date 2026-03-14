import { z } from "zod";

const providerNameSchema = z.enum([
  "openai",
  "anthropic",
  "google",
  "ollama",
  "custom",
]);

const providerSchema = z.object({
  name: providerNameSchema,
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

const contextSchema = z.object({
  tone: z.string().optional(),
  instructions: z.string().optional(),
  glossary: z.string().optional(),
  files: z.array(z.string()).optional(),
});

const typegenSchema = z.object({
  enabled: z.boolean().optional(),
  outputPath: z.string().optional(),
});

const qualitySchema = z.object({
  enabled: z.boolean().optional(),
  minScore: z.number().min(0).max(1).optional(),
});

const batchSchema = z.object({
  size: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
});

export const kotoConfigSchema = z.object({
  sourceLocale: z.string().default("en"),
  targetLocales: z.array(z.string()),
  files: z.array(z.string()),
  provider: providerSchema,
  contexts: z.record(z.string(), contextSchema).optional(),
  typegen: typegenSchema.optional(),
  quality: qualitySchema.optional(),
  batch: batchSchema.optional(),
});

export type KotoConfig = z.input<typeof kotoConfigSchema>;

export type ResolvedConfig = {
  sourceLocale: string;
  targetLocales: string[];
  files: string[];
  provider: {
    name: z.infer<typeof providerNameSchema>;
    model: string;
    apiKey?: string;
    baseUrl?: string;
  };
  contexts: Record<
    string,
    {
      tone?: string;
      instructions?: string;
      glossary?: string;
      files?: string[];
    }
  >;
  typegen: {
    enabled: boolean;
    outputPath?: string;
  };
  quality: {
    enabled: boolean;
    minScore: number;
  };
  batch: {
    size: number;
    concurrency: number;
  };
};

export function defineConfig(config: KotoConfig): KotoConfig {
  return config;
}

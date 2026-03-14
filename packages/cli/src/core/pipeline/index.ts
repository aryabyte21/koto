import { createHash } from 'node:crypto';
import type { ResolvedConfig } from '../config/schema.js';
import type { Provider, TranslationBatch, TranslationResult } from '../../providers/base.js';
import type { FileFormat, ParsedTranslations } from '../../formats/base.js';
import { resolveContext } from '../context/index.js';
import { buildSystemPrompt } from '../context/prompt.js';
import { loadGlossary } from '../context/glossary.js';
import { shield, restore, validate as validatePlaceholders } from '../placeholders/shield.js';
import { DEFAULT_PATTERNS } from '../placeholders/patterns.js';
import { hashString } from '../cache/hasher.js';
import { readLockfile, writeLockfile, diffLockfile, seedLockfileFromExisting } from '../cache/lockfile.js';
import { scoreTranslation } from '../quality/scorer.js';
import { getFormat } from '../../formats/registry.js';
import { createProvider } from '../../providers/registry.js';
import { readFile, writeFile, resolveGlob } from '../../utils/fs.js';
import { getLanguageName, getLanguageFlag } from '../../utils/language.js';
import { estimateCost } from '../../utils/cost.js';
import { logger } from '../../utils/logger.js';
import path from 'node:path';

export interface PipelineCallbacks {
  onFileStart?: (filePath: string, locale: string, totalKeys: number) => void;
  onBatchComplete?: (filePath: string, locale: string, translated: number, total: number) => void;
  onFileComplete?: (filePath: string, locale: string) => void;
  onLocaleComplete?: (locale: string, stats: LocaleStats) => void;
  onQualityIssue?: (key: string, locale: string, issue: string) => void;
}

export interface LocaleStats {
  translated: number;
  cached: number;
  total: number;
  issues: number;
}

export interface PipelineResult {
  locales: Record<string, LocaleStats>;
  totalKeys: number;
  totalTranslated: number;
  totalCached: number;
  totalIssues: number;
  costUsd: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

export interface PipelineOptions {
  dryRun?: boolean;
  force?: boolean;
  locales?: string[];
  context?: string;
  callbacks?: PipelineCallbacks;
}

export async function runPipeline(
  config: ResolvedConfig,
  cwd: string,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const startTime = Date.now();
  const provider = createProvider(config.provider);
  const lockfile = await readLockfile(cwd);

  const targetLocales = options.locales ?? config.targetLocales;
  const result: PipelineResult = {
    locales: {},
    totalKeys: 0,
    totalTranslated: 0,
    totalCached: 0,
    totalIssues: 0,
    costUsd: 0,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  // Resolve all source files from config patterns
  const sourceFiles = await resolveSourceFiles(config, cwd);

  // Seed lockfile from existing translations for any locale not yet tracked
  if (!options.force) {
    let totalSeeded = 0;
    for (const sourceFile of sourceFiles) {
      const fileEntries = lockfile.entries[sourceFile.path] ?? {};

      for (const locale of targetLocales) {
        // Check if this locale already has ANY entries in the lockfile for this file
        const localeAlreadySeeded = Object.values(fileEntries).some(
          (entry) => entry.translations[locale],
        );
        if (localeAlreadySeeded) continue;

        // This locale has no entries — seed from existing target file
        const targetPath = sourceFile.path.replace('[locale]', locale);
        const targetAbsolute = path.resolve(cwd, targetPath);
        try {
          const format = getFormat(sourceFile.path);
          const sourceContent = await readFile(sourceFile.absolutePath);
          const sourceKeys = format.parse(sourceContent).keys;
          const targetContent = await readFile(targetAbsolute);
          const targetKeys = format.parse(targetContent).keys;
          totalSeeded += seedLockfileFromExisting(
            lockfile, sourceFile.path, sourceKeys, targetKeys, locale,
          );
        } catch {
          // Target file doesn't exist yet — nothing to seed
        }
      }
    }
    if (totalSeeded > 0) {
      logger.info(`Found ${totalSeeded} existing translations — added to lockfile.`);
      await writeLockfile(cwd, lockfile);
    }
  }

  // Validate --context filter if specified
  if (options.context) {
    const definedContexts = new Set(Object.keys(config.contexts ?? {}));
    if (!definedContexts.has('default')) definedContexts.add('default');
    if (!definedContexts.has(options.context)) {
      throw new Error(
        `Unknown context "${options.context}". Defined contexts: ${[...definedContexts].join(', ')}`,
      );
    }
  }

  for (const locale of targetLocales) {
    const localeStats: LocaleStats = { translated: 0, cached: 0, total: 0, issues: 0 };

    for (const sourceFile of sourceFiles) {
      const format = getFormat(sourceFile.path);
      const content = await readFile(sourceFile.absolutePath);
      let parsed;
      try {
        parsed = format.parse(content);
      } catch (err) {
        throw new Error(`Failed to parse ${sourceFile.absolutePath}: ${(err as Error).message}`);
      }
      const keys = parsed.keys;
      localeStats.total += keys.size;

      // Resolve context for this file
      const context = resolveContext(sourceFile.path, config.contexts ?? {});

      // If filtering by context, skip non-matching files
      if (options.context && context.name !== options.context) continue;

      // Load glossary if context has one
      if (context.glossaryPath) {
        const terms = await loadGlossary(
          path.resolve(cwd, context.glossaryPath),
          locale,
        );
        context.glossaryTerms = terms;
      }

      // Diff against lockfile to find what needs translation
      const diff = options.force
        ? { added: [...keys.keys()], changed: [], removed: [], unchanged: [] }
        : diffLockfile(lockfile, sourceFile.path, keys, [locale]);

      const keysToTranslate = [...diff.added, ...diff.changed];
      localeStats.cached += diff.unchanged.length;

      if (keysToTranslate.length === 0) continue;

      options.callbacks?.onFileStart?.(sourceFile.path, locale, keysToTranslate.length);

      if (options.dryRun) {
        localeStats.translated += keysToTranslate.length;
        continue;
      }

      // Shield placeholders
      const shieldedStrings = new Map<string, { shielded: string; tokens: Map<string, string> }>();
      for (const key of keysToTranslate) {
        const value = keys.get(key)!;
        const result = shield(value, DEFAULT_PATTERNS);
        shieldedStrings.set(key, result);
      }

      // Batch and translate
      const batches = createBatches(
        shieldedStrings,
        locale,
        config.sourceLocale,
        buildSystemPrompt(context, config.sourceLocale, locale),
        config.batch.size,
      );

      const targetFilePath = sourceFile.path.replace('[locale]', locale);

      // Read existing target file if it exists
      const targetAbsolute = path.resolve(cwd, targetFilePath);
      let existingContent: string | undefined;
      try {
        existingContent = await readFile(targetAbsolute);
      } catch {
        // File doesn't exist yet
      }

      const existingParsed = existingContent ? format.parse(existingContent) : undefined;
      const translatedKeys = new Map<string, string>(existingParsed?.keys ?? new Map());

      let actualTranslatedCount = 0;

      const processBatch = async (batch: TranslationBatch) => {
        // Bug 2: Retry logic with exponential backoff
        let batchResult: TranslationResult | undefined;
        const MAX_RETRIES = 3;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            batchResult = await provider.translate(batch);
            break;
          } catch (err) {
            const msg = (err as Error).message ?? '';
            const isNonRetryable = /401|403|auth|unauthorized|forbidden/i.test(msg);
            if (!isNonRetryable && attempt < MAX_RETRIES - 1) {
              const delayMs = Math.pow(2, attempt) * 1000;
              logger.warn(
                `Provider failed for batch ${batch.id} (attempt ${attempt + 1}/${MAX_RETRIES}): ${msg}. Retrying in ${delayMs}ms...`,
              );
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            } else {
              throw new Error(
                `Provider failed for batch ${batch.id} after ${MAX_RETRIES} attempts: ${(err as Error).message}`,
              );
            }
          }
        }

        if (!batchResult) return;

        result.inputTokens += batchResult.usage?.inputTokens ?? 0;
        result.outputTokens += batchResult.usage?.outputTokens ?? 0;

        // Bug 3: Validate translation coverage — warn and fall back for missing keys
        const batchKeys = Array.from(batch.strings.keys());
        const missingKeys = batchKeys.filter((k) => !batchResult!.translations.has(k));
        if (missingKeys.length > 0) {
          logger.warn(
            `Provider did not return translations for ${missingKeys.length} key(s) in batch ${batch.id}: ${missingKeys.join(", ")}. Falling back to source text.`,
          );
          for (const key of missingKeys) {
            const sourceValue = keys.get(key);
            if (sourceValue) {
              batchResult.translations.set(key, sourceValue);
            }
          }
        }

        // Restore placeholders and validate
        for (const [key, translatedShielded] of batchResult.translations) {
          const shieldInfo = shieldedStrings.get(key);
          if (!shieldInfo) continue;

          const translated = restore(translatedShielded, shieldInfo.tokens);
          translatedKeys.set(key, translated);

          // Quality check
          const source = keys.get(key)!;
          const quality = scoreTranslation(source, translated, locale);

          // Bug 7: Enforce quality minScore
          const belowMinScore = config.quality.enabled && quality.score < config.quality.minScore;
          if (!quality.passed || belowMinScore) {
            if (belowMinScore && quality.passed) {
              // Score is below threshold but no errors — flag it
              localeStats.issues += 1;
              options.callbacks?.onQualityIssue?.(
                key,
                locale,
                `Translation score ${quality.score.toFixed(2)} is below minimum threshold ${config.quality.minScore}`,
              );
            }
            if (!quality.passed) {
              localeStats.issues += quality.issues.length;
              for (const issue of quality.issues) {
                options.callbacks?.onQualityIssue?.(key, locale, issue.message);
              }
            }
          }

          // Update lockfile entry
          if (!lockfile.entries[sourceFile.path]) {
            lockfile.entries[sourceFile.path] = {};
          }
          lockfile.entries[sourceFile.path][key] = {
            hash: hashString(source),
            translations: {
              ...lockfile.entries[sourceFile.path]?.[key]?.translations,
              [locale]: {
                hash: hashString(translated),
                at: new Date().toISOString(),
              },
            },
          };
        }

        // Bug 4: Track actual translated count instead of batch math
        actualTranslatedCount += batchResult.translations.size;
        localeStats.translated += batchResult.translations.size;

        options.callbacks?.onBatchComplete?.(
          sourceFile.path,
          locale,
          Math.min(actualTranslatedCount, keysToTranslate.length),
          keysToTranslate.length,
        );
      };

      // Bug 6: Implement concurrent batch processing
      const concurrency = config.batch.concurrency;
      for (let i = 0; i < batches.length; i += concurrency) {
        const chunk = batches.slice(i, i + concurrency);
        await Promise.all(chunk.map(processBatch));
      }

      // Write target file
      const output = format.serialize(translatedKeys, existingContent);
      await writeFile(targetAbsolute, output);

      options.callbacks?.onFileComplete?.(sourceFile.path, locale);
    }

    result.locales[locale] = localeStats;
    result.totalKeys += localeStats.total;
    result.totalTranslated += localeStats.translated;
    result.totalCached += localeStats.cached;
    result.totalIssues += localeStats.issues;

    options.callbacks?.onLocaleComplete?.(locale, localeStats);
  }

  // Write lockfile
  if (!options.dryRun) {
    await writeLockfile(cwd, lockfile);
  }

  result.costUsd = estimateCost(
    config.provider.model ?? 'gpt-4o-mini',
    result.inputTokens,
    result.outputTokens,
  );
  result.durationMs = Date.now() - startTime;

  return result;
}

interface SourceFile {
  path: string;        // relative pattern path (e.g., src/locales/[locale].json)
  absolutePath: string; // absolute path to source file
}

async function resolveSourceFiles(
  config: ResolvedConfig,
  cwd: string,
): Promise<SourceFile[]> {
  const files: SourceFile[] = [];

  for (const pattern of config.files) {
    const sourcePath = pattern.replace('[locale]', config.sourceLocale);
    const absolutePath = path.resolve(cwd, sourcePath);

    try {
      await readFile(absolutePath);
      files.push({ path: pattern, absolutePath });
    } catch {
      logger.warn(`Source file not found: ${sourcePath}`);
    }
  }

  return files;
}

function createBatches(
  strings: Map<string, { shielded: string; tokens: Map<string, string> }>,
  targetLocale: string,
  sourceLocale: string,
  systemPrompt: string,
  batchSize: number,
): TranslationBatch[] {
  const entries = [...strings.entries()];
  const batches: TranslationBatch[] = [];

  for (let i = 0; i < entries.length; i += batchSize) {
    const chunk = entries.slice(i, i + batchSize);
    const batchStrings = new Map<string, string>();
    for (const [key, { shielded }] of chunk) {
      batchStrings.set(key, shielded);
    }

    batches.push({
      id: `batch-${Math.floor(i / batchSize)}`,
      strings: batchStrings,
      sourceLocale,
      targetLocale,
      systemPrompt,
    });
  }

  return batches;
}

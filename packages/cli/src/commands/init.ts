import * as p from '@clack/prompts';
import pc from 'picocolors';
import { detectFramework } from '../core/detect/framework.js';
import { detectI18nLib } from '../core/detect/i18n-lib.js';
import { detectLocales } from '../core/detect/locales.js';
import { writeFile, fileExists } from '../utils/fs.js';
import { getLanguageFlag, getLanguageName } from '../utils/language.js';
import { printCompact } from '../ui/intro.js';
import path from 'node:path';
import { VERSION } from '../utils/version.js';

const COMMON_LOCALES = [
  'es', 'fr', 'de', 'ja', 'ko', 'pt-BR', 'zh-Hans', 'zh-Hant',
  'ar', 'it', 'nl', 'ru', 'pl', 'tr', 'th', 'vi', 'id', 'hi',
  'sv', 'da', 'fi', 'nb', 'uk', 'cs', 'ro', 'hu', 'el', 'he',
];

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', hint: 'gpt-4o-mini — fast & cheap' },
  { value: 'anthropic', label: 'Anthropic', hint: 'claude-sonnet — high quality' },
  { value: 'google', label: 'Google', hint: 'gemini-2.5-flash — fast & cheap' },
  { value: 'ollama', label: 'Ollama', hint: 'local, free, private' },
] as const;

export async function initCommand(cwd: string): Promise<void> {
  printCompact(VERSION);

  // Check if config already exists
  const configExists = await fileExists(path.resolve(cwd, 'koto.config.ts'));
  if (configExists) {
    const overwrite = await p.confirm({
      message: 'koto.config.ts already exists. Overwrite?',
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel('Init cancelled.');
      return;
    }
  }

  // Auto-detect framework
  const framework = await detectFramework(cwd);
  const i18nLib = await detectI18nLib(cwd);
  const existingLocales = await detectLocales(cwd);

  if (framework || i18nLib || existingLocales) {
    p.note(
      [
        framework ? `${pc.bold('Framework:')} ${framework.name}` : null,
        i18nLib ? `${pc.bold('i18n library:')} ${i18nLib.name}` : null,
        existingLocales
          ? `${pc.bold('Source:')} ${existingLocales.directory} (${existingLocales.sourceLocale}, ${[...new Set([...existingLocales.targetLocales])].map((l) => `${getLanguageFlag(l)} ${l}`).join(', ')})`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
      'Detected',
    );
  }

  // Provider selection
  const providerChoice = await p.select({
    message: 'Which LLM provider?',
    options: PROVIDERS.map((p) => ({
      value: p.value,
      label: `${p.label} ${pc.dim(`(${p.hint})`)}`,
    })),
  });

  if (p.isCancel(providerChoice)) {
    p.cancel('Init cancelled.');
    return;
  }

  // Target locales
  const suggestedLocales = existingLocales?.targetLocales ?? [];
  const allLocales = [...new Set([...suggestedLocales, ...COMMON_LOCALES])];

  const selectedLocales = await p.multiselect({
    message: 'Target locales? (space to toggle)',
    options: allLocales.map((code) => ({
      value: code,
      label: `${getLanguageFlag(code)}  ${code.padEnd(8)} ${pc.dim(getLanguageName(code))}`,
      hint: suggestedLocales.includes(code) ? 'existing' : undefined,
    })),
    initialValues: suggestedLocales.length > 0 ? suggestedLocales : ['es', 'fr'],
    required: true,
  });

  if (p.isCancel(selectedLocales)) {
    p.cancel('Init cancelled.');
    return;
  }

  // Determine file pattern
  const filePattern = existingLocales?.pattern
    ?? i18nLib?.localePathPattern
    ?? 'src/locales/[locale].json';

  // Generate config
  const sourceLocale = existingLocales?.sourceLocale ?? 'en';
  const config = generateConfig({
    sourceLocale,
    targetLocales: selectedLocales as string[],
    provider: providerChoice as string,
    files: [filePattern],
  });

  const configPath = path.resolve(cwd, 'koto.config.ts');
  await writeFile(configPath, config);

  // Create empty lockfile
  const lockPath = path.resolve(cwd, 'koto.lock');
  if (!(await fileExists(lockPath))) {
    await writeFile(lockPath, JSON.stringify({ version: 1, entries: {} }, null, 2) + '\n');
  }

  p.note(
    `${pc.green('Created')} koto.config.ts\n${pc.green('Created')} koto.lock`,
    'Setup complete',
  );

  // API key reminder
  const envVarMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
  };
  const envVar = envVarMap[providerChoice as string];
  if (envVar) {
    console.log(`  ${pc.dim('Set')} ${pc.cyan(envVar)} ${pc.dim('in your environment.')}`);
  }

  console.log(`  ${pc.dim('Run')} ${pc.cyan('npx koto')} ${pc.dim('to translate!')}\n`);
}

interface ConfigOptions {
  sourceLocale: string;
  targetLocales: string[];
  provider: string;
  files: string[];
}

function generateConfig(options: ConfigOptions): string {
  const locales = options.targetLocales
    .map((l) => `'${l}'`)
    .join(', ');

  return `import { defineConfig } from 'koto';

export default defineConfig({
  sourceLocale: '${options.sourceLocale}',
  targetLocales: [${locales}],
  provider: {
    name: '${options.provider}',
  },
  files: ['${options.files[0]}'],
});
`;
}

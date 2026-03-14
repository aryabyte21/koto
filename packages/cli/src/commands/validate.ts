import pc from 'picocolors';
import * as p from '@clack/prompts';
import { loadConfig } from '../core/config/loader.js';
import { createProvider } from '../providers/registry.js';
import { printCompact } from '../ui/intro.js';
import { getLanguageFlag, getLanguageName, isValidLocaleCode } from '../utils/language.js';

export async function validateCommand(cwd: string): Promise<void> {
  printCompact('0.1.0');

  const s = p.spinner();

  // Load config
  let config;
  try {
    config = await loadConfig(cwd);
    console.log(`  ${pc.green('✓')} Config loaded successfully\n`);
  } catch (err) {
    console.log(`  ${pc.red('✗')} Config error: ${(err as Error).message}\n`);
    process.exitCode = 1;
    return;
  }

  // Validate locales
  console.log(`  ${pc.bold('Locales:')}`);
  console.log(`  Source: ${getLanguageFlag(config.sourceLocale)} ${config.sourceLocale} (${getLanguageName(config.sourceLocale)})`);

  let localeErrors = false;
  for (const locale of config.targetLocales) {
    const flag = getLanguageFlag(locale);
    const name = getLanguageName(locale);
    const valid = isValidLocaleCode(locale);

    if (valid) {
      console.log(`  Target: ${flag} ${locale} (${name})`);
    } else {
      console.log(`  Target: ${pc.red('✗')} ${locale} — invalid locale code`);
      localeErrors = true;
    }
  }
  console.log('');

  // Validate provider
  s.start('Testing provider connection...');
  const provider = createProvider(config.provider);

  try {
    const result = await provider.validate();
    if (result.ok) {
      s.stop(`${pc.green('✓')} ${provider.name} — connected successfully`);
    } else {
      s.stop(`${pc.red('✗')} ${provider.name} — ${result.error}`);
      process.exitCode = 1;
    }
  } catch (err) {
    s.stop(`${pc.red('✗')} ${provider.name} — ${(err as Error).message}`);
    process.exitCode = 1;
  }

  // Validate file patterns
  console.log(`\n  ${pc.bold('File patterns:')}`);
  for (const pattern of config.files) {
    console.log(`  ${pc.dim('→')} ${pattern}`);
  }

  // Contexts
  if (config.contexts && Object.keys(config.contexts).length > 0) {
    console.log(`\n  ${pc.bold('Contexts:')}`);
    for (const [name, ctx] of Object.entries(config.contexts)) {
      const tone = ctx.tone ? pc.dim(`(${ctx.tone})`) : '';
      console.log(`  ${pc.cyan('◆')} ${name} ${tone}`);
    }
  }

  console.log('');
  if (!localeErrors && !process.exitCode) {
    console.log(`  ${pc.green('✓')} All checks passed. Ready to translate!\n`);
  }
}

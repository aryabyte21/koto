import { printIntro } from './ui/intro.js';
import { initCommand } from './commands/init.js';
import { translateCommand } from './commands/translate.js';
import { diffCommand } from './commands/diff.js';
import { typesCommand } from './commands/types.js';
import { validateCommand } from './commands/validate.js';
import { cacheStatsCommand, cacheClearCommand } from './commands/cache.js';
import { badgeCommand } from './commands/badge.js';
import { contributeCommand } from './commands/contribute.js';
import { VERSION } from './utils/version.js';
import pc from 'picocolors';

const HELP = `
  ${pc.bold('Usage:')} koto [command] [options]

  ${pc.bold('Commands:')}
    ${pc.cyan('init')}                Auto-detect + interactive setup
    ${pc.cyan('translate')}           Translate all pending strings (default)
    ${pc.cyan('diff')}                Show pending translations
    ${pc.cyan('types')}               Generate TypeScript types from locales
    ${pc.cyan('validate')}            Check config + test provider connection
    ${pc.cyan('badge')}               Generate i18n coverage badge
    ${pc.cyan('contribute')}          Fork, translate & PR an OSS repo
    ${pc.cyan('cache stats')}         Show cache statistics
    ${pc.cyan('cache clear')}         Clear translation cache

  ${pc.bold('Options:')}
    ${pc.dim('--locale, -l')}        Specific locales (comma-separated)
    ${pc.dim('--context, -c')}       Specific context only
    ${pc.dim('--dry-run')}           Preview without translating
    ${pc.dim('--force')}             Re-translate everything
    ${pc.dim('--fail-on-error')}     Exit code 1 on quality issues (CI mode)
    ${pc.dim('--json')}              Machine-readable output
    ${pc.dim('--watch, -w')}         Watch mode (types command)
    ${pc.dim('--help, -h')}          Show this help
    ${pc.dim('--version, -v')}       Show version
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cwd = process.cwd();

  const flags = parseFlags(args);
  const command = flags.positional[0] ?? 'translate';
  const subcommand = flags.positional[1];

  if (flags.help) {
    console.log(HELP);
    return;
  }

  if (flags.version) {
    console.log(VERSION);
    return;
  }

  try {
    switch (command) {
      case 'init':
        await initCommand(cwd);
        break;

      case 'translate':
        await translateCommand(cwd, {
          locale: flags.locale,
          context: flags.context,
          dryRun: flags.dryRun,
          force: flags.force,
          failOnError: flags.failOnError,
        });
        break;

      case 'diff':
        await diffCommand(cwd, { json: flags.json, locale: flags.locale });
        break;

      case 'types':
        await typesCommand(cwd, { watch: flags.watch });
        break;

      case 'validate':
        await validateCommand(cwd);
        break;

      case 'badge':
        await badgeCommand(cwd);
        break;

      case 'contribute': {
        const repoArg = flags.positional[1];
        if (!repoArg) {
          console.log(`  ${pc.red('Missing repo argument.')}`);
          console.log(`  Usage: koto contribute <owner/repo> --locale <code>\n`);
          process.exitCode = 1;
          break;
        }
        if (!flags.locale) {
          console.log(`  ${pc.red('Missing --locale flag.')}`);
          console.log(`  Usage: koto contribute <owner/repo> --locale <code>\n`);
          process.exitCode = 1;
          break;
        }
        await contributeCommand(repoArg, {
          locale: flags.locale,
          dryRun: flags.dryRun,
        });
        break;
      }

      case 'cache':
        if (subcommand === 'clear') {
          await cacheClearCommand(cwd);
        } else {
          await cacheStatsCommand(cwd);
        }
        break;

      default:
        console.log(`  ${pc.red('Unknown command:')} ${command}`);
        console.log(HELP);
        process.exitCode = 1;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n  ${pc.red('✗')} ${message}\n`);
    process.exitCode = 1;
  }
}

interface ParsedFlags {
  positional: string[];
  locale?: string;
  context?: string;
  dryRun: boolean;
  force: boolean;
  failOnError: boolean;
  json: boolean;
  watch: boolean;
  help: boolean;
  version: boolean;
}

function parseFlags(args: string[]): ParsedFlags {
  const flags: ParsedFlags = {
    positional: [],
    dryRun: false,
    force: false,
    failOnError: false,
    json: false,
    watch: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--locale':
      case '-l':
        flags.locale = args[++i];
        break;
      case '--context':
      case '-c':
        flags.context = args[++i];
        break;
      case '--dry-run':
        flags.dryRun = true;
        break;
      case '--force':
        flags.force = true;
        break;
      case '--fail-on-error':
        flags.failOnError = true;
        break;
      case '--json':
        flags.json = true;
        break;
      case '--watch':
      case '-w':
        flags.watch = true;
        break;
      case '--help':
      case '-h':
        flags.help = true;
        break;
      case '--version':
      case '-v':
        flags.version = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          flags.positional.push(arg);
        }
    }
  }

  return flags;
}

main();

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pc from 'picocolors';
import { detectFramework } from '../core/detect/framework.js';
import { detectI18nLib } from '../core/detect/i18n-lib.js';
import { detectLocales } from '../core/detect/locales.js';
import { loadConfig } from '../core/config/loader.js';
import { runPipeline } from '../core/pipeline/index.js';
import { printIntro } from '../ui/intro.js';
import { VERSION } from '../utils/version.js';
import { getLanguageName } from '../utils/language.js';
import { writeFile } from '../utils/fs.js';

const execFile = promisify(execFileCb);

function detectProvider(): string {
  if (process.env.GOOGLE_API_KEY) return 'google';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'openai'; // fallback
}

export interface ContributeOptions {
  locale: string;
  dryRun?: boolean;
}

function parseRepo(input: string): { owner: string; repo: string } {
  // Accept owner/repo or full GitHub URL
  const ghUrlMatch = input.match(
    /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?$/,
  );
  if (ghUrlMatch) {
    return { owner: ghUrlMatch[1], repo: ghUrlMatch[2] };
  }

  const parts = input.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }

  throw new Error(
    `Invalid repo format: "${input}". Use owner/repo or a GitHub URL.`,
  );
}

async function run(
  cmd: string,
  args: string[],
  options?: { cwd?: string },
): Promise<string> {
  const { stdout } = await execFile(cmd, args, {
    cwd: options?.cwd,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

function generatePrBody(opts: {
  localeName: string;
  localeCode: string;
  sourceLocale: string;
  count: number;
  passed: number;
  issues: number;
  score: number;
}): string {
  return `## 🌍 Add ${opts.localeName} (${opts.localeCode}) translations

Translated ${opts.count} keys from ${opts.sourceLocale} to ${opts.localeCode} using [koto](https://github.com/aryabyte21/koto).

### Quality Report
- ✅ ${opts.passed} translations passed quality checks
- ⚠️ ${opts.issues} translations flagged for review
- 📊 Quality score: ${opts.score}/100

### What is koto?
koto is an open-source, context-aware AI translation tool. [Learn more →](https://github.com/aryabyte21/koto)

---
🤖 Generated with [koto](https://github.com/aryabyte21/koto) — context-aware AI translation`;
}

function generateKotoConfig(opts: {
  sourceLocale: string;
  targetLocale: string;
  files: string[];
  provider: string;
}): string {
  return `/** @type {import('koto').KotoConfig} */
export default {
  sourceLocale: '${opts.sourceLocale}',
  targetLocales: ['${opts.targetLocale}'],
  provider: {
    name: '${opts.provider}',
  },
  files: [${opts.files.map((f) => `'${f}'`).join(', ')}],
};
`;
}

export async function contributeCommand(
  repo: string,
  options: ContributeOptions,
): Promise<void> {
  printIntro(VERSION);

  // Pre-check: gh CLI must be installed
  try {
    await execFile('gh', ['--version']);
  } catch {
    throw new Error(
      'The "gh" CLI is required for the contribute command. Install it: https://cli.github.com',
    );
  }

  const { owner, repo: repoName } = parseRepo(repo);
  const fullRepo = `${owner}/${repoName}`;
  const timestamp = Date.now().toString(36).slice(-4);
  const branchName = `koto/add-${options.locale}-translations-${timestamp}`;
  const localeName = getLanguageName(options.locale);

  console.log(
    `  ${pc.bold('Contributing')} ${localeName} (${options.locale}) translations to ${pc.cyan(fullRepo)}\n`,
  );

  // 1. Fork
  console.log(`  ${pc.dim('→')} Forking ${fullRepo}...`);
  if (!options.dryRun) {
    await run('gh', ['repo', 'fork', fullRepo, '--clone=false']);
  }

  // 2. Clone fork to temp dir
  const tempDir = await mkdtemp(join(tmpdir(), 'koto-contribute-'));
  const cloneDir = join(tempDir, repoName);

  try {
    console.log(`  ${pc.dim('→')} Cloning fork...`);
    if (!options.dryRun) {
      const username = await run('gh', ['api', 'user', '--jq', '.login']);
      await run('git', [
        'clone',
        '--depth',
        '1',
        `https://github.com/${username}/${repoName}.git`,
        cloneDir,
      ]);
    } else {
      // In dry-run, clone the original for detection
      await run('git', [
        'clone',
        '--depth',
        '1',
        `https://github.com/${fullRepo}.git`,
        cloneDir,
      ]);
    }

    // 3. Detect i18n setup
    console.log(`  ${pc.dim('→')} Detecting i18n setup...`);
    const framework = await detectFramework(cloneDir);
    const i18nLib = await detectI18nLib(cloneDir);
    const existingLocales = await detectLocales(cloneDir);

    if (!existingLocales) {
      throw new Error(
        `No i18n setup detected in ${fullRepo}. The repository needs locale files ` +
          `(e.g., locales/en.json) for koto to translate.`,
      );
    }

    if (framework) {
      console.log(`  ${pc.dim('  Framework:')} ${framework.name}`);
    }
    if (i18nLib) {
      console.log(`  ${pc.dim('  i18n lib:')} ${i18nLib.name}`);
    }
    console.log(
      `  ${pc.dim('  Source locale:')} ${existingLocales.sourceLocale}`,
    );
    console.log(
      `  ${pc.dim('  Locale dir:')} ${existingLocales.directory}\n`,
    );

    // 4. Write koto config
    const filePattern =
      existingLocales.pattern ??
      i18nLib?.localePathPattern ??
      'src/locales/[locale].json';

    const configContent = generateKotoConfig({
      sourceLocale: existingLocales.sourceLocale,
      targetLocale: options.locale,
      files: [filePattern],
      provider: detectProvider(),
    });

    await writeFile(join(cloneDir, 'koto.config.ts'), configContent);

    // 5. Run translation
    console.log(`  ${pc.dim('→')} Translating...`);
    const config = await loadConfig(cloneDir);
    const result = await runPipeline(config, cloneDir, {
      locales: [options.locale],
      dryRun: options.dryRun,
    });

    const totalTranslated = result.totalTranslated;
    const totalIssues = result.totalIssues;
    const passed = Math.max(0, totalTranslated - totalIssues);
    const score =
      totalTranslated > 0
        ? Math.max(0, Math.round((passed / totalTranslated) * 100))
        : 100;

    console.log(
      `  ${pc.green('✓')} Translated ${totalTranslated} keys (score: ${score}/100)\n`,
    );

    if (options.dryRun) {
      console.log(
        `  ${pc.yellow('Dry run')} — skipping branch, commit, and PR creation.\n`,
      );

      const prBody = generatePrBody({
        localeName,
        localeCode: options.locale,
        sourceLocale: existingLocales.sourceLocale,
        count: totalTranslated,
        passed,
        issues: totalIssues,
        score,
      });

      console.log(`  ${pc.bold('PR description preview:')}\n`);
      console.log(
        prBody
          .split('\n')
          .map((line) => `  ${pc.dim(line)}`)
          .join('\n'),
      );
      console.log('');
      return;
    }

    // 6. Create branch, commit, push
    console.log(`  ${pc.dim('→')} Creating branch and committing...`);
    await run('git', ['checkout', '-b', branchName], { cwd: cloneDir });
    // Delete the temporary koto config from disk before committing
    const configFile = join(cloneDir, 'koto.config.ts');
    await rm(configFile, { force: true }).catch(() => {});
    const lockFile = join(cloneDir, 'koto.lock');
    await rm(lockFile, { force: true }).catch(() => {});
    await run('git', ['add', '-A'], { cwd: cloneDir });
    await run(
      'git',
      [
        'commit',
        '-m',
        `feat(i18n): add ${localeName} (${options.locale}) translations`,
      ],
      { cwd: cloneDir },
    );

    console.log(`  ${pc.dim('→')} Pushing...`);
    await run('git', ['push', 'origin', branchName], { cwd: cloneDir });

    // 7. Get fork owner (the authenticated user)
    const forkOwner = (await run('gh', ['api', 'user', '--jq', '.login'])).trim();

    // 8. Open PR from fork to upstream
    console.log(`  ${pc.dim('→')} Opening pull request...`);
    const prBody = generatePrBody({
      localeName,
      localeCode: options.locale,
      sourceLocale: existingLocales.sourceLocale,
      count: totalTranslated,
      passed,
      issues: totalIssues,
      score,
    });

    const prTitle = `feat(i18n): add ${localeName} (${options.locale}) translations`;
    const prUrl = await run('gh', [
      'pr',
      'create',
      '--repo',
      fullRepo,
      '--head',
      `${forkOwner}:${branchName}`,
      '--title',
      prTitle,
      '--body',
      prBody,
    ]);

    console.log(`\n  ${pc.green('✓')} Pull request created!`);
    console.log(`  ${pc.cyan(prUrl)}\n`);
  } finally {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

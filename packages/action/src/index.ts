import { appendFileSync } from 'node:fs';

function getInput(name: string): string {
  const envKey = `INPUT_${name.toUpperCase().replace(/ /g, '_')}`;
  return process.env[envKey]?.trim() ?? '';
}

function setOutput(name: string, value: string): void {
  const filePath = process.env.GITHUB_OUTPUT;
  if (filePath) {
    appendFileSync(filePath, `${name}=${value}\n`);
  }
}

function setFailed(message: string): void {
  console.log(`::error::${message}`);
  process.exitCode = 1;
}

function notice(message: string): void {
  console.log(`::notice::${message}`);
}

async function run(): Promise<void> {
  try {
    const provider = getInput('provider');
    if (!provider) {
      throw new Error('Input required and not supplied: provider');
    }

    const apiKey = getInput('api_key');
    const locales = getInput('locales');
    const workingDirectory = getInput('working_directory') || '.';
    const failOnError = getInput('fail_on_error') === 'true';

    const envKeyMap: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GOOGLE_API_KEY',
    };

    if (!envKeyMap[provider] && provider !== 'ollama') {
      throw new Error(
        `Unsupported provider: ${provider}. Supported: openai, anthropic, google, ollama.`,
      );
    }

    if (provider !== 'ollama' && !apiKey) {
      throw new Error(`api_key is required when provider is "${provider}"`);
    }

    const envKey = envKeyMap[provider];
    if (envKey) {
      process.env[envKey] = apiKey;
    }

    const cwd = workingDirectory !== '.' ? workingDirectory : process.cwd();

    // Import koto programmatic API
    const { loadConfig, runPipeline } = await import('koto');

    const config = await loadConfig(cwd);

    // Override provider if specified
    if (provider !== config.provider.name) {
      config.provider.name = provider as typeof config.provider.name;
    }

    const targetLocales = locales
      ? locales.split(',').map((l: string) => l.trim())
      : config.targetLocales;

    const result = await runPipeline(config, cwd, {
      locales: targetLocales,
    });

    // Set outputs
    setOutput('translated', String(result.totalTranslated));
    setOutput('cached', String(result.totalCached));
    setOutput('locales', targetLocales.join(','));
    setOutput('issues', String(result.totalIssues));
    setOutput('cost', result.costUsd.toFixed(4));

    notice(
      `Translated ${result.totalTranslated} keys across ${targetLocales.length} locales` +
        (result.costUsd > 0 ? ` (cost: $${result.costUsd.toFixed(2)})` : ''),
    );

    if (failOnError && result.totalIssues > 0) {
      setFailed(
        `${result.totalIssues} quality issue(s) found. Run "koto diff" locally to review.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setFailed(message);
  }
}

run();

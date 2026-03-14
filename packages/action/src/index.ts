function getInput(name: string): string {
  const envKey = `INPUT_${name.toUpperCase().replace(/ /g, '_')}`
  const value = process.env[envKey]?.trim() ?? ''

  return value
}

import { appendFileSync } from 'node:fs'

function setOutput(name: string, value: string): void {
  const filePath = process.env.GITHUB_OUTPUT
  if (filePath) {
    appendFileSync(filePath, `${name}=${value}\n`)
  }
}

function setFailed(message: string): void {
  console.log(`::error::${message}`)
  process.exitCode = 1
}

function notice(message: string): void {
  console.log(`::notice::${message}`)
}

async function run(): Promise<void> {
  try {
    const provider = getInput('provider')
    if (!provider) {
      throw new Error('Input required and not supplied: provider')
    }

    const apiKey = getInput('api_key')
    const locales = getInput('locales')
    const workingDirectory = getInput('working_directory') || '.'
    const failOnError = getInput('fail_on_error') === 'true'

    // Set the API key in the environment for the provider
    const envKeyMap: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GOOGLE_API_KEY',
    }

    const envKey = envKeyMap[provider]
    if (!envKeyMap[provider] && provider !== 'ollama') {
      throw new Error(
        `Unsupported provider: ${provider}. Supported providers: openai, anthropic, google, ollama.`,
      )
    }

    if (provider !== 'ollama' && !apiKey) {
      throw new Error(`api_key is required when provider is "${provider}"`)
    }

    if (envKey) {
      process.env[envKey] = apiKey
    }

    // Change to the working directory
    if (workingDirectory !== '.') {
      process.chdir(workingDirectory)
    }

    // Import and run the translate command programmatically
    const { translate } = await import('koto')

    const result = await translate({
      provider,
      locales: locales ? locales.split(',').map((l) => l.trim()) : undefined,
      failOnError,
    })

    // Set outputs
    setOutput('translated', String(result.translatedKeys))
    setOutput('locales', result.locales.join(','))
    setOutput('quality_score', String(result.qualityScore))

    notice(
      `Translated ${result.translatedKeys} keys across ${result.locales.length} locales (quality: ${result.qualityScore}/100)`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setFailed(message)
  }
}

run()

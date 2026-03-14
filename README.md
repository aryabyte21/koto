<div align="center">

```
  ╦╔═  ╔═╗  ╔╦╗  ╔═╗
  ╠╩╗  ║ ║   ║   ║ ║
  ╩ ╩  ╚═╝   ╩   ╚═╝
```

**Context-aware AI translation for your i18n workflow**

[![npm version](https://img.shields.io/npm/v/koto?color=blue)](https://www.npmjs.com/package/koto)
[![license](https://img.shields.io/npm/l/koto)](./LICENSE)
[![CI](https://github.com/koto-i18n/koto/actions/workflows/ci.yml/badge.svg)](https://github.com/koto-i18n/koto/actions/workflows/ci.yml)

[Quickstart](#quickstart) · [Features](#features) · [Config](#configuration) · [Providers](#providers) · [CLI Reference](#cli-reference)

</div>

---

## Quickstart

**1. Install**

```bash
pnpm add -D koto
```

**2. Initialize**

```bash
npx koto init
```

```
  ╦╔═  ╔═╗  ╔╦╗  ╔═╗
  ╠╩╗  ║ ║   ║   ║ ║
  ╩ ╩  ╚═╝   ╩   ╚═╝

◆  What format are your translation files?
│  ● JSON (flat or nested)
│  ○ TypeScript (next-intl, react-i18next)
│  ○ YAML
│  ○ PO (gettext)

◆  Where is your source locale file?
│  src/locales/en.json

◆  What locales do you want to translate to?
│  ◻ 🇪🇸 es  ◻ 🇫🇷 fr  ◻ 🇩🇪 de  ◻ 🇯🇵 ja  ◻ 🇰🇷 ko  ◻ 🇨🇳 zh
│  ◻ 🇧🇷 pt-BR  ◻ 🇮🇹 it  ◻ 🇳🇱 nl  ◻ 🇷🇺 ru  ◻ 🇸🇦 ar  ◻ 🇮🇳 hi

✔  Created koto.config.ts
```

**3. Translate**

```bash
npx koto translate
```

```
◆  Translating 42 keys → 6 locales

  🇪🇸 es  ████████████████████████████████████████ 42/42
  🇫🇷 fr  ████████████████████████████████████████ 42/42
  🇩🇪 de  ████████████████████████████████████████ 42/42
  🇯🇵 ja  ████████████████████████████████████████ 42/42
  🇰🇷 ko  ████████████████████████████████████████ 42/42
  🇨🇳 zh  ████████████████████████████████████████ 42/42

✔  252 translations written in 3.2s
   Quality score: 98/100
```

---

## Features

<table>
<tr>
<td width="33%" valign="top">

### 🎯 Context Profiles

Define different tones and terminology for different parts of your app. Marketing pages get punchy copy; legal pages stay formal.

</td>
<td width="33%" valign="top">

### 🔒 Type-Safe Keys

Auto-generate TypeScript types from your translation files. Catch missing keys at build time, not in production.

</td>
<td width="33%" valign="top">

### 🤖 BYOLLM

Bring your own LLM. Works with OpenAI, Anthropic Claude, Google Gemini, and local models via Ollama. Switch with one config line.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### ⚡ Smart Cache

Only re-translate changed or new keys. Unchanged strings are cached with content hashes, so incremental runs take seconds.

</td>
<td width="33%" valign="top">

### 📊 Quality Scoring

Every translation is scored for placeholder integrity, length ratio, and terminology consistency. Catch issues before they ship.

</td>
<td width="33%" valign="top">

### 🔄 CI/CD Ready

Drop-in GitHub Action. Use `--fail-on-error` in CI to block deploys when translations are missing or quality drops below threshold.

</td>
</tr>
</table>

---

## Configuration

koto is configured with a `koto.config.ts` file in your project root:

```ts
import { defineConfig } from 'koto'

export default defineConfig({
  sourceLocale: 'en',
  targetLocales: ['es', 'fr', 'de', 'ja', 'ko', 'zh'],
  files: ['src/locales/[locale].json'],
  provider: {
    name: 'openai',
    model: 'gpt-4o-mini',
  },

  // Context profiles — different tones for different sections
  contexts: {
    default: {
      tone: 'concise',
      instructions: 'UI strings. Keep translations short.',
    },
    marketing: {
      tone: 'persuasive and energetic',
      instructions: 'Keep translations punchy. Prefer short words.',
      files: ['src/locales/marketing/[locale].json'],
    },
    legal: {
      tone: 'formal and precise',
      instructions: 'Use jurisdiction-appropriate legal terminology.',
      glossary: './glossaries/legal.json',
      files: ['src/locales/legal/[locale].json'],
    },
  },
})
```

---

## How koto Compares

| Feature | koto | Lingo.dev | Tolgee | Paraglide |
|---|---|---|---|---|
| Context profiles | ✅ | ❌ | ❌ | ❌ |
| BYOLLM (any provider) | ✅ | ❌ (own API) | ❌ (own API) | ❌ |
| Local models (Ollama) | ✅ | ❌ | ❌ | ❌ |
| Quality scoring | ✅ | ❌ | ❌ | ❌ |
| Incremental translation | ✅ | ✅ | ✅ | ❌ |
| Type generation | ✅ | ❌ | ✅ | ✅ |
| GitHub Action | ✅ | ✅ | ✅ | ❌ |
| Self-hosted / no vendor lock-in | ✅ | ❌ | Partial | ✅ |
| Open source | MIT | Source-available | Mixed | MIT |
| Price | Free | Paid | Freemium | Free |

---

## Providers

### OpenAI

```ts
provider: {
  name: 'openai',
  model: 'gpt-4o-mini', // or 'gpt-4o'
}
```

```bash
export OPENAI_API_KEY=sk-...
```

### Anthropic

```ts
provider: {
  name: 'anthropic',
  model: 'claude-sonnet-4-20250514',
}
```

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### Google Gemini

```ts
provider: {
  name: 'google',
  model: 'gemini-2.0-flash',
}
```

```bash
export GOOGLE_API_KEY=...
```

### Ollama (local)

```ts
provider: {
  name: 'ollama',
  model: 'llama3.2',
  baseUrl: 'http://localhost:11434', // default
}
```

No API key needed. Run any model locally.

---

## CLI Reference

```
Usage: koto [command] [options]

Commands:
  koto init                     Auto-detect + interactive setup
  koto translate                Translate all pending strings (default)
  koto translate --locale es,fr Translate specific locales
  koto translate --context legal Translate specific context only
  koto translate --dry-run      Preview without translating
  koto translate --force        Re-translate everything
  koto diff                     Show what needs translation
  koto diff --json              Machine-readable output
  koto types                    Generate TypeScript types from locales
  koto types --watch            Watch mode for type generation
  koto validate                 Check config + test provider connection
  koto cache stats              Cache analytics
  koto cache clear              Clear translation cache

Options:
  --locale, -l               Specific locales (comma-separated)
  --context, -c              Specific context only
  --fail-on-error            Exit 1 on quality issues (CI mode)
  --dry-run                  Preview without translating
  --force                    Re-translate everything
  --json                     Machine-readable output
  --version, -v              Show version
  --help, -h                 Show help
```

---

## GitHub Action

```yaml
- uses: koto-i18n/koto@v1
  with:
    provider: openai
    api_key: ${{ secrets.OPENAI_API_KEY }}
    locales: es,fr,de,ja
    fail_on_error: true
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](./LICENSE) — build whatever you want.

<div align="center">

```
╦╔═  ╔═╗  ╔╦╗  ╔═╗
╠╩╗  ║ ║   ║   ║ ║
╩ ╩  ╚═╝   ╩   ╚═╝
```

**Context-aware AI translation for your i18n workflow**

[![npm version](https://img.shields.io/npm/v/koto?color=blue)](https://www.npmjs.com/package/koto)
[![license](https://img.shields.io/npm/l/koto)](./LICENSE)
[![CI](https://github.com/aryabyte21/koto/actions/workflows/ci.yml/badge.svg)](https://github.com/aryabyte21/koto/actions/workflows/ci.yml)

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
  koto v0.1.0

┌  Detected
│
│  Framework: Next.js 14
│  i18n library: next-intl
│  Source: src/messages/ (en, 🇪🇸 es, 🇫🇷 fr)
│
└

◆  Which LLM provider?
│  ● OpenAI (gpt-4o-mini — fast & cheap)
│  ○ Anthropic (claude-sonnet — high quality)
│  ○ Google (gemini-2.5-flash — fast & cheap)
│  ○ Ollama (local, free, private)

◆  Target locales? (space to toggle)
│  ◼ 🇪🇸  es       Spanish (existing)
│  ◼ 🇫🇷  fr       French (existing)
│  ◼ 🇩🇪  de       German
│  ◼ 🇯🇵  ja       Japanese
│  ◻ 🇰🇷  ko       Korean
│  ◻ 🇧🇷  pt-BR    Brazilian Portuguese
│  ◻ 🇨🇳  zh-Hans  Simplified Chinese

┌  Setup complete
│
│  Created koto.config.ts
│  Created koto.lock
│
└

  Set OPENAI_API_KEY in your environment.
  Run npx koto to translate!
```

**3. Translate**

```bash
npx koto translate
```

```
  ╦╔═  ╔═╗  ╔╦╗  ╔═╗
  ╠╩╗  ║ ║   ║   ║ ║
  ╩ ╩  ╚═╝   ╩   ╚═╝
  v0.1.0 — context-aware i18n

◆  Translating 847 keys → 4 locales

  🇪🇸  es     ████████████████████████████████ 847/847 ✓
  🇫🇷  fr     ████████████████████████████████ 847/847 ✓
  🇩🇪  de     ██████████████████████████░░░░░░ 694/847
  🇯🇵  ja     █████████████████░░░░░░░░░░░░░░░ 451/847

  ⚡ Cache: 712 │ 🔤 Translated: 135 │ ⏱  8.4s
  💰 Estimated cost: $0.08

✓  Translation complete

  🇪🇸  es       135 translated, 712 cached ✓
  🇫🇷  fr       128 translated, 719 cached ✓
  🇩🇪  de       847 translated, 0 cached ✓
  🇯🇵  ja       847 translated, 0 cached ✓

  ⚡ Cache hits: 1431 │ 🔤 Translated: 1957 │ ⏱  14.2s
  💰 Estimated cost: $0.23

  ⚠  2 quality issues found. Run koto diff to review.

  4 locale files updated.
  Run koto types to update TypeScript types.
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
// koto.config.ts
/** @type {import('koto').KotoConfig} */
export default {
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
};
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
- uses: aryabyte21/koto@v1
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

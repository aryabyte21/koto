# Contributing to koto

## Dev Setup

```bash
git clone https://github.com/koto-i18n/koto.git
cd koto
pnpm install
pnpm build
pnpm test
```

The project is a monorepo managed with pnpm workspaces and Turborepo:

```
packages/
  cli/       — the main koto CLI and library
  action/    — GitHub Action wrapper
```

### Running the CLI locally

```bash
cd packages/cli
pnpm dev          # rebuild on changes
node dist/cli.js  # run locally
```

### Running tests

```bash
pnpm test              # all packages
cd packages/cli && pnpm test       # cli only
cd packages/cli && pnpm test:watch # watch mode
```

## Adding a New Provider

Providers live in `packages/cli/src/providers/`. Each provider exports a function that conforms to the `TranslationProvider` interface.

1. Create `packages/cli/src/providers/your-provider.ts`
2. Implement the `TranslationProvider` interface:
   ```ts
   import type { TranslationProvider } from './types'

   export function createYourProvider(config: ProviderConfig): TranslationProvider {
     return {
       name: 'your-provider',
       async translate(params) {
         // Call your LLM API here
         // Return translated strings
       },
     }
   }
   ```
3. Register it in `packages/cli/src/providers/index.ts`
4. Add tests in `packages/cli/test/providers/your-provider.test.ts`

## Adding a New Format

Formats live in `packages/cli/src/formats/`. Each format handles reading and writing translation files in a specific format (JSON, YAML, PO, etc.).

1. Create `packages/cli/src/formats/your-format.ts`
2. Implement the `Format` interface:
   ```ts
   import type { Format } from './types'

   export const yourFormat: Format = {
     name: 'your-format',
     extensions: ['.ext'],
     parse(content: string) {
       // Parse file content into a flat key-value map
     },
     serialize(translations: Record<string, string>) {
       // Serialize key-value map back to file content
     },
   }
   ```
3. Register it in `packages/cli/src/formats/index.ts`
4. Add tests with fixture files in `packages/cli/test/formats/`

## Code Style

- **TypeScript** — strict mode, no `any` unless absolutely necessary
- **ESM** — all imports use ESM syntax
- **No unnecessary comments** — code should be self-documenting; use comments only for non-obvious logic
- **Naming** — `camelCase` for variables and functions, `PascalCase` for types and interfaces
- **Formatting** — handled by the project's config, just run `pnpm lint` before submitting

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add or update tests as needed
4. Run `pnpm build && pnpm test && pnpm lint`
5. Open a PR with a clear description of what and why

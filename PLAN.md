# koto — The i18n Translation Tool That Should Already Exist

## Context & Why This Matters

Every team with a multi-language app faces the same broken workflow: edit English strings, manually run some script or push to an expensive SaaS, pray the AI/MT doesn't butcher legal text with casual slang, wait for JSON files to appear, hope nothing broke. It's 2026 and this still sucks.

A previous internal project solved one piece nobody else has: **context-aware translation** — legal text gets formal tone, consumer UI gets friendly tone, developer docs get technical tone. But it's a Python script duct-taped to Gemini. The opportunity is to generalize this into an open-source tool that combines the best ideas from every competitor while adding what none of them have.

**The thesis:** No tool combines these three things that developers desperately want:
1. **Context-aware AI translation** (different tones per section) — nobody has this
2. **Type-safe translation keys** (TypeScript types generated from locale files) — Paraglide has this but no AI; Lingo.dev has AI but no types
3. **Zero-config "just works" DX** with beautiful terminal output — the "shadcn/Biome effect"

---

## Implementation Phases

### Phase 1: Foundation — Scaffold + Config + Core Pipeline ✅
**Goal:** Working translation of a single JSON file with one provider

1. ✅ Init pnpm workspace monorepo (packages/cli, packages/action, docs)
2. ✅ Scaffold cli package: `package.json`, `tsup.config.ts`, `vitest.config.ts`, `tsconfig.json`
3. ✅ `core/config/schema.ts` — Zod config schema + `defineConfig()` export
4. ✅ `core/config/loader.ts` — find and load config file (support .ts, .json, .js)
5. ✅ `formats/base.ts` — FileFormat interface
6. ✅ `formats/json-nested.ts` — Nested JSON parser (round-trip)
7. ✅ `core/placeholders/` — pattern registry + shield + restore
8. ✅ `core/cache/hasher.ts` — SHA-256 content hashing
9. ✅ `core/cache/lockfile.ts` — lockfile read/write/diff
10. ✅ `core/pipeline/` — extractor, differ, batcher, validator, writer, orchestrator
11. ✅ `providers/base.ts` — Provider interface
12. ✅ `providers/openai.ts` — First provider (most popular)
13. ✅ Unit tests for all of the above
14. ✅ **Milestone:** `npx koto translate` works end-to-end for a JSON file with OpenAI

### Phase 2: DX Polish — CLI UI + Init + Auto-Detection ✅
**Goal:** The "30-second experience" works beautifully

15. ✅ `ui/` — @clack/prompts integration (intro, progress, summary, diff-view)
16. ✅ `core/detect/` — framework, i18n library, and locale auto-detection
17. ✅ `commands/init.ts` — interactive setup with auto-detection
18. ✅ `commands/translate.ts` — wire up with beautiful progress UI
19. ✅ `commands/diff.ts` — visual diff of pending translations
20. ✅ `commands/validate.ts` — config + provider health check
21. ✅ `commands/cache.ts` — cache stats and management
22. ✅ `utils/cost.ts` — cost estimation per provider
23. ✅ **Milestone:** Full CLI experience from init to translate with progress UI

### Phase 3: Context System + More Providers ✅
**Goal:** The killer differentiator is live

24. ✅ `core/context/` — context resolution, prompt builder, glossary loading
25. ✅ `providers/anthropic.ts` — Claude provider
26. ✅ `providers/google.ts` — Gemini (API key + Vertex AI)
27. ✅ `providers/ollama.ts` — Ollama (local, free)
28. ✅ `providers/custom.ts` — Generic HTTP adapter
29. ✅ Quality scoring: `core/quality/scorer.ts` + `core/quality/rules.ts`
30. ✅ Integration tests for context system + all providers (mock provider for CI)
31. ✅ **Milestone:** Context-aware translation working, multiple providers

### Phase 4: Type Generation + Additional Formats ✅
**Goal:** Type safety + broad file format support

32. ✅ `core/typegen/` — generate TypeScript type definitions from locale files
33. ✅ `commands/types.ts` — `koto types` and `koto types --watch`
34. ✅ `formats/json-flat.ts` — flat JSON
35. ✅ `formats/yaml.ts` — YAML (zero-dep parser)
36. ✅ `formats/po.ts` — GNU Gettext PO files
37. ✅ **Milestone:** `npx koto types` generates working TS types

### Phase 5: GitHub Action + CI ✅
**Goal:** One-line CI integration

38. ✅ `packages/action/` — GitHub Action scaffold
39. ✅ `action.yml` with inputs for provider, API key, locales
40. ✅ CI/CD workflows (ci.yml, release.yml)
41. ✅ **Milestone:** GitHub Action ready

### Phase 6: Docs Site + Landing Page
**Goal:** Beautiful docs + landing page ready

42. ✅ Astro Starlight docs site in `docs/` (9 pages)
43. ✅ Landing page: hero + feature cards + install command
44. ✅ Getting started, configuration, contexts, type-safety, providers, CI/CD, CLI reference, comparison
45. ⬜ Record 30-second demo GIF for README
46. ✅ README: logo → one-liner → features → comparison table
47. ✅ GitHub Actions workflow to deploy docs to GitHub Pages
48. ✅ **Milestone:** Docs site builds, README polished

### Phase 7: Viral Features — Badge + OSS Contributor
**Goal:** Two growth engines live before launch

49. ⬜ i18n Coverage Badge API (serverless SVG generator — needs hosting)
50. ⬜ Coverage report page (needs hosting)
51. ✅ `npx koto badge` command — generates shields.io badge + coverage report
52. ✅ `npx koto contribute <repo> --locale <code>` command
53. ✅ GitHub API integration: fork → detect → translate → PR (via gh CLI)
54. ✅ PR template with quality report + "Powered by koto" footer
55. ✅ **Milestone:** Badge generating + contribute command ready

---

## AGENT LEARNINGS

### 2026-03-14 — Initial Implementation (Phases 1–5)

**Build setup:**
- pnpm workspace with `packages/cli` and `packages/action`. Root `turbo.json` for build orchestration.
- `tsup` for bundling — use array config (two entries) to apply shebang only to `cli.js`, not `index.js` (library entry).
- `tsc` binary lives at `node_modules/.bin/tsc` under the root workspace (not the cli package) because `typescript` is a root devDep. The cli package's tsup/vitest have their own binaries under `packages/cli/node_modules/.bin/`.
- `jiti` v2 uses `createJiti()` API (not `import jiti from 'jiti'`). The subagent got this right.

**Architecture decisions:**
- All providers use the same numbered-list format for batch translation (e.g., `1. Hello\n2. Goodbye`). Response parsing strips numbering with regex `/^(\d+)\.\s*(.+)$/`. This is battle-tested from internal use.
- Placeholder shielding replaces placeholders with `__PH_N__` tokens before sending to LLM, restores after. Overlap resolution: sort by start position, then by longest match. This prevents `{{var}}` being partially matched by the `{var}` pattern.
- Lockfile is JSON (not YAML) — no parsing deps, git-diffable, fast. Atomic writes via tmp-file + rename.
- Config loading via `jiti` enables TypeScript config files with `defineConfig()` for autocomplete.

**Module interfaces — what other modules expect:**
- `scoreTranslation(source, translation, targetLocale, rules?, key?)` — the `key` param is optional and defaults to `""`. Called from `pipeline/index.ts` without the key arg.
- `diffLockfile()` returns `DiffResult` which extends `LocaleDiff` and has `byLocale` map. Pipeline uses the top-level `added/changed/removed/unchanged` arrays (which come from the first locale).
- `resolveContext()` takes a file path and contexts record, returns `ResolvedContext` with `glossaryTerms` as optional `Record<string, string>` that gets populated later by the pipeline.
- Format `serialize(keys, original?)` — when `original` is provided, it round-trips through the original structure (preserving key order and indentation). When not provided, it builds a new nested object.

**Gotchas:**
- `fd` command is aliased on this machine and doesn't support `-n` flag. Use `Glob` tool instead of shell `find`.
- Shell cwd resets to project after every command. Always use absolute paths.
- The `@clack/prompts` package exports `isCancel` for checking if user cancelled interactive prompts.
- `picocolors` is the lightweight color library (no chalk dependency). Import as `import pc from 'picocolors'`.

**What worked well:**
- Parallelizing 4 subagents for independent module groups (config, providers+formats, placeholders+cache+quality, context+detect+utils) — all produced clean, compatible code.
- Writing the pipeline orchestrator and CLI commands in the main thread while subagents handled core modules.
- Type-checking with `tsc --noEmit` after subagents finished — caught zero errors, meaning the interfaces were specified clearly enough.

**What to watch out for in future chunks:**
- The `formats/registry.ts` currently returns `jsonNestedFormat` for all `.json` files. When adding YAML/PO/XLIFF, the registry needs format auto-detection logic (maybe based on file content, not just extension, to distinguish flat vs nested JSON).
- The `custom.ts` provider and `yaml.ts`/`po.ts` formats are listed in the plan but not yet implemented.
- Integration tests using the `MockProvider` in `test/helpers/mock-provider.ts` should cover the full pipeline end-to-end.
- The docs site (Phase 6) and viral features (Phase 7) have not been started.
- The `TranslationProgress` UI uses ANSI escape codes for cursor movement — this won't work in non-TTY environments (CI). The `--fail-on-error` flag path should use a simpler reporter.

### 2026-03-14 — Phase 4-7 Implementation

**Docs site (Astro Starlight 0.32 + Astro 5):**
- Starlight 0.32 requires Content Layer API: `src/content.config.ts` with `docsLoader()` + `docsSchema()`.
- The `social` field in Starlight config is an **object** (`{ github: 'url' }`), NOT an array.
- Sidebar items use `link: '/path/'`, NOT `slug: 'page-id'` — the `slug` format caused build errors.
- After changing content config, you MUST clean cache: `rm -rf .astro node_modules/.astro`.

**Formats:**
- YAML parser is zero-dep (custom implementation), handles nested keys, quoted strings, multiline.
- PO format supports `msgctxt` as key prefix, multiline continuation lines, header preservation.
- TypeScript format uses regex to extract object literals — handles single quotes, trailing commas.
- Format registry maps `.yml`/`.yaml` to YAML, `.po`/`.pot` to PO, `.ts`/`.js` to TypeScript.

**Contribute command:**
- Uses `node:child_process` `execFile` (NOT shell-based) for safety.
- Shells out to `gh` CLI for GitHub operations (fork, clone, PR create).

**What's still remaining:**
- Badge API serverless function (needs hosting — Cloudflare Workers or Vercel)
- Coverage report page (needs hosting)
- Demo GIF recording
- Phase 8: Launch campaign
- Real-world E2E test with actual LLM API key

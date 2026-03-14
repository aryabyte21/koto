import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface I18nLibMatch {
  packages: string[];
  name: string;
  localePathPattern?: string;
}

const I18N_LIBS: I18nLibMatch[] = [
  { packages: ["next-intl"], name: "next-intl", localePathPattern: "messages/[locale].json" },
  { packages: ["react-i18next", "i18next"], name: "i18next", localePathPattern: "public/locales/[locale]/*.json" },
  { packages: ["react-intl", "@formatjs/intl"], name: "react-intl" },
  { packages: ["vue-i18n"], name: "vue-i18n", localePathPattern: "src/locales/[locale].json" },
  { packages: ["@angular/localize"], name: "angular-localize" },
  { packages: ["svelte-i18n"], name: "svelte-i18n", localePathPattern: "src/lib/i18n/[locale].json" },
  { packages: ["@inlang/paraglide-js"], name: "paraglide" },
];

export async function detectI18nLib(
  cwd: string
): Promise<{ name: string; localePathPattern?: string } | null> {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

  try {
    const raw = await readFile(join(cwd, "package.json"), "utf-8");
    pkg = JSON.parse(raw);
  } catch {
    return null;
  }

  const allDeps = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);

  for (const lib of I18N_LIBS) {
    if (lib.packages.some((p) => allDeps.has(p))) {
      return {
        name: lib.name,
        localePathPattern: lib.localePathPattern,
      };
    }
  }

  return null;
}

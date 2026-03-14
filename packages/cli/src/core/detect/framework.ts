import { access } from "node:fs/promises";
import { join } from "node:path";

interface FrameworkMatch {
  name: string;
  configFiles: string[];
}

const FRAMEWORKS: FrameworkMatch[] = [
  { name: "Next.js", configFiles: ["next.config.js", "next.config.mjs", "next.config.ts"] },
  { name: "Nuxt", configFiles: ["nuxt.config.ts"] },
  { name: "SvelteKit", configFiles: ["svelte.config.js"] },
  { name: "Astro", configFiles: ["astro.config.mjs"] },
  { name: "Remix", configFiles: ["remix.config.js"] },
  { name: "Angular", configFiles: ["angular.json"] },
  { name: "Vite", configFiles: ["vite.config.ts", "vite.config.js"] },
];

export async function detectFramework(
  cwd: string
): Promise<{ name: string; configFile: string } | null> {
  for (const framework of FRAMEWORKS) {
    for (const configFile of framework.configFiles) {
      const fullPath = join(cwd, configFile);
      try {
        await access(fullPath);
        return { name: framework.name, configFile };
      } catch {
        // file not found
      }
    }
  }
  return null;
}

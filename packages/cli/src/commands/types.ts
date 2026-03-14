import pc from 'picocolors';
import { loadConfig } from '../core/config/loader.js';
import { generateTypesFromConfig } from '../core/typegen/index.js';
import { printIntro } from '../ui/intro.js';
import { watch } from 'node:fs';
import path from 'node:path';
import { VERSION } from '../utils/version.js';

export interface TypesOptions {
  watch?: boolean;
}

export async function typesCommand(cwd: string, options: TypesOptions = {}): Promise<void> {
  printIntro(VERSION);

  const config = await loadConfig(cwd);
  const outputPath = config.typegen?.outputPath ?? 'src/i18n.d.ts';

  const generate = async () => {
    const result = await generateTypesFromConfig(
      cwd,
      config.files,
      config.sourceLocale,
      outputPath,
    );
    console.log(
      `  ${pc.green('✓')} Generated ${pc.bold(outputPath)} ` +
      `(${pc.bold(String(result.keyCount))} keys, fully typed)`,
    );
    console.log(`  ${pc.dim('Your IDE now autocompletes translation keys!')}\n`);
  };

  await generate();

  if (options.watch) {
    console.log(`  ${pc.dim('Watching for changes...')}\n`);

    for (const pattern of config.files) {
      const sourcePath = pattern.replace('[locale]', config.sourceLocale);
      const absolutePath = path.resolve(cwd, sourcePath);
      const dir = path.dirname(absolutePath);

      try {
        watch(dir, { recursive: true }, async (event, filename) => {
          if (filename && filename.endsWith('.json')) {
            console.log(`  ${pc.dim('Change detected:')} ${filename}`);
            await generate();
          }
        });
      } catch {
        // Directory doesn't exist yet
      }
    }

    // Keep process alive
    await new Promise(() => {});
  }
}

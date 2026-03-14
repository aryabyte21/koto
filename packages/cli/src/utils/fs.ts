import { readFile as fsReadFile, writeFile as fsWriteFile, access, readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readFile(path: string): Promise<string> {
  return fsReadFile(path, "utf-8");
}

export async function writeFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await fsWriteFile(path, content, "utf-8");
}

export async function resolveGlob(pattern: string, cwd: string): Promise<string[]> {
  if (pattern.includes("[locale]")) {
    const dir = dirname(join(cwd, pattern));
    const filePattern = pattern.split("/").pop()!;
    const regexStr = filePattern.replace("[locale]", "([a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?)");
    const regex = new RegExp(`^${regexStr}$`);

    try {
      const entries = await readdir(dir);
      return entries
        .filter((entry) => regex.test(entry))
        .map((entry) => join(dir, entry));
    } catch {
      return [];
    }
  }

  if (pattern.includes("*")) {
    const parts = pattern.split("*");
    const baseDir = join(cwd, parts[0]);

    try {
      const results: string[] = [];
      await walkDir(baseDir, (filePath) => {
        const relative = filePath.slice(cwd.length + 1);
        if (matchSimpleGlob(relative, pattern)) {
          results.push(filePath);
        }
      });
      return results;
    } catch {
      return [];
    }
  }

  const fullPath = join(cwd, pattern);
  if (await fileExists(fullPath)) return [fullPath];
  return [];
}

async function walkDir(dir: string, callback: (path: string) => void): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath, callback);
      } else {
        callback(fullPath);
      }
    }
  } catch {
    // directory not readable
  }
}

function matchSimpleGlob(filePath: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*");
  return new RegExp(`^${regexStr}$`).test(filePath);
}

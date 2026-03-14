import { createHash } from "node:crypto";

export function hashString(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hashObject(obj: Record<string, string>): string {
  const sorted = Object.keys(obj)
    .sort()
    .map((key) => `${key}=${obj[key]}`)
    .join("\n");
  return hashString(sorted);
}

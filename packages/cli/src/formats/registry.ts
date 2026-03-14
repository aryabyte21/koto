import { extname } from "node:path";
import type { FileFormat } from "./base.js";
import { jsonFlatFormat } from "./json-flat.js";
import { jsonNestedFormat } from "./json-nested.js";

const formats: FileFormat[] = [jsonNestedFormat, jsonFlatFormat];

export function getFormat(filePath: string): FileFormat {
  const ext = extname(filePath).toLowerCase();

  const matched = formats.filter((f) => f.extensions.includes(ext));
  if (matched.length === 0) {
    throw new Error(
      `Unsupported file format "${ext}". Supported: ${formats.flatMap((f) => f.extensions).join(", ")}`,
    );
  }

  return matched[0];
}

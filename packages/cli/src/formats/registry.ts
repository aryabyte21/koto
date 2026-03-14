import { extname } from "node:path";
import type { FileFormat } from "./base.js";
import { jsonFlatFormat } from "./json-flat.js";
import { jsonNestedFormat } from "./json-nested.js";
import { poFormat } from "./po.js";
import { yamlFormat } from "./yaml.js";

const formatsByExtension: Record<string, FileFormat> = {
  ".json": jsonNestedFormat,
  ".yml": yamlFormat,
  ".yaml": yamlFormat,
  ".po": poFormat,
  ".pot": poFormat,
};

const formats: FileFormat[] = [jsonNestedFormat, jsonFlatFormat, yamlFormat, poFormat];

export function getFormat(filePath: string): FileFormat {
  const ext = extname(filePath).toLowerCase();

  const matched = formatsByExtension[ext];
  if (matched) return matched;

  throw new Error(
    `Unsupported file format "${ext}". Supported: ${[...new Set(formats.flatMap((f) => f.extensions))].join(", ")}`,
  );
}

export interface ParsedTranslations {
  keys: Map<string, string>;
  meta?: Record<string, unknown>;
}

export interface FileFormat {
  name: string;
  extensions: string[];
  parse(content: string): ParsedTranslations;
  serialize(keys: Map<string, string>, original?: string): string;
}

export interface PlaceholderPattern {
  name: string;
  regex: RegExp;
  priority: number;
}

export const DEFAULT_PATTERNS: PlaceholderPattern[] = [
  {
    name: "mustache-unescaped",
    regex: /\{\{\{[\w.]+\}\}\}/g,
    priority: 10,
  },
  {
    name: "mustache",
    regex: /\{\{[\w.]+\}\}/g,
    priority: 20,
  },
  {
    name: "jsx-self-closing",
    regex: /<[A-Z][\w.]*\s*(?:[^>]*?)?\s*\/>/g,
    priority: 30,
  },
  {
    name: "jsx-pair",
    regex: /<([A-Z][\w.]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g,
    priority: 31,
  },
  {
    name: "jsx-open",
    regex: /<[A-Z][\w.]*(?:\s[^>]*)?>/g,
    priority: 32,
  },
  {
    name: "jsx-close",
    regex: /<\/[A-Z][\w.]*>/g,
    priority: 33,
  },
  {
    name: "html-tag",
    regex: /<\/?[a-z][\w-]*(?:\s[^>]*)?\s*\/?>/g,
    priority: 34,
  },
  {
    name: "i18next",
    regex: /\$t\([^)]+\)/g,
    priority: 40,
  },
  {
    name: "icu-complex",
    regex: /\{[\w]+,\s*(?:plural|select|selectordinal|number|date|time)\s*,[^}]*(?:\{[^}]*\}[^}]*)*\}/g,
    priority: 50,
  },
  {
    name: "printf-positional",
    regex: /%\d+\$[sdfu@]/g,
    priority: 60,
  },
  {
    name: "printf",
    regex: /%[sdfu@]/g,
    priority: 61,
  },
  {
    name: "ruby-python-named",
    regex: /%\{[\w]+\}/g,
    priority: 70,
  },
  {
    name: "python-format",
    regex: /%\([\w]+\)[sdfu]/g,
    priority: 71,
  },
  {
    name: "numbered",
    regex: /\{\d+\}/g,
    priority: 80,
  },
  {
    name: "icu-simple",
    regex: /\{[\w]+\}/g,
    priority: 90,
  },
].sort((a, b) => a.priority - b.priority);

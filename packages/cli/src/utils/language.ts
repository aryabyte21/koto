interface LanguageEntry {
  name: string;
  flag: string;
}

const LANGUAGES: Record<string, LanguageEntry> = {
  af: { name: "Afrikaans", flag: "🇿🇦" },
  am: { name: "Amharic", flag: "🇪🇹" },
  ar: { name: "Arabic", flag: "🇸🇦" },
  az: { name: "Azerbaijani", flag: "🇦🇿" },
  be: { name: "Belarusian", flag: "🇧🇾" },
  bg: { name: "Bulgarian", flag: "🇧🇬" },
  bn: { name: "Bengali", flag: "🇧🇩" },
  bs: { name: "Bosnian", flag: "🇧🇦" },
  ca: { name: "Catalan", flag: "🇪🇸" },
  cs: { name: "Czech", flag: "🇨🇿" },
  cy: { name: "Welsh", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  da: { name: "Danish", flag: "🇩🇰" },
  de: { name: "German", flag: "🇩🇪" },
  el: { name: "Greek", flag: "🇬🇷" },
  en: { name: "English", flag: "🇬🇧" },
  es: { name: "Spanish", flag: "🇪🇸" },
  et: { name: "Estonian", flag: "🇪🇪" },
  fa: { name: "Persian", flag: "🇮🇷" },
  fi: { name: "Finnish", flag: "🇫🇮" },
  fil: { name: "Filipino", flag: "🇵🇭" },
  fr: { name: "French", flag: "🇫🇷" },
  ga: { name: "Irish", flag: "🇮🇪" },
  gu: { name: "Gujarati", flag: "🇮🇳" },
  he: { name: "Hebrew", flag: "🇮🇱" },
  hi: { name: "Hindi", flag: "🇮🇳" },
  hr: { name: "Croatian", flag: "🇭🇷" },
  hu: { name: "Hungarian", flag: "🇭🇺" },
  hy: { name: "Armenian", flag: "🇦🇲" },
  id: { name: "Indonesian", flag: "🇮🇩" },
  is: { name: "Icelandic", flag: "🇮🇸" },
  it: { name: "Italian", flag: "🇮🇹" },
  ja: { name: "Japanese", flag: "🇯🇵" },
  ka: { name: "Georgian", flag: "🇬🇪" },
  kk: { name: "Kazakh", flag: "🇰🇿" },
  km: { name: "Khmer", flag: "🇰🇭" },
  kn: { name: "Kannada", flag: "🇮🇳" },
  ko: { name: "Korean", flag: "🇰🇷" },
  lt: { name: "Lithuanian", flag: "🇱🇹" },
  lv: { name: "Latvian", flag: "🇱🇻" },
  mk: { name: "Macedonian", flag: "🇲🇰" },
  ml: { name: "Malayalam", flag: "🇮🇳" },
  mn: { name: "Mongolian", flag: "🇲🇳" },
  mr: { name: "Marathi", flag: "🇮🇳" },
  ms: { name: "Malay", flag: "🇲🇾" },
  my: { name: "Burmese", flag: "🇲🇲" },
  nb: { name: "Norwegian Bokmål", flag: "🇳🇴" },
  ne: { name: "Nepali", flag: "🇳🇵" },
  nl: { name: "Dutch", flag: "🇳🇱" },
  no: { name: "Norwegian", flag: "🇳🇴" },
  pa: { name: "Punjabi", flag: "🇮🇳" },
  pl: { name: "Polish", flag: "🇵🇱" },
  pt: { name: "Portuguese", flag: "🇵🇹" },
  ro: { name: "Romanian", flag: "🇷🇴" },
  ru: { name: "Russian", flag: "🇷🇺" },
  si: { name: "Sinhala", flag: "🇱🇰" },
  sk: { name: "Slovak", flag: "🇸🇰" },
  sl: { name: "Slovenian", flag: "🇸🇮" },
  sq: { name: "Albanian", flag: "🇦🇱" },
  sr: { name: "Serbian", flag: "🇷🇸" },
  sv: { name: "Swedish", flag: "🇸🇪" },
  sw: { name: "Swahili", flag: "🇰🇪" },
  ta: { name: "Tamil", flag: "🇮🇳" },
  te: { name: "Telugu", flag: "🇮🇳" },
  th: { name: "Thai", flag: "🇹🇭" },
  tr: { name: "Turkish", flag: "🇹🇷" },
  uk: { name: "Ukrainian", flag: "🇺🇦" },
  ur: { name: "Urdu", flag: "🇵🇰" },
  uz: { name: "Uzbek", flag: "🇺🇿" },
  vi: { name: "Vietnamese", flag: "🇻🇳" },
  zh: { name: "Chinese", flag: "🇨🇳" },
};

const REGIONAL_VARIANTS: Record<string, LanguageEntry> = {
  "en-US": { name: "American English", flag: "🇺🇸" },
  "en-GB": { name: "British English", flag: "🇬🇧" },
  "en-AU": { name: "Australian English", flag: "🇦🇺" },
  "es-MX": { name: "Mexican Spanish", flag: "🇲🇽" },
  "es-AR": { name: "Argentine Spanish", flag: "🇦🇷" },
  "fr-CA": { name: "Canadian French", flag: "🇨🇦" },
  "fr-BE": { name: "Belgian French", flag: "🇧🇪" },
  "pt-BR": { name: "Brazilian Portuguese", flag: "🇧🇷" },
  "pt-PT": { name: "European Portuguese", flag: "🇵🇹" },
  "zh-Hans": { name: "Simplified Chinese", flag: "🇨🇳" },
  "zh-Hant": { name: "Traditional Chinese", flag: "🇹🇼" },
  "zh-CN": { name: "Simplified Chinese", flag: "🇨🇳" },
  "zh-TW": { name: "Traditional Chinese", flag: "🇹🇼" },
  "zh-HK": { name: "Hong Kong Chinese", flag: "🇭🇰" },
  "de-AT": { name: "Austrian German", flag: "🇦🇹" },
  "de-CH": { name: "Swiss German", flag: "🇨🇭" },
  "nl-BE": { name: "Flemish", flag: "🇧🇪" },
  "sr-Latn": { name: "Serbian (Latin)", flag: "🇷🇸" },
  "nb-NO": { name: "Norwegian Bokmål", flag: "🇳🇴" },
  "nn-NO": { name: "Norwegian Nynorsk", flag: "🇳🇴" },
};

function resolve(code: string): LanguageEntry | undefined {
  if (REGIONAL_VARIANTS[code]) return REGIONAL_VARIANTS[code];
  if (LANGUAGES[code]) return LANGUAGES[code];
  const base = code.split("-")[0];
  if (LANGUAGES[base]) return LANGUAGES[base];
  return undefined;
}

export function getLanguageName(code: string): string {
  return resolve(code)?.name ?? code;
}

export function getLanguageFlag(code: string): string {
  return resolve(code)?.flag ?? "🏳️";
}

export function isValidLocaleCode(code: string): boolean {
  return /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$|^[a-z]{2,3}-[A-Za-z]{2,4}$/.test(code);
}

import { validate } from "../placeholders/shield.js";

export interface QualityIssue {
  rule: string;
  severity: "error" | "warning";
  message: string;
  key: string;
}

export interface QualityRule {
  name: string;
  check(
    source: string,
    translation: string,
    targetLocale: string,
    key?: string,
  ): QualityIssue | null;
}

export const placeholderIntegrity: QualityRule = {
  name: "placeholderIntegrity",
  check(source, translation, _targetLocale, key = "") {
    const result = validate(source, translation);
    if (!result.valid) {
      return {
        rule: "placeholderIntegrity",
        severity: "error",
        message: result.details,
        key,
      };
    }
    return null;
  },
};

export const lengthRatio: QualityRule = {
  name: "lengthRatio",
  check(source, translation, _targetLocale, key = "") {
    if (source.length === 0) return null;
    const ratio = translation.length / source.length;
    if (ratio > 3) {
      return {
        rule: "lengthRatio",
        severity: "warning",
        message: `Translation is ${ratio.toFixed(1)}x longer than source`,
        key,
      };
    }
    if (ratio < 0.2) {
      return {
        rule: "lengthRatio",
        severity: "warning",
        message: `Translation is ${ratio.toFixed(1)}x shorter than source`,
        key,
      };
    }
    return null;
  },
};

export const untranslatedDetection: QualityRule = {
  name: "untranslatedDetection",
  check(source, translation, targetLocale, key = "") {
    if (targetLocale.startsWith("en")) return null;
    if (source.length === 0) return null;
    if (source === translation) {
      return {
        rule: "untranslatedDetection",
        severity: "warning",
        message: `Translation is identical to source for non-English locale "${targetLocale}"`,
        key,
      };
    }
    return null;
  },
};

export const formatPreservation: QualityRule = {
  name: "formatPreservation",
  check(source, translation, _targetLocale, key = "") {
    const issues: string[] = [];

    const sourceNewlines = (source.match(/\n/g) ?? []).length;
    const translationNewlines = (translation.match(/\n/g) ?? []).length;
    if (sourceNewlines !== translationNewlines) {
      issues.push(
        `newline count differs (source: ${sourceNewlines}, translation: ${translationNewlines})`,
      );
    }

    const sourceLeading = source.match(/^\s*/)?.[0] ?? "";
    const translationLeading = translation.match(/^\s*/)?.[0] ?? "";
    if (sourceLeading !== translationLeading) {
      issues.push("leading whitespace differs");
    }

    const sourceTrailing = source.match(/\s*$/)?.[0] ?? "";
    const translationTrailing = translation.match(/\s*$/)?.[0] ?? "";
    if (sourceTrailing !== translationTrailing) {
      issues.push("trailing whitespace differs");
    }

    if (issues.length > 0) {
      return {
        rule: "formatPreservation",
        severity: "warning",
        message: issues.join("; "),
        key,
      };
    }
    return null;
  },
};

export const emptyTranslation: QualityRule = {
  name: "emptyTranslation",
  check(source, translation, _targetLocale, key = "") {
    if (source.length > 0 && translation.trim().length === 0) {
      return {
        rule: "emptyTranslation",
        severity: "error",
        message: "Translation is empty for non-empty source",
        key,
      };
    }
    return null;
  },
};

export const DEFAULT_RULES: QualityRule[] = [
  placeholderIntegrity,
  lengthRatio,
  untranslatedDetection,
  formatPreservation,
  emptyTranslation,
];

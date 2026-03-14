import { DEFAULT_RULES, type QualityIssue, type QualityRule } from "./rules.js";

export interface QualityScore {
  score: number;
  issues: QualityIssue[];
  passed: boolean;
}

export interface KeyScore {
  key: string;
  score: QualityScore;
}

export interface AggregateQualityScore {
  score: number;
  totalKeys: number;
  passedKeys: number;
  failedKeys: number;
  issues: QualityIssue[];
  breakdown: KeyScore[];
}

const SEVERITY_DEDUCTIONS: Record<QualityIssue["severity"], number> = {
  error: 0.5,
  warning: 0.15,
};

export function scoreTranslation(
  source: string,
  translation: string,
  targetLocale: string,
  rules: QualityRule[] = DEFAULT_RULES,
  key = "",
): QualityScore {
  const issues: QualityIssue[] = [];

  for (const rule of rules) {
    const issue = rule.check(source, translation, targetLocale, key);
    if (issue) {
      issues.push(issue);
    }
  }

  let score = 1.0;
  for (const issue of issues) {
    score -= SEVERITY_DEDUCTIONS[issue.severity];
  }
  score = Math.max(0, Math.min(1, score));

  const hasErrors = issues.some((i) => i.severity === "error");

  return { score, issues, passed: !hasErrors };
}

export function scoreResults(
  results: Map<string, { source: string; translation: string }>,
  targetLocale: string,
  rules: QualityRule[] = DEFAULT_RULES,
): AggregateQualityScore {
  const breakdown: KeyScore[] = [];
  const allIssues: QualityIssue[] = [];
  let totalScore = 0;
  let passedKeys = 0;

  for (const [key, { source, translation }] of results) {
    const score = scoreTranslation(source, translation, targetLocale, rules, key);
    breakdown.push({ key, score });
    allIssues.push(...score.issues);
    totalScore += score.score;
    if (score.passed) passedKeys++;
  }

  const totalKeys = results.size;
  const avgScore = totalKeys > 0 ? totalScore / totalKeys : 1;

  return {
    score: Math.round(avgScore * 1000) / 1000,
    totalKeys,
    passedKeys,
    failedKeys: totalKeys - passedKeys,
    issues: allIssues,
    breakdown,
  };
}

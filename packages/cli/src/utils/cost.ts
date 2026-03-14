interface ModelPricing {
  input: number;
  output: number;
}

const PRICING_PER_MILLION: Record<string, ModelPricing> = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  "claude-sonnet-4-20250514": { input: 3.00, output: 15.00 },
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  if (model.startsWith("ollama/")) return 0;

  const pricing = PRICING_PER_MILLION[model];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

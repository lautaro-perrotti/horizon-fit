export const COST_TABLE: Record<string, { input_per_mtok: number; output_per_mtok: number }> = {
  "openai:gpt-4o-mini": { input_per_mtok: 0.15, output_per_mtok: 0.6 },
  "openai:gpt-4o": { input_per_mtok: 2.5, output_per_mtok: 10 },
  "anthropic:claude-sonnet-4-5": { input_per_mtok: 3, output_per_mtok: 15 },
  "gemini:gemini-2.0-flash": { input_per_mtok: 0.1, output_per_mtok: 0.4 },
  "ollama:llama3.2": { input_per_mtok: 0, output_per_mtok: 0 },
};

export function estimateCostUsd(model: string, inputTokens: number | null, outputTokens: number | null): number | null {
  const row = COST_TABLE[model];
  if (!row || inputTokens == null || outputTokens == null) return null;
  return Math.round(((inputTokens * row.input_per_mtok + outputTokens * row.output_per_mtok) / 1_000_000) * 1_000_000) / 1_000_000;
}

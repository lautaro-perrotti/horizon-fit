export const CHAT_EVALS = [
  { id: "prioritize", prompt: "¿Qué hay que priorizar hoy?", expectTools: ["growth.list_opportunities", "insights.overview"] },
  { id: "decline", prompt: "¿Por qué bajaron las ventas?", expectTools: ["commerce.sales", "metrics.series"] },
  { id: "seo", prompt: "¿Qué oportunidades de SEO hay?", expectTools: ["growth.list_opportunities", "seo.get_latest_audit"] },
  { id: "competitors", prompt: "Compará 001-TOP-AZU con la competencia", expectTools: ["competition.compare_product", "insights.get_product"] },
  { id: "titles", prompt: "Proponé titles SEO con evidencia", expectTools: ["seo.get_latest_audit", "insights.get_product"] },
] as const;

export function scoreChatEval(input: {
  id: string;
  tools: string[];
  text: string;
  latency_ms: number;
  cost_usd: number | null;
}): { id: string; tool_hit: boolean; unsupported: boolean; latency_ms: number; cost_usd: number | null; score: number } {
  const spec = CHAT_EVALS.find((row) => row.id === input.id);
  const tool_hit = Boolean(spec?.expectTools.some((name) => input.tools.includes(name)));
  const unsupported = /\$214[.\s]?000|inventad|lorem ipsum/i.test(input.text) || (!tool_hit && /\d{4,}/.test(input.text) && /revenue|sesiones|impresiones/i.test(input.text));
  const score = (tool_hit ? 60 : 0) + (unsupported ? 0 : 30) + (input.latency_ms < 8_000 ? 10 : 0);
  return { id: input.id, tool_hit, unsupported, latency_ms: input.latency_ms, cost_usd: input.cost_usd, score };
}

import { ALL_TOOLS, CLIENT_SCOPES, TOOL_SCOPES } from "../config.js";
import type { AuthPrincipal, ScopeName, ToolName } from "../types.js";

export const AI_RUNTIME_CLIENT = "ai-runtime";

export const AI_RUNTIME_SCOPES: ScopeName[] = [
  "ops.read",
  "catalog.read",
  "storefront.read",
  "seo.read",
  "merchant.read",
  "commerce.read",
  "metrics.read",
  "alerts.read",
  "analytics.read",
];

export const AI_RUNTIME_DENIED = new Set<ToolName>([
  "seo.audit",
  "merchant.audit",
  "alerts.evaluate",
  "assistant.ask",
  "growth.update_opportunity",
  "tests.run",
  "repo.status",
  "jobs.get",
  "audit.history",
  "ai.models",
  "ai.usage",
  "ai.tools",
]);

export function isAiRuntimeTool(tool: string): tool is ToolName {
  return (ALL_TOOLS as string[]).includes(tool) && !AI_RUNTIME_DENIED.has(tool as ToolName) && AI_RUNTIME_SCOPES.includes(TOOL_SCOPES[tool as ToolName]);
}

export function aiRuntimeTools(): ToolName[] {
  return ALL_TOOLS.filter((tool) => isAiRuntimeTool(tool));
}

export function createAiRuntimePrincipal(subject = "horizon-ai"): AuthPrincipal {
  return {
    token: "",
    clientId: AI_RUNTIME_CLIENT,
    subject,
    scopes: [...(CLIENT_SCOPES[AI_RUNTIME_CLIENT] ?? AI_RUNTIME_SCOPES)],
    expiresAt: 0,
    issuer: "horizon-control",
    audience: ["horizon-control"],
  };
}

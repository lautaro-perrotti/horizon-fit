import type { z } from "zod";
import { TOOL_SCOPES } from "../config.js";
import { dispatchCommand, TOOL_ARG_SCHEMAS, TOOL_DESCRIPTIONS } from "../core/commands/index.js";
import type { AppServices } from "../app-context.js";
import type { AuthPrincipal, ScopeName } from "../types.js";
import { aiRuntimeTools, createAiRuntimePrincipal, isAiRuntimeTool } from "./principal.js";

export type RegistryTool = {
  name: string;
  description: string;
  schema: z.ZodType;
  scope: ScopeName;
};

export type ToolEvidence = {
  source: string | null;
  fetched_at: string | null;
  status: string | null;
};

export type AiToolResult = {
  ok: boolean;
  tool: string;
  data: unknown;
  evidence: ToolEvidence;
  slices: ToolEvidence[];
  error?: string;
  code?: string;
  status?: number;
};

export { AI_RUNTIME_DENIED, aiRuntimeTools, isAiRuntimeTool } from "./principal.js";

export function registryTools(extra: RegistryTool[] = []): RegistryTool[] {
  return [
    ...aiRuntimeTools().map((name) => ({
      name,
      description: TOOL_DESCRIPTIONS[name],
      schema: TOOL_ARG_SCHEMAS[name],
      scope: TOOL_SCOPES[name],
    })),
    ...extra,
  ];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function pickString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value ? value : null;
}

export function evidenceFrom(data: unknown): ToolEvidence {
  const row = asRecord(data);
  if (!row) return { source: null, fetched_at: null, status: null };
  const source = pickString(row, "source");
  const fetched_at = pickString(row, "fetched_at");
  const status =
    pickString(row, "status") ??
    (row.configured === false ? "not_configured" : row.available === true ? "ok" : row.ok === false ? "error" : null);
  return { source, fetched_at, status };
}

export function collectEvidence(data: unknown, acc: ToolEvidence[] = [], depth = 0): ToolEvidence[] {
  if (depth > 4) return acc;
  const row = asRecord(data);
  if (!row) return acc;
  const slice = evidenceFrom(row);
  if (slice.source || slice.status || slice.fetched_at) acc.push(slice);
  for (const value of Object.values(row)) {
    if (value && typeof value === "object") collectEvidence(value, acc, depth + 1);
  }
  return acc;
}

export async function invokeAiTool(
  services: AppServices,
  tool: string,
  args: unknown,
  subject?: string,
  principal?: AuthPrincipal,
): Promise<AiToolResult> {
  if (!isAiRuntimeTool(tool)) {
    return {
      ok: false,
      tool,
      data: null,
      evidence: { source: null, fetched_at: null, status: "forbidden" },
      slices: [],
      error: "tool_not_in_ai_runtime",
      code: "insufficient_scope",
      status: 403,
    };
  }
  const actor = principal ?? createAiRuntimePrincipal(subject);
  const result = await dispatchCommand(services, tool, args, actor);
  if (!result.ok) {
    return {
      ok: false,
      tool,
      data: null,
      evidence: { source: null, fetched_at: null, status: "error" },
      slices: [],
      error: result.error,
      code: result.code,
      status: result.status,
    };
  }
  const evidence = evidenceFrom(result.data);
  return {
    ok: true,
    tool,
    data: result.data,
    evidence,
    slices: collectEvidence(result.data).filter((row) => row !== evidence || Boolean(row.source || row.status)),
  };
}

export function createAiToolRuntime(services: AppServices) {
  return {
    tools: () => registryTools(),
    invoke: (tool: string, args: unknown, subject?: string) => invokeAiTool(services, tool, args, subject),
    principal: (subject?: string) => createAiRuntimePrincipal(subject),
  };
}

export type AiToolRuntime = ReturnType<typeof createAiToolRuntime>;

import { ALL_TOOLS, CLIENT_SCOPES, SCOPE_ALIASES, TOOL_SCOPES } from "../config.js";
import type { AuthPrincipal, ToolName } from "../types.js";

export class ScopeError extends Error {
  readonly status = 403;
  readonly code = "insufficient_scope";
  constructor(
    readonly requiredScope: string,
    readonly tool: string,
  ) {
    super(`insufficient_scope: ${tool} requires ${requiredScope}`);
    this.name = "ScopeError";
  }
}

export function normalizeScopes(input: unknown): string[] {
  const raw = (() => {
    if (Array.isArray(input)) {
      return input.map(String).flatMap((value) => value.split(/[,\s]+/)).filter(Boolean);
    }
    if (typeof input === "string") {
      return input.split(/[,\s]+/).filter(Boolean);
    }
    return [] as string[];
  })();
  return [...new Set(raw.map((scope) => SCOPE_ALIASES[scope] ?? scope))];
}

export function hasScope(principal: AuthPrincipal, scope: string): boolean {
  return principal.scopes.includes(scope) || principal.scopes.includes("*") || principal.scopes.includes("admin");
}

export function assertToolScope(principal: AuthPrincipal, tool: ToolName): void {
  const required = TOOL_SCOPES[tool];
  if (!hasScope(principal, required)) {
    throw new ScopeError(required, tool);
  }
}

export function toolsForPrincipal(principal: AuthPrincipal): ToolName[] {
  return ALL_TOOLS.filter((tool) => hasScope(principal, TOOL_SCOPES[tool]));
}

export function scopesForClient(client: string): string[] {
  return CLIENT_SCOPES[client] ?? [];
}

export type HorizonClient = "claude" | "cursor" | "codex" | "admin" | "unknown";

export type ScopeName =
  | "ops.read"
  | "catalog.read"
  | "seo.read"
  | "seo.execute"
  | "merchant.read"
  | "merchant.execute"
  | "repo.read"
  | "tests.execute"
  | "jobs.read"
  | "audit.read";

export type ToolName =
  | "ops.health"
  | "catalog.search_products"
  | "catalog.get_product"
  | "storefront.get_config"
  | "seo.audit"
  | "seo.get_latest_audit"
  | "merchant.audit"
  | "merchant.get_diagnostics"
  | "repo.status"
  | "tests.run"
  | "jobs.get"
  | "audit.history";

export type AuthPrincipal = {
  token: string;
  clientId: string;
  subject: string;
  scopes: string[];
  expiresAt: number;
  issuer: string;
  audience: string[];
};

export type CommandResult<T = unknown> = {
  ok: true;
  data: T;
} | {
  ok: false;
  status: number;
  error: string;
  code?: string;
};

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type JobRecord = {
  id: string;
  type: string;
  status: JobStatus;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string | null;
  actor?: string | null;
  clientId?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type AuditEvent = {
  id: string;
  at: number;
  actor: string;
  clientId: string;
  tool: string;
  argsRedacted: Record<string, unknown>;
  outcome: "ok" | "error" | "forbidden" | "unauthorized";
  statusCode: number;
  jobId?: string | null;
  error?: string | null;
};

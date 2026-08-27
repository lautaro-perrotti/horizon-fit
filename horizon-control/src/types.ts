export type HorizonClient = "claude" | "cursor" | "codex" | "admin" | "unknown";

export type ScopeName =
  | "ops.read"
  | "catalog.read"
  | "storefront.read"
  | "seo.read"
  | "seo.audit"
  | "merchant.read"
  | "merchant.audit"
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

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type JobRecord = {
  id: string;
  type: string;
  status: JobStatus;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string | null;
  actor?: string | null;
  clientId?: string | null;
  attempt: number;
  maxAttempts: number;
  timeoutMs: number;
  createdAt: number;
  updatedAt: number;
  startedAt?: number | null;
  finishedAt?: number | null;
};

export type AuditEvent = {
  id: string;
  at: number;
  timestamp: number;
  actor: string;
  subject: string;
  clientId: string;
  tool: string;
  scope: string | null;
  argsRedacted: Record<string, unknown>;
  outcome: "ok" | "error" | "forbidden" | "unauthorized";
  statusCode: number;
  status: number;
  durationMs: number;
  jobId?: string | null;
  error?: string | null;
};

export type HealthStatus = "healthy" | "degraded" | "unavailable";

export type CatalogSearchFilters = {
  query?: string;
  sku?: string;
  category?: string;
  color?: string;
  size?: string;
  talle?: string;
  stock_status?: "instock" | "outofstock" | "onbackorder";
  page?: number;
  limit?: number;
};

export type CatalogVariation = {
  id: number;
  sku: string;
  name: string;
  parent: number;
  in_stock: boolean;
  price: { amount: string | null; currency: string; raw: string };
  attributes: Array<{ name: string; value: string }>;
  image: string | null;
};

export type CatalogProduct = {
  id: number;
  parent_sku: string;
  sku: string;
  slug: string;
  name: string;
  status: string;
  categories: Array<{ name: string; slug: string }>;
  description: string;
  short_description: string;
  images: string[];
  attributes: Record<string, string[]>;
  variations: CatalogVariation[];
  price: { amount: string | null; currency: string; raw: string };
  stock_status: string;
};

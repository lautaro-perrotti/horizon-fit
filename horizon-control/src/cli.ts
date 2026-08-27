#!/usr/bin/env node
/**
 * Thin CLI over /v1. Does not duplicate command logic.
 *
 *   horizon health
 *   horizon catalog search "dynamic"
 *   horizon catalog get 001-TOP-AZU
 *   horizon seo audit
 *   horizon merchant diagnostics
 *   horizon repo status
 *   horizon jobs get <id>
 *   horizon audit history
 */
const BASE = process.env.HORIZON_CONTROL_URL ?? "http://127.0.0.1:8787";
const TOKEN = process.env.HORIZON_CONTROL_TOKEN ?? "";

function flag(name: string, fallback = ""): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function positional(indexFromCommand: number): string {
  const rest = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  return rest[indexFromCommand] ?? "";
}

function catalogSearchPath(): string {
  const query = flag("query") || flag("q") || positional(2);
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  for (const key of ["sku", "category", "color", "size", "stock_status", "page", "limit"] as const) {
    const value = flag(key);
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return `/v1/catalog/products${qs ? `?${qs}` : ""}`;
}

const ROUTES: Record<string, () => { method: string; path: string; body?: unknown }> = {
  health: () => ({ method: "GET", path: "/v1/health" }),
  "catalog.search": () => ({ method: "GET", path: catalogSearchPath() }),
  "catalog.get": () => ({
    method: "GET",
    path: `/v1/catalog/products/${encodeURIComponent(flag("id") || positional(2))}`,
  }),
  "storefront.config": () => ({ method: "GET", path: "/v1/storefront/config" }),
  "seo.audit": () => ({ method: "POST", path: "/v1/seo/audit", body: {} }),
  "seo.latest": () => ({ method: "GET", path: "/v1/seo/audits/latest" }),
  "merchant.audit": () => ({ method: "POST", path: "/v1/merchant/audit" }),
  "merchant.diagnostics": () => ({ method: "GET", path: "/v1/merchant/diagnostics" }),
  "repo.status": () => ({ method: "GET", path: "/v1/repo/status" }),
  "tests.run": () => ({ method: "POST", path: "/v1/tests/run" }),
  "jobs.get": () => ({ method: "GET", path: `/v1/jobs/${encodeURIComponent(flag("id") || positional(2))}` }),
  "audit.history": () => ({ method: "GET", path: "/v1/audit/history" }),
  tools: () => ({ method: "GET", path: "/v1/tools" }),
};

function resolveCommand(): string {
  const a = process.argv[2];
  const b = process.argv[3];
  if (a === "catalog" && b === "search") return "catalog.search";
  if (a === "catalog" && b === "get") return "catalog.get";
  if (a === "seo" && b === "audit") return "seo.audit";
  if (a === "merchant" && (b === "diagnostics" || b === "audit")) {
    return b === "audit" ? "merchant.audit" : "merchant.diagnostics";
  }
  if (a === "repo" && b === "status") return "repo.status";
  if (a === "jobs" && b === "get") return "jobs.get";
  if (a === "audit" && b === "history") return "audit.history";
  return a ?? "health";
}

const aliases: Record<string, string> = {
  health: "health",
  "ops.health": "health",
  ops_health: "health",
  search: "catalog.search",
  "catalog.search": "catalog.search",
  "catalog.search_products": "catalog.search",
  catalog_search_products: "catalog.search",
  get: "catalog.get",
  "catalog.get": "catalog.get",
  "catalog.get_product": "catalog.get",
  catalog_get_product: "catalog.get",
  config: "storefront.config",
  "storefront.get_config": "storefront.config",
  storefront_get_config: "storefront.config",
  "seo.audit": "seo.audit",
  seo_audit: "seo.audit",
  "seo.get_latest_audit": "seo.latest",
  seo_get_latest_audit: "seo.latest",
  "merchant.audit": "merchant.audit",
  merchant_audit: "merchant.audit",
  "merchant.diagnostics": "merchant.diagnostics",
  "merchant.get_diagnostics": "merchant.diagnostics",
  merchant_get_diagnostics: "merchant.diagnostics",
  "repo.status": "repo.status",
  repo_status: "repo.status",
  "tests.run": "tests.run",
  tests_run: "tests.run",
  "jobs.get": "jobs.get",
  jobs_get: "jobs.get",
  "audit.history": "audit.history",
  audit_history: "audit.history",
  tools: "tools",
};

async function main() {
  const raw = resolveCommand();
  const key = aliases[raw] ?? raw;
  const route = ROUTES[key];
  if (!route) {
    console.error(`Unknown command: ${raw}`);
    console.error(`Commands: health | catalog search | catalog get | seo audit | merchant diagnostics | repo status | jobs get | audit history`);
    process.exit(1);
  }
  if (!TOKEN) {
    console.error("HORIZON_CONTROL_TOKEN is required");
    process.exit(1);
  }
  const spec = route();
  const response = await fetch(`${BASE}${spec.path}`, {
    method: spec.method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      ...(spec.body ? { "content-type": "application/json" } : {}),
    },
    body: spec.body ? JSON.stringify(spec.body) : undefined,
  });
  const text = await response.text();
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
  if (!response.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

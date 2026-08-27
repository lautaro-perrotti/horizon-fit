#!/usr/bin/env node
/**
 * Thin CLI over /v1. Does not duplicate command logic.
 *
 *   HORIZON_CONTROL_URL=http://127.0.0.1:8787
 *   HORIZON_CONTROL_TOKEN=<jwt>
 *   npx tsx src/cli.ts health
 *   npx tsx src/cli.ts catalog search --query=calza
 */
const BASE = process.env.HORIZON_CONTROL_URL ?? "http://127.0.0.1:8787";
const TOKEN = process.env.HORIZON_CONTROL_TOKEN ?? "";

function flag(name: string, fallback = ""): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const ROUTES: Record<string, () => { method: string; path: string; body?: unknown }> = {
  health: () => ({ method: "GET", path: "/v1/health" }),
  "catalog.search": () => ({ method: "GET", path: `/v1/catalog/products?q=${encodeURIComponent(flag("query") || flag("q"))}` }),
  "catalog.get": () => ({ method: "GET", path: `/v1/catalog/products/${encodeURIComponent(flag("id"))}` }),
  "storefront.config": () => ({ method: "GET", path: "/v1/storefront/config" }),
  "seo.audit": () => ({ method: "POST", path: "/v1/seo/audit", body: { url: flag("url") || undefined } }),
  "seo.latest": () => ({ method: "GET", path: "/v1/seo/audits/latest" }),
  "merchant.audit": () => ({ method: "POST", path: "/v1/merchant/audit" }),
  "merchant.diagnostics": () => ({ method: "GET", path: "/v1/merchant/diagnostics" }),
  "repo.status": () => ({ method: "GET", path: "/v1/repo/status" }),
  "tests.run": () => ({ method: "POST", path: "/v1/tests/run" }),
  "jobs.get": () => ({ method: "GET", path: `/v1/jobs/${encodeURIComponent(flag("id"))}` }),
  "audit.history": () => ({ method: "GET", path: "/v1/audit/history" }),
  tools: () => ({ method: "GET", path: "/v1/tools" }),
};

const aliases: Record<string, string> = {
  health: "health",
  "ops.health": "health",
  search: "catalog.search",
  "catalog.search_products": "catalog.search",
  get: "catalog.get",
  "catalog.get_product": "catalog.get",
  config: "storefront.config",
  "storefront.get_config": "storefront.config",
  "seo.audit": "seo.audit",
  "seo.get_latest_audit": "seo.latest",
  "merchant.audit": "merchant.audit",
  "merchant.get_diagnostics": "merchant.diagnostics",
  "repo.status": "repo.status",
  "tests.run": "tests.run",
  "jobs.get": "jobs.get",
  "audit.history": "audit.history",
  tools: "tools",
};

async function main() {
  const raw = process.argv[2] ?? "health";
  const key = aliases[raw] ?? raw;
  const route = ROUTES[key];
  if (!route) {
    console.error(`Unknown command: ${raw}`);
    console.error(`Commands: ${Object.keys(ROUTES).join(", ")}`);
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

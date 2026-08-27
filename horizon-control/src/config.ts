import { z } from "zod";
import type { ScopeName, ToolName } from "./types.js";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  HORIZON_BIND: z.string().default("127.0.0.1"),
  HORIZON_PORT: z.coerce.number().default(8787),
  HORIZON_PUBLIC_URL: z.string().optional(),
  HORIZON_OIDC_ISSUER: z.string().default("https://horizon-fit.example.auth0.com/"),
  HORIZON_OIDC_AUDIENCE: z.string().default("https://horizon-control.tailnet/mcp"),
  HORIZON_OIDC_JWKS_URL: z.string().optional(),
  HORIZON_OIDC_JWKS_URI: z.string().optional(),
  HORIZON_REPO_DIR: z.string().default(""),
  HORIZON_REPO_PATH: z.string().default(""),
  HORIZON_CACHE_DIR: z.string().default(""),
  HORIZON_MERCHANT_DIR: z.string().default(""),
  HORIZON_MERCHANT_DIAGNOSTICS_PATH: z.string().default(""),
  HORIZON_MERCHANT_DIAGNOSTICS_URL: z.string().default(""),
  HORIZON_SEO_REPORT_DIR: z.string().default(""),
  HORIZON_SQLITE_PATH: z.string().default(":memory:"),
  HORIZON_STOREFRONT_URL: z.string().default("https://horizonfit.com.ar"),
  HORIZON_WOO_BASE_URL: z.string().default("https://api.horizonfit.com.ar"),
  HORIZON_SPA_URL: z.string().optional(),
  HORIZON_WP_URL: z.string().optional(),
  HORIZON_GIT_FETCH: z.string().default(""),
  HORIZON_JOB_TIMEOUT_MS: z.coerce.number().default(120_000),
  HORIZON_JOB_MAX_ATTEMPTS: z.coerce.number().default(1),
  WOO_BASE_URL: z.string().default(""),
  WOO_USER: z.string().default(""),
  WOO_APP_PASSWORD: z.string().default(""),
  PHP_BIN: z.string().default("php"),
  NODE_BIN: z.string().default("node"),
});

export type Config = z.infer<typeof envSchema> & {
  publicUrl: string;
  resourceUrl: string;
  jwksUrl: string;
  repoPath: string;
  wooBaseUrl: string;
  storefrontUrl: string;
  merchantDiagnosticsPath: string;
  allowFetch: boolean;
};

export const PRODUCTION_HOSTS = ["horizonfit.com.ar", "www.horizonfit.com.ar", "api.horizonfit.com.ar"] as const;
export const SEO_AUDIT_ORIGIN = "https://horizonfit.com.ar";
export const SEO_AUDIT_ALLOWLIST = ["https://horizonfit.com.ar", "https://www.horizonfit.com.ar"];

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

export function loadConfig(overrides: Record<string, string | number | undefined> = {}): Config {
  const merged: Record<string, unknown> = { ...process.env, ...overrides };
  const parsed = envSchema.parse(merged);
  const publicUrl =
    parsed.HORIZON_PUBLIC_URL ?? `http://${parsed.HORIZON_BIND}:${parsed.HORIZON_PORT}`;
  const resourceUrl = `${publicUrl.replace(/\/$/, "")}/mcp`;
  const issuer = parsed.HORIZON_OIDC_ISSUER.endsWith("/")
    ? parsed.HORIZON_OIDC_ISSUER
    : `${parsed.HORIZON_OIDC_ISSUER}/`;
  const jwksUrl =
    firstNonEmpty(parsed.HORIZON_OIDC_JWKS_URI, parsed.HORIZON_OIDC_JWKS_URL) ||
    new URL(".well-known/jwks.json", issuer).toString();
  const wooBaseUrl = firstNonEmpty(parsed.HORIZON_WOO_BASE_URL, parsed.WOO_BASE_URL, "https://api.horizonfit.com.ar");
  const storefrontUrl = firstNonEmpty(
    parsed.HORIZON_STOREFRONT_URL,
    parsed.HORIZON_SPA_URL,
    "https://horizonfit.com.ar",
  );
  const repoPath = firstNonEmpty(parsed.HORIZON_REPO_PATH, parsed.HORIZON_REPO_DIR);
  const merchantDiagnosticsPath = firstNonEmpty(
    parsed.HORIZON_MERCHANT_DIAGNOSTICS_PATH,
    parsed.HORIZON_MERCHANT_DIR,
  );
  return {
    ...parsed,
    HORIZON_OIDC_ISSUER: issuer,
    publicUrl,
    resourceUrl,
    jwksUrl,
    repoPath,
    wooBaseUrl,
    storefrontUrl,
    merchantDiagnosticsPath,
    allowFetch: parsed.HORIZON_GIT_FETCH === "1" || parsed.HORIZON_GIT_FETCH.toLowerCase() === "true",
  };
}

export const ALL_SCOPES: ScopeName[] = [
  "ops.read",
  "catalog.read",
  "seo.read",
  "seo.execute",
  "merchant.read",
  "merchant.execute",
  "repo.read",
  "tests.execute",
  "jobs.read",
  "audit.read",
];

export const DENIED_TOOLS = [
  "shell.execute",
  "shell",
  "ssh",
  "ssh.execute",
  "wp.eval",
  "docker.exec",
  "sql",
  "sql.query",
  "files.write",
  "cache.regenerate",
  "catalog.write",
  "deploy",
  "rollback",
  "repo.merge",
  "repo.write",
  "http.request",
  "generic.http",
] as const;

export const TOOL_SCOPES: Record<ToolName, ScopeName> = {
  "ops.health": "ops.read",
  "catalog.search_products": "catalog.read",
  "catalog.get_product": "catalog.read",
  "storefront.get_config": "catalog.read",
  "seo.audit": "seo.execute",
  "seo.get_latest_audit": "seo.read",
  "merchant.audit": "merchant.execute",
  "merchant.get_diagnostics": "merchant.read",
  "repo.status": "repo.read",
  "tests.run": "tests.execute",
  "jobs.get": "jobs.read",
  "audit.history": "audit.read",
};

export const ALL_TOOLS = Object.keys(TOOL_SCOPES) as ToolName[];

export const CLIENT_SCOPES: Record<string, ScopeName[]> = {
  claude: [
    "ops.read",
    "catalog.read",
    "seo.read",
    "seo.execute",
    "merchant.read",
    "merchant.execute",
    "jobs.read",
    "audit.read",
  ],
  cursor: ["ops.read", "catalog.read", "repo.read", "tests.execute", "jobs.read", "audit.read"],
  codex: ["ops.read", "catalog.read", "repo.read", "tests.execute", "jobs.read", "audit.read"],
  admin: [...ALL_SCOPES],
};

export const ALLOWED_JOB_SCRIPTS = [
  "scripts/seo-audit.js",
  "tests/search-merchant-tests.php",
  "scripts/validate-home-v1.js",
] as const;

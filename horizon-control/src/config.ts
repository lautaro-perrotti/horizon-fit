import path from "node:path";
import { z } from "zod";
import type { ScopeName, ToolName } from "./types.js";
import { assertAllowedBind } from "./net/bind.js";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  HORIZON_BIND: z.string().default("127.0.0.1"),
  HORIZON_PORT: z.coerce.number().default(8787),
  HORIZON_PUBLIC_URL: z.string().optional(),
  HORIZON_OIDC_ISSUER: z.string().default("https://horizon-fit.example.auth0.com/"),
  HORIZON_OIDC_AUDIENCE: z.string().default("https://horizon-control"),
  HORIZON_OIDC_JWKS_URL: z.string().optional(),
  HORIZON_OIDC_JWKS_URI: z.string().optional(),
  HORIZON_REPO_DIR: z.string().default(""),
  HORIZON_REPO_PATH: z.string().default(""),
  HORIZON_CACHE_DIR: z.string().default(""),
  HORIZON_MERCHANT_DIR: z.string().default(""),
  HORIZON_MERCHANT_DIAGNOSTICS_PATH: z.string().default(""),
  HORIZON_MERCHANT_DIAGNOSTICS_URL: z.string().default(""),
  HORIZON_SEO_REPORT_DIR: z.string().default(""),
  HORIZON_DATA_DIR: z.string().default(""),
  HORIZON_SQLITE_PATH: z.string().default(""),
  HORIZON_OIDC_CLIENT_ALIASES: z.string().default(""),
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
  sqlitePath: string;
  dataDir: string;
  allowFetch: boolean;
  clientAliases: Record<string, string>;
};

export const PRODUCTION_HOSTS = ["horizonfit.com.ar", "www.horizonfit.com.ar", "api.horizonfit.com.ar"] as const;
export const SEO_AUDIT_ORIGIN = "https://horizonfit.com.ar";
export const SEO_AUDIT_ALLOWLIST = ["https://horizonfit.com.ar", "https://www.horizonfit.com.ar"];

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

function parseClientAliases(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(/[,;\n]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [id, alias] = trimmed.split(":").map((value) => value.trim());
    if (id && alias) out[id] = alias;
  }
  return out;
}

function joinSqliteFile(dir: string, file: string): string {
  if (dir.startsWith("/")) {
    return `${dir.replace(/\/+$/, "")}/${file}`;
  }
  return path.join(dir, file);
}

function resolveSqlitePath(parsed: z.infer<typeof envSchema>): { sqlitePath: string; dataDir: string } {
  const dataDir =
    parsed.HORIZON_DATA_DIR.trim() ||
    (parsed.NODE_ENV === "production" ? "/var/lib/horizon-control" : "");
  const explicit = parsed.HORIZON_SQLITE_PATH.trim();
  if (explicit) {
    return { sqlitePath: explicit, dataDir: dataDir || path.dirname(path.resolve(explicit)) };
  }
  if (dataDir) {
    return { sqlitePath: joinSqliteFile(dataDir, "horizon-control.sqlite"), dataDir };
  }
  return { sqlitePath: ":memory:", dataDir: "" };
}

export function loadConfig(overrides: Record<string, string | number | undefined> = {}): Config {
  const merged: Record<string, unknown> = { ...process.env, ...overrides };
  const parsed = envSchema.parse(merged);
  assertAllowedBind(parsed.HORIZON_BIND);
  const { sqlitePath, dataDir } = resolveSqlitePath(parsed);
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
    sqlitePath,
    dataDir,
    HORIZON_SQLITE_PATH: sqlitePath,
    HORIZON_DATA_DIR: dataDir,
    allowFetch: parsed.HORIZON_GIT_FETCH === "1" || parsed.HORIZON_GIT_FETCH.toLowerCase() === "true",
    clientAliases: parseClientAliases(parsed.HORIZON_OIDC_CLIENT_ALIASES),
  };
}

export const ALL_SCOPES: ScopeName[] = [
  "ops.read",
  "catalog.read",
  "storefront.read",
  "seo.read",
  "seo.audit",
  "merchant.read",
  "merchant.audit",
  "repo.read",
  "tests.execute",
  "jobs.read",
  "audit.read",
];

/** Historic Auth0 names accepted on inbound JWTs and canonicalized. */
export const SCOPE_ALIASES: Record<string, ScopeName> = {
  "seo.execute": "seo.audit",
  "merchant.execute": "merchant.audit",
};

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
  "storefront.get_config": "storefront.read",
  "seo.audit": "seo.audit",
  "seo.get_latest_audit": "seo.read",
  "merchant.audit": "merchant.audit",
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
    "storefront.read",
    "seo.read",
    "seo.audit",
    "merchant.read",
    "merchant.audit",
    "jobs.read",
    "audit.read",
  ],
  cursor: [
    "ops.read",
    "catalog.read",
    "storefront.read",
    "repo.read",
    "tests.execute",
    "jobs.read",
    "audit.read",
  ],
  codex: [
    "ops.read",
    "catalog.read",
    "storefront.read",
    "repo.read",
    "tests.execute",
    "jobs.read",
    "audit.read",
  ],
  admin: [...ALL_SCOPES],
};

export const ALLOWED_JOB_SCRIPTS = [
  "scripts/seo-audit.js",
  "tests/search-merchant-tests.php",
  "scripts/validate-home-v1.js",
] as const;

import { Hono, type Context } from "hono";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppServices } from "../app-context.js";
import { ALL_SCOPES, ALL_TOOLS } from "../config.js";
import { AuthError } from "../auth/resource-server.js";
import { protectedResourceMetadata, wwwAuthenticate } from "../auth/metadata.js";
import { dispatchCommand } from "../core/commands/index.js";
import { toolsForPrincipal } from "../auth/scopes.js";
import type { AuthPrincipal, ToolName } from "../types.js";
import { logJson, requestIdFrom } from "../observability/log.js";

type Variables = { principal: AuthPrincipal };

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export function createHttpApp(services: AppServices) {
  const app = new Hono<{ Variables: Variables }>();
  const config = services.config;

  app.get("/.well-known/oauth-protected-resource", (c) => c.json(protectedResourceMetadata(config)));
  app.get("/.well-known/oauth-protected-resource/mcp", (c) => c.json(protectedResourceMetadata(config)));

  app.use("*", async (c, next) => {
    const id = requestIdFrom(c.req.header("x-request-id"));
    c.header("x-request-id", id);
    const started = Date.now();
    await next();
    logJson("info", "http", {
      request_id: id,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Date.now() - started,
    });
  });

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: "horizon-control",
      bind: config.HORIZON_BIND,
      request_id: c.res.headers.get("x-request-id"),
      mcp: { path: "/mcp", advertised: true },
      worker: { last_tick_at: services.worker.lastTickAt, stopped: services.worker.stopped },
      integrations: {
        woo: Boolean(config.HORIZON_WOO_KEY && config.HORIZON_WOO_SECRET),
        google: Boolean(config.HORIZON_GOOGLE_SA_PATH || config.HORIZON_GOOGLE_SA_JSON),
        ga4: Boolean(config.HORIZON_GA4_PROPERTY_ID),
        competitors: Boolean(config.HORIZON_COMPETITOR_URLS.trim()),
        ai: services.gateway.listModels().configured,
      },
      gateway: {
        configured: services.gateway.listModels().configured,
        reason: services.gateway.listModels().reason ?? null,
      },
    }),
  );
  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "horizon-control",
      bind: config.HORIZON_BIND,
    }),
  );

  app.onError((error, c) => {
    if (error instanceof AuthError) {
      c.header("WWW-Authenticate", wwwAuthenticate(config, error.code));
      return c.json({ error: error.code, error_description: error.message }, 401);
    }
    return c.json({ error: "server_error", error_description: error.message }, 500);
  });

  app.use("/v1/*", async (c, next) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (!token) {
      c.header("WWW-Authenticate", wwwAuthenticate(config, "invalid_token", ALL_SCOPES[0]));
      return c.json({ error: "invalid_token", error_description: "missing_token" }, 401);
    }
    const principal = await services.auth.verifyAccessToken(token);
    c.set("principal", principal);
    await next();
  });

  async function invoke(
    c: { get: (key: "principal") => AuthPrincipal; json: (body: unknown, status?: 200 | 400 | 401 | 403 | 404 | 500) => Response; header: (name: string, value: string) => void },
    tool: ToolName,
    args: unknown,
  ) {
    const result = await dispatchCommand(services, tool, args, c.get("principal"));
    if (!result.ok) {
      if (result.status === 401) {
        c.header("WWW-Authenticate", wwwAuthenticate(config, "invalid_token"));
      }
      if (result.status === 403) {
        c.header("WWW-Authenticate", wwwAuthenticate(config, "insufficient_scope"));
      }
      const status =
        result.status === 400 || result.status === 401 || result.status === 403 || result.status === 404
          ? result.status
          : 500;
      return c.json({ error: result.code ?? "error", error_description: result.error }, status);
    }
    return c.json(result.data, 200);
  }

  app.get("/v1/health", (c) => invoke(c, "ops.health", {}));
  app.get("/v1/catalog/products", (c) => {
    const query = c.req.query();
    return invoke(c, "catalog.search_products", {
      query: query.q || query.query || undefined,
      sku: query.sku || undefined,
      category: query.category || undefined,
      color: query.color || undefined,
      size: query.size || query.talle || undefined,
      stock_status: query.stock_status || undefined,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  });
  app.get("/v1/catalog/products/:id", (c) => invoke(c, "catalog.get_product", { id: c.req.param("id") }));
  app.get("/v1/storefront/config", (c) => invoke(c, "storefront.get_config", {}));
  app.post("/v1/seo/audit", async (c) => invoke(c, "seo.audit", await c.req.json().catch(() => ({}))));
  app.get("/v1/seo/audits/latest", (c) => invoke(c, "seo.get_latest_audit", {}));
  app.post("/v1/merchant/audit", (c) => invoke(c, "merchant.audit", {}));
  app.get("/v1/merchant/diagnostics", (c) => invoke(c, "merchant.get_diagnostics", {}));
  app.get("/v1/repo/status", (c) => invoke(c, "repo.status", {}));
  app.post("/v1/tests/run", (c) => invoke(c, "tests.run", {}));
  app.get("/v1/jobs/:id", (c) => invoke(c, "jobs.get", { id: c.req.param("id") }));
  app.get("/v1/audit/history", (c) => {
    const limit = c.req.query("limit");
    return invoke(c, "audit.history", { limit: limit ? Number(limit) : undefined });
  });
  app.get("/v1/commerce/sales", (c) => invoke(c, "commerce.sales", {}));
  app.get("/v1/commerce/settings", (c) => invoke(c, "commerce.settings", {}));
  app.get("/v1/metrics/snapshots", (c) => {
    const limit = c.req.query("limit");
    const kpi = c.req.query("kpi");
    return invoke(c, "metrics.snapshots", {
      limit: limit ? Number(limit) : undefined,
      kpi: kpi || undefined,
    });
  });
  app.get("/v1/metrics/series", (c) => {
    const query = c.req.query();
    return invoke(c, "metrics.series", {
      metric: query.metric,
      entity: query.entity || query.sku || undefined,
      source: query.source || undefined,
      range: query.range || undefined,
      start: query.start || undefined,
      end: query.end || undefined,
      compare: query.compare || undefined,
    });
  });
  app.get("/v1/alerts", (c) => invoke(c, "alerts.list", {}));
  app.post("/v1/alerts/evaluate", (c) => invoke(c, "alerts.evaluate", {}));
  app.post("/v1/assistant/ask", async (c) => invoke(c, "assistant.ask", await c.req.json().catch(() => ({}))));
  app.get("/v1/analytics/search-console", (c) => invoke(c, "analytics.search_console", {}));
  app.get("/v1/analytics/ga4", (c) => invoke(c, "analytics.ga4", {}));
  app.get("/v1/analytics/competitors", (c) => invoke(c, "analytics.competitors", {}));
  app.get("/v1/insights/products", (c) => {
    const id = c.req.query("id") || c.req.query("sku") || "";
    return invoke(c, "insights.get_product", { id });
  });
  app.get("/v1/insights/products/:id", (c) => invoke(c, "insights.get_product", { id: c.req.param("id") }));
  app.get("/v1/insights/overview", (c) => invoke(c, "insights.overview", {}));
  app.get("/v1/competition", (c) => invoke(c, "competition.list", {}));
  app.get("/v1/competition/changes", (c) => invoke(c, "competition.changes", {}));
  app.get("/v1/competition/compare", (c) => invoke(c, "competition.compare_product", { id: c.req.query("id") || "" }));
  app.get("/v1/competition/item", (c) => invoke(c, "competition.get", { url: c.req.query("url") || "" }));
  app.get("/v1/growth/opportunities", (c) => invoke(c, "growth.list_opportunities", { status: c.req.query("status") || undefined }));
  app.get("/v1/growth/opportunities/:id", (c) => invoke(c, "growth.get_opportunity", { id: c.req.param("id") }));
  app.get("/v1/ai/models", (c) => invoke(c, "ai.models", {}));
  app.get("/v1/ai/usage", (c) => invoke(c, "ai.usage", {}));
  app.get("/v1/ai/tools", (c) => invoke(c, "ai.tools", {}));
  app.post("/v1/ai/chat", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return invoke(c, "ai.chat", body);
  });
  app.get("/v1/ai/sessions/:id", (c) => invoke(c, "ai.get_session", { id: c.req.param("id") }));
  app.get("/v1/content/drafts", (c) => invoke(c, "content.list_drafts", { status: c.req.query("status") || undefined }));
  app.get("/v1/content/drafts/:id", (c) => invoke(c, "content.get_draft", { id: c.req.param("id") }));
  app.post("/v1/content/generate", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return invoke(c, "content.generate", body);
  });
  app.get("/v1/customers", (c) => invoke(c, "customers.list", { segment: c.req.query("segment") || undefined }));
  app.get("/v1/customers/:id", (c) => invoke(c, "customers.get", { id: c.req.param("id") }));
  app.get("/v1/campaigns", (c) => invoke(c, "campaigns.list", {}));
  app.get("/v1/ads", (c) => invoke(c, "ads.status", {}));
  app.post("/v1/content/drafts/:id", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return invoke(c, "content.update_draft", { ...(body as object), id: c.req.param("id") });
  });
  app.post("/v1/growth/opportunities/:id", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return invoke(c, "growth.update_opportunity", { ...(body as object), id: c.req.param("id") });
  });
  app.get("/v1/tools", (c) =>
    c.json({
      tools: toolsForPrincipal(c.get("principal")),
      catalog: ALL_TOOLS,
    }),
  );

  mountDashboard(app, config);
  return app;
}

const DASHBOARD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dashboard");
const DASHBOARD_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
};
/** Subfolders the SPA may load from. `dev/` (fixtures) is added only in local fixture mode. */
const DASHBOARD_DIRS = new Set(["vendor", "core", "ui", "views", "fonts"]);
const DASHBOARD_BINARY = new Set([".woff2", ".png"]);
const DASHBOARD_LONG_CACHE = new Set(["vendor", "fonts"]);

type DashboardOptions = { fixtures: boolean; csp: string };

function originOf(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/** Strict CSP for /app: own scripts only, storefront in the Sitio frame, Auth0 for the token exchange. */
export function dashboardCsp(config: AppServices["config"]): string {
  const storefront = originOf(config.storefrontUrl);
  const api = originOf(config.wooBaseUrl);
  const issuer = originOf(config.HORIZON_OIDC_ISSUER);
  const images = ["'self'", "data:", storefront, api].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images}`,
    "font-src 'self'",
    `connect-src ${["'self'", issuer].filter(Boolean).join(" ")}`,
    `frame-src ${storefront ?? "'none'"}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
}

function mountDashboard(app: Hono<{ Variables: Variables }>, config: AppServices["config"]) {
  const options: DashboardOptions = {
    fixtures: config.HORIZON_DASHBOARD_FIXTURES === "1" && config.NODE_ENV !== "production",
    csp: dashboardCsp(config),
  };
  app.get("/app/config.json", (c) =>
    c.json({
      issuer: config.HORIZON_OIDC_ISSUER,
      audience: config.HORIZON_OIDC_AUDIENCE.split(/[,;]+/)[0]?.trim() || config.resourceUrl,
      resource: config.resourceUrl,
      clientId: config.HORIZON_DASHBOARD_CLIENT_ID,
      redirectUri: `${config.publicUrl.replace(/\/$/, "")}/app/callback`,
      apiBase: "/v1",
      storefrontUrl: config.storefrontUrl,
      apiUrl: config.wooBaseUrl,
      wpAdminUrl: `${config.wooBaseUrl.replace(/\/$/, "")}/wp-admin`,
      scopes: "openid ops.read catalog.read storefront.read commerce.read metrics.read alerts.read seo.read seo.audit analytics.read merchant.read ai.read ai.chat content.read content.write",
      fixtures: options.fixtures,
    }),
  );
  app.get("/app", (c) => c.redirect("/app/"));
  app.get("/app/", (c) => dashboardFile(c, "index.html", options));
  app.get("/app/callback", (c) => dashboardFile(c, "index.html", options));
  app.get("/app/:dir/:file", (c) => dashboardFile(c, `${c.req.param("dir")}/${c.req.param("file")}`, options));
  app.get("/app/:file", (c) => dashboardFile(c, c.req.param("file"), options));
}

function dashboardFile(c: Context, name: string, options: DashboardOptions) {
  const notFound = () => c.json({ error: "not_found" }, 404);
  const raw = name === "callback" || name === "" ? "index.html" : name.replaceAll("\\", "/");
  const parts = raw.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === ".." || part === "." || part.startsWith("."))) return notFound();
  if (parts.length > 2) return notFound();
  if (parts.length === 2 && !DASHBOARD_DIRS.has(parts[0]) && !(options.fixtures && parts[0] === "dev")) return notFound();
  const root = path.resolve(DASHBOARD_DIR);
  const resolved = path.resolve(root, ...parts);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return notFound();
  if (!fs.existsSync(resolved)) return notFound();
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) return notFound();
  const ext = path.extname(resolved).toLowerCase();
  const type = DASHBOARD_MIME[ext];
  if (!type) return notFound();
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const headers: Record<string, string> = {
    "content-type": type,
    etag,
    "cache-control": parts.length === 2 && DASHBOARD_LONG_CACHE.has(parts[0]) ? "public, max-age=604800" : "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
  if (ext === ".html") headers["content-security-policy"] = options.csp;
  if (c.req.header("if-none-match") === etag) return c.body(null, 304, headers);
  if (DASHBOARD_BINARY.has(ext)) return c.body(new Uint8Array(fs.readFileSync(resolved)), 200, headers);
  return c.body(fs.readFileSync(resolved, "utf8"), 200, headers);
}

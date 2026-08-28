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

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: "horizon-control",
      bind: config.HORIZON_BIND,
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
  app.get("/v1/alerts", (c) => invoke(c, "alerts.list", {}));
  app.post("/v1/alerts/evaluate", (c) => invoke(c, "alerts.evaluate", {}));
  app.post("/v1/assistant/ask", async (c) => invoke(c, "assistant.ask", await c.req.json().catch(() => ({}))));
  app.get("/v1/analytics/search-console", (c) => invoke(c, "analytics.search_console", {}));
  app.get("/v1/analytics/ga4", (c) => invoke(c, "analytics.ga4", {}));
  app.get("/v1/analytics/competitors", (c) => invoke(c, "analytics.competitors", {}));
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
};

function mountDashboard(app: Hono<{ Variables: Variables }>, config: AppServices["config"]) {
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
      scopes: "openid ops.read catalog.read storefront.read commerce.read metrics.read alerts.read seo.read seo.audit analytics.read",
    }),
  );
  app.get("/app", (c) => c.redirect("/app/"));
  app.get("/app/", (c) => dashboardFile(c, "index.html"));
  app.get("/app/callback", (c) => dashboardFile(c, "index.html"));
  app.get("/app/:file", (c) => dashboardFile(c, c.req.param("file")));
}

function dashboardFile(c: Context, name: string) {
  const file = name === "callback" || name === "" ? "index.html" : path.basename(name);
  if (!file || file.includes("..")) return c.json({ error: "not_found" }, 404);
  const root = path.resolve(DASHBOARD_DIR);
  const resolved = path.resolve(root, file);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return c.json({ error: "not_found" }, 404);
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return c.json({ error: "not_found" }, 404);
  }
  const ext = path.extname(resolved);
  const text = fs.readFileSync(resolved, "utf8");
  if (ext === ".html") return c.html(text);
  if (ext === ".css") return c.text(text, 200, { "content-type": "text/css; charset=utf-8" });
  if (ext === ".js") return c.text(text, 200, { "content-type": "text/javascript; charset=utf-8" });
  return c.text(text, 200, { "content-type": DASHBOARD_MIME[ext] ?? "text/plain; charset=utf-8" });
}

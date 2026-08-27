import { Hono } from "hono";
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
  app.get("/v1/tools", (c) =>
    c.json({
      tools: toolsForPrincipal(c.get("principal")),
      catalog: ALL_TOOLS,
    }),
  );

  return app;
}

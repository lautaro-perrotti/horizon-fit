import { z } from "zod";
import { ALL_TOOLS, DENIED_TOOLS, SEO_AUDIT_ORIGIN, TOOL_SCOPES } from "../../config.js";
import type { AppServices } from "../../app-context.js";
import { assertToolScope, ScopeError } from "../../auth/scopes.js";
import { AuthError } from "../../auth/resource-server.js";
import { assertSafeToolArgs, UnsafeArgsError } from "../../http/safe-args.js";
import { compactSeoJob, summaryFromJobResult } from "../../adapters/seo-report.js";
import type { AuthPrincipal, CommandResult, ToolName } from "../../types.js";

const searchSchema = z.object({
  query: z.string().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  talle: z.string().optional(),
  stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
const productIdSchema = z.object({
  id: z.union([z.string(), z.number()]),
});
const seoAuditSchema = z.object({}).passthrough();
const jobIdSchema = z.object({
  id: z.string().min(1),
});
const historySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});
const emptySchema = z.object({}).passthrough();
const askSchema = z.object({
  question: z.string().min(1).max(500),
});
const snapshotsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  kpi: z.string().min(1).max(64).optional(),
});

export const TOOL_ARG_SCHEMAS: Record<ToolName, z.ZodType> = {
  "ops.health": emptySchema,
  "catalog.search_products": searchSchema,
  "catalog.get_product": productIdSchema,
  "storefront.get_config": emptySchema,
  "seo.audit": seoAuditSchema,
  "seo.get_latest_audit": emptySchema,
  "merchant.audit": emptySchema,
  "merchant.get_diagnostics": emptySchema,
  "repo.status": emptySchema,
  "tests.run": emptySchema,
  "jobs.get": jobIdSchema,
  "audit.history": historySchema,
  "commerce.sales": emptySchema,
  "commerce.settings": emptySchema,
  "metrics.snapshots": snapshotsSchema,
  "alerts.list": emptySchema,
  "alerts.evaluate": emptySchema,
  "assistant.ask": askSchema,
  "analytics.search_console": emptySchema,
  "analytics.ga4": emptySchema,
  "analytics.competitors": emptySchema,
  "insights.get_product": productIdSchema,
};

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  "ops.health": "Read-only health of storefront HTTP, Woo/API HTTP, repo HEAD, CP uptime, DB and worker.",
  "catalog.search_products": "Search published Woo Store API products (query, SKU, category, color, talle, stock, page).",
  "catalog.get_product": "Get one product by id, parent SKU, or slug (read-only).",
  "storefront.get_config": "Read menu, home sections, hero, and marquee from existing caches/endpoints.",
  "seo.audit": "Enqueue allowlisted SEO audit of https://horizonfit.com.ar. Agent URLs are ignored.",
  "seo.get_latest_audit": "Read the latest SEO audit summary (pages with issues, totals). Never invents findings.",
  "merchant.audit": "Record a job that reads existing merchant diagnostics. Does not regenerate feeds.",
  "merchant.get_diagnostics": "Read merchant-diagnostics.txt and merchant-products.json.",
  "repo.status": "Local git status of HORIZON_REPO_PATH. Read only; no fetch unless configured.",
  "tests.run": "Enqueue existing PHP search-merchant tests and node validators.",
  "jobs.get": "Get a previously enqueued operational job by id.",
  "audit.history": "Read redacted command audit history.",
  "commerce.sales": "Read Woo REST paid orders (90d) with line items and SKU rollups. configured:false without keys. Never invents revenue.",
  "commerce.settings": "Read allowlisted Woo general settings and payment gateways. No secrets.",
  "metrics.snapshots": "List recent metric snapshots from the local warehouse.",
  "alerts.list": "List warehouse alerts (open and resolved).",
  "alerts.evaluate": "Run deterministic alert rules (storefront, stock sample, failed jobs, SEO).",
  "assistant.ask": "Deterministic consult over health, catalog (max 10), sales, SEO, GA4/GSC, competitors, allowlisted charts, or alerts. No LLM.",
  "analytics.search_console": "Read Search Console clicks/impressions for horizonfit.com.ar. configured:false without Google credentials.",
  "analytics.ga4": "Read GA4 sessions/users/channels. configured:false without credentials or property id.",
  "analytics.competitors": "Probe env-allowlisted competitor homepages. Agent URLs are ignored. configured:false if HORIZON_COMPETITOR_URLS is empty.",
  "insights.get_product": "Product 360 join: catalog + SKU sales around parent_sku. Other slices unavailable until later phases. Never invents metrics.",
};

async function runTool(services: AppServices, tool: ToolName, rawArgs: unknown, principal: AuthPrincipal) {
  const args = TOOL_ARG_SCHEMAS[tool].parse(rawArgs ?? {});
  switch (tool) {
    case "ops.health":
      return services.health.report();
    case "catalog.search_products": {
      const parsed = searchSchema.parse(args);
      const filters = {
        ...parsed,
        query: parsed.query?.trim() || undefined,
        sku: parsed.sku?.trim() || undefined,
        size: parsed.size?.trim() || parsed.talle?.trim() || undefined,
      };
      return services.catalog.searchProducts(filters);
    }
    case "catalog.get_product": {
      const parsed = productIdSchema.parse(args);
      const product = await services.catalog.getProduct(parsed.id);
      if (!product) {
        throw Object.assign(new Error("not_found"), { status: 404 });
      }
      return product;
    }
    case "storefront.get_config":
      return services.storefront.getConfig();
    case "seo.audit":
      return services.jobs.enqueue({
        type: "seo.audit",
        args: { target: SEO_AUDIT_ORIGIN },
        actor: principal.subject,
        clientId: principal.clientId,
      });
    case "seo.get_latest_audit": {
      const latest = await services.jobs.latestOfType("seo.audit");
      const fromJob = summaryFromJobResult(latest?.result);
      const fromDisk = services.seo.readLatest();
      const summary = fromJob ?? fromDisk.summary ?? null;
      return {
        configured: Boolean(summary),
        reason: summary ? undefined : fromDisk.reason ?? "missing_seo_report",
        job: compactSeoJob(latest),
        summary,
      };
    }
    case "merchant.audit": {
      const snapshot = await services.merchant.readDiagnostics();
      return services.jobs.enqueue({
        type: "merchant.audit",
        args: { regenerated: false, path: snapshot.path, source: snapshot.source },
        actor: principal.subject,
        clientId: principal.clientId,
      });
    }
    case "merchant.get_diagnostics":
      return services.merchant.readDiagnostics();
    case "repo.status":
      return services.git.status();
    case "tests.run":
      return services.jobs.enqueue({
        type: "tests.run",
        args: { suites: ["search-merchant-tests.php", "validate-home-v1.js"] },
        actor: principal.subject,
        clientId: principal.clientId,
      });
    case "jobs.get": {
      const parsed = jobIdSchema.parse(args);
      const job = await services.jobs.get(parsed.id);
      if (!job) throw Object.assign(new Error("not_found"), { status: 404 });
      return job;
    }
    case "audit.history": {
      const parsed = historySchema.parse(args);
      return { events: await services.audit.history(parsed.limit) };
    }
    case "commerce.sales": {
      const sales = await services.commerce.sales();
      services.warehouse.recordSales(sales);
      return sales;
    }
    case "commerce.settings":
      return services.commerce.settings();
    case "metrics.snapshots": {
      const parsed = snapshotsSchema.parse(args);
      return { snapshots: services.warehouse.snapshots(parsed.limit, parsed.kpi) };
    }
    case "alerts.list":
      return { alerts: services.warehouse.listAlerts() };
    case "alerts.evaluate":
      return services.warehouse.evaluate();
    case "assistant.ask": {
      const parsed = askSchema.parse(args);
      return services.assistant.ask(parsed.question);
    }
    case "analytics.search_console": {
      const report = await services.analytics.searchConsole();
      services.warehouse.recordGsc(report);
      return report;
    }
    case "analytics.ga4": {
      const report = await services.analytics.ga4();
      services.warehouse.recordGa4(report);
      return report;
    }
    case "analytics.competitors":
      return services.competitors.snapshot();
    case "insights.get_product": {
      const parsed = productIdSchema.parse(args);
      const insight = await services.insights.getProduct(parsed.id);
      if (!insight) {
        throw Object.assign(new Error("not_found"), { status: 404 });
      }
      return insight;
    }
    default: {
      const exhaustive: never = tool;
      throw new Error(`unknown_tool:${exhaustive}`);
    }
  }
}

export async function dispatchCommand(
  services: AppServices,
  tool: string,
  rawArgs: unknown,
  principal: AuthPrincipal,
): Promise<CommandResult> {
  const started = Date.now();
  const duration = () => Date.now() - started;

  if ((DENIED_TOOLS as readonly string[]).includes(tool) || !ALL_TOOLS.includes(tool as ToolName)) {
    await services.audit.record({
      principal,
      tool,
      args: rawArgs,
      outcome: "forbidden",
      statusCode: 403,
      durationMs: duration(),
      error: "tool_not_allowed",
    });
    return { ok: false, status: 403, error: "tool_not_allowed", code: "insufficient_scope" };
  }

  const named = tool as ToolName;
  try {
    assertToolScope(principal, named);
    assertSafeToolArgs(rawArgs);
  } catch (error) {
    if (error instanceof ScopeError) {
      await services.audit.record({
        principal,
        tool,
        args: rawArgs,
        outcome: "forbidden",
        statusCode: 403,
        durationMs: duration(),
        error: error.message,
      });
      return { ok: false, status: 403, error: error.message, code: error.code };
    }
    if (error instanceof UnsafeArgsError) {
      await services.audit.record({
        principal,
        tool,
        args: rawArgs,
        outcome: "error",
        statusCode: 400,
        durationMs: duration(),
        error: error.message,
      });
      return { ok: false, status: 400, error: error.message, code: error.code };
    }
    throw error;
  }

  try {
    const data = await runTool(services, named, rawArgs, principal);
    const jobId = data && typeof data === "object" && "id" in data && "type" in data
      ? String((data as { id: string }).id)
      : null;
    await services.audit.record({
      principal,
      tool,
      args: rawArgs,
      outcome: "ok",
      statusCode: 200,
      durationMs: duration(),
      jobId,
    });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, status: 401, error: error.message, code: error.code };
    }
    if (error instanceof z.ZodError) {
      await services.audit.record({
        principal,
        tool,
        args: rawArgs,
        outcome: "error",
        statusCode: 400,
        durationMs: duration(),
        error: error.message,
      });
      return { ok: false, status: 400, error: error.message, code: "invalid_args" };
    }
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : String(error);
    await services.audit.record({
      principal,
      tool,
      args: rawArgs,
      outcome: "error",
      statusCode: status,
      durationMs: duration(),
      error: message,
    });
    return { ok: false, status, error: message };
  }
}

export { ALL_TOOLS, DENIED_TOOLS, TOOL_SCOPES };

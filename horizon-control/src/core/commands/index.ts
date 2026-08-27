import { z } from "zod";
import { ALL_TOOLS, DENIED_TOOLS, SEO_AUDIT_ORIGIN, TOOL_SCOPES } from "../../config.js";
import type { AppServices } from "../../app-context.js";
import { assertToolScope, ScopeError } from "../../auth/scopes.js";
import { AuthError } from "../../auth/resource-server.js";
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
};

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  "ops.health": "Read-only health of storefront HTTP, Woo/API HTTP, repo HEAD, CP uptime, DB and worker.",
  "catalog.search_products": "Search published Woo Store API products (query, SKU, category, color, talle, stock, page).",
  "catalog.get_product": "Get one product by id, parent SKU, or slug (read-only).",
  "storefront.get_config": "Read menu, home sections, hero, and marquee from existing caches/endpoints.",
  "seo.audit": "Enqueue allowlisted SEO audit of https://horizonfit.com.ar. Agent URLs are ignored.",
  "seo.get_latest_audit": "Read the latest seo.audit job result stored by Horizon Control.",
  "merchant.audit": "Record a job that reads existing merchant diagnostics. Does not regenerate feeds.",
  "merchant.get_diagnostics": "Read merchant-diagnostics.txt and merchant-products.json.",
  "repo.status": "Local git status of HORIZON_REPO_PATH. Read only; no fetch unless configured.",
  "tests.run": "Enqueue existing PHP search-merchant tests and node validators.",
  "jobs.get": "Get a previously enqueued operational job by id.",
  "audit.history": "Read redacted command audit history.",
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
      return latest ? { job: latest } : { job: null };
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

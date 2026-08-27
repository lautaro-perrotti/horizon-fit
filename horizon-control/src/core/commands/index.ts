import { z } from "zod";
import { ALL_TOOLS, DENIED_TOOLS, TOOL_SCOPES } from "../../config.js";
import type { AppServices } from "../../app-context.js";
import { assertToolScope, ScopeError } from "../../auth/scopes.js";
import { AuthError } from "../../auth/resource-server.js";
import type { AuthPrincipal, CommandResult, ToolName } from "../../types.js";

const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional(),
});
const productIdSchema = z.object({
  id: z.union([z.string(), z.number()]),
});
const seoAuditSchema = z.object({
  url: z.string().url().optional(),
});
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
  "ops.health": "Read-only health: docker inspect of shop containers, HTTP 8088/8089, git SHA vs origin/main.",
  "catalog.search_products": "Search published Woo products (read-only REST). Secrets stay on the server.",
  "catalog.get_product": "Get one Woo product by id (read-only).",
  "storefront.get_config": "Read storefront cache JSON from uploads if configured.",
  "seo.audit": "Enqueue allowlisted SEO audit (https://horizonfit.com.ar only). Writes gitignored reports.",
  "seo.get_latest_audit": "Read the latest reports/seo-audit JSON, or empty.",
  "merchant.audit": "Record a job that reads existing merchant diagnostics. Does not regenerate feeds.",
  "merchant.get_diagnostics": "Read merchant-diagnostics.txt and merchant-products.json.",
  "repo.status": "Local git status of the configured repo (branch, dirty, ahead/behind). Read only.",
  "tests.run": "Enqueue existing PHP search-merchant tests and node validators.",
  "jobs.get": "Get a previously enqueued operational job by id.",
  "audit.history": "Read redacted command audit history.",
};

async function runTool(services: AppServices, tool: ToolName, rawArgs: unknown, principal: AuthPrincipal) {
  const args = TOOL_ARG_SCHEMAS[tool].parse(rawArgs ?? {});
  switch (tool) {
    case "ops.health": {
      const [containers, spa, wp, git] = await Promise.all([
        services.vps.inspectContainers(),
        services.vps.probeHttp(services.config.HORIZON_SPA_URL),
        services.vps.probeHttp(services.config.HORIZON_WP_URL),
        services.vps.compareGit(),
      ]);
      return {
        containers,
        http: { spa, wp },
        git,
        github: services.github,
      };
    }
    case "catalog.search_products": {
      const parsed = searchSchema.parse(args);
      const products = await services.woo.searchProducts(parsed.query, parsed.limit);
      return {
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          status: product.status,
          permalink: product.permalink,
          price: product.price,
          stock_status: product.stock_status,
        })),
      };
    }
    case "catalog.get_product": {
      const parsed = productIdSchema.parse(args);
      const product = await services.woo.getProduct(parsed.id);
      if (!product) {
        const error = new Error("not_found");
        (error as Error & { status?: number }).status = 404;
        throw error;
      }
      return product;
    }
    case "storefront.get_config":
      return services.cache.readStorefrontConfig();
    case "seo.audit": {
      const parsed = seoAuditSchema.parse(args);
      return services.jobs.enqueue({
        type: "seo.audit",
        args: { url: parsed.url ?? "https://horizonfit.com.ar" },
        actor: principal.subject,
        clientId: principal.clientId,
      });
    }
    case "seo.get_latest_audit":
      return services.cache.readLatestSeoAudit();
    case "merchant.audit": {
      const snapshot = await services.cache.readMerchantDiagnostics();
      return services.jobs.enqueue({
        type: "merchant.audit",
        args: { regenerated: false, path: snapshot.path },
        actor: principal.subject,
        clientId: principal.clientId,
      });
    }
    case "merchant.get_diagnostics":
      return services.cache.readMerchantDiagnostics();
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
      if (!job) {
        const error = new Error("not_found");
        (error as Error & { status?: number }).status = 404;
        throw error;
      }
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
  if ((DENIED_TOOLS as readonly string[]).includes(tool) || !ALL_TOOLS.includes(tool as ToolName)) {
    await services.audit.record({
      principal,
      tool,
      args: rawArgs,
      outcome: "forbidden",
      statusCode: 403,
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
      error: message,
    });
    return { ok: false, status, error: message };
  }
}

export { ALL_TOOLS, DENIED_TOOLS, TOOL_SCOPES };

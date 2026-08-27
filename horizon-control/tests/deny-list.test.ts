import { describe, expect, it } from "vitest";
import { ALL_TOOLS, DENIED_TOOLS, CLIENT_SCOPES, TOOL_SCOPES } from "../src/config.js";
import { denyList, listRegisteredTools } from "../src/mcp/index.js";
import { buildTestApp, request, signToken } from "./helpers.js";

describe("deny list / no arbitrary shell", () => {
  it("registered MCP tools use Cursor-safe underscore names", () => {
    expect(listRegisteredTools()).toEqual([
      "ops_health",
      "catalog_search_products",
      "catalog_get_product",
      "storefront_get_config",
      "seo_audit",
      "seo_get_latest_audit",
      "merchant_audit",
      "merchant_get_diagnostics",
      "repo_status",
      "tests_run",
      "jobs_get",
      "audit_history",
      "commerce_sales",
      "commerce_settings",
      "metrics_snapshots",
      "alerts_list",
      "alerts_evaluate",
      "assistant_ask",
    ]);
    expect(listRegisteredTools()).toHaveLength(18);
    expect(listRegisteredTools()).not.toEqual(ALL_TOOLS);
  });

  it("tool catalog has no shell, ssh, eval, sql, docker exec, files.write, cache.regenerate, or deploy", () => {
    const tools = listRegisteredTools();
    for (const denied of DENIED_TOOLS) {
      expect(tools).not.toContain(denied);
    }
    const joined = tools.join(" ");
    expect(joined).not.toMatch(/shell|ssh|\beval\b|docker\.exec|\bsql\b|files\.write|cache\.regenerate|deploy|rollback|http\.request/i);
    expect(denyList()).toEqual(expect.arrayContaining(["shell.execute", "ssh", "wp.eval", "cache.regenerate", "http.request"]));
  });

  it("Cursor token cannot mutate production: no regenerate/deploy/write tools even listed", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    const response = await request(app, "/v1/tools", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.catalog).toEqual(ALL_TOOLS);
    expect(body.tools).toEqual([
      "ops.health",
      "catalog.search_products",
      "catalog.get_product",
      "storefront.get_config",
      "repo.status",
      "tests.run",
      "jobs.get",
      "audit.history",
    ]);
    expect(body.tools).not.toContain("seo.audit");
    expect(body.tools).not.toContain("merchant.audit");
    expect(body.tools).not.toContain("commerce.sales");
    expect(body.tools).not.toContain("alerts.list");
    expect(body.tools).not.toContain("assistant.ask");
    expect(body.catalog).not.toContain("cache.regenerate");
    expect(body.catalog).not.toContain("deploy");
    expect(body.catalog).not.toContain("shell.execute");
  });

  it("every registered tool has a mapped scope", () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_SCOPES[tool]).toBeTruthy();
    }
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ALL_TOOLS, CLIENT_SCOPES, DENIED_TOOLS, TOOL_SCOPES } from "../src/config.js";
import { AI_RUNTIME_DENIED, aiRuntimeTools, createAiRuntimePrincipal } from "../src/ai/principal.js";
import { invokeAiTool, registryTools } from "../src/ai/tools.js";
import { dispatchCommand } from "../src/core/commands/index.js";
import { buildTestApp, request, signToken } from "./helpers.js";

describe("AI tool registry", () => {
  it("derives runtime tools from the shared command catalog", () => {
    const tools = aiRuntimeTools();
    expect(tools.length).toBeGreaterThan(8);
    for (const tool of tools) {
      expect(ALL_TOOLS).toContain(tool);
      expect(AI_RUNTIME_DENIED.has(tool)).toBe(false);
      expect(TOOL_SCOPES[tool]).toBeTruthy();
    }
    expect(tools).toContain("insights.get_product");
    expect(tools).toContain("growth.list_opportunities");
    expect(tools).toContain("customers.list");
    expect(tools).toContain("campaigns.list");
    expect(tools).toContain("ads.status");
    expect(tools).not.toContain("growth.update_opportunity");
    expect(tools).not.toContain("tests.run");
    expect(tools).not.toContain("assistant.ask");
    expect(tools).not.toContain("seo.audit");
    for (const denied of DENIED_TOOLS) {
      expect(tools).not.toContain(denied);
    }
    const extra = registryTools([
      { name: "design.update", description: "Studio-only", schema: z.object({}), scope: "catalog.read" },
    ]);
    expect(extra.some((row) => row.name === "design.update")).toBe(true);
    expect(ALL_TOOLS).not.toContain("design.update");
  });

  it("invokes the same dispatchCommand path and attaches evidence", async () => {
    const { app, keys, services } = await buildTestApp();
    const viaRuntime = await services.runtime.invoke("catalog.search_products", { query: "calza" });
    expect(viaRuntime.ok).toBe(true);
    const products = (viaRuntime.data as { products: Array<{ sku: string }> }).products;
    expect(products[0].sku).toBe("HF-C1");
    expect(viaRuntime.slices).toEqual(expect.any(Array));

    const principal = createAiRuntimePrincipal("test-ai");
    const viaDispatch = await dispatchCommand(services, "catalog.search_products", { query: "calza" }, principal);
    expect(viaDispatch.ok).toBe(true);

    const blocked = await invokeAiTool(services, "tests.run", {});
    expect(blocked.ok).toBe(false);
    expect(blocked.status).toBe(403);
    expect(blocked.error).toBe("tool_not_in_ai_runtime");

    const mutate = await invokeAiTool(services, "growth.update_opportunity", { id: "x", action: "dismiss" });
    expect(mutate.ok).toBe(false);

    const sales = await services.runtime.invoke("commerce.sales", {});
    expect(sales.ok).toBe(true);
    expect(sales.evidence.status).toBe("not_configured");
    expect(sales.evidence.source).toBeTruthy();

    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const listed = await request(app, "/v1/ai/tools", { token });
    expect(listed.status).toBe(200);
    const body = await listed.json();
    expect(body.tools.map((row: { name: string }) => row.name)).toEqual(aiRuntimeTools());
  });

  it("Cursor cannot list or impersonate the AI runtime catalog", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    expect((await request(app, "/v1/ai/tools", { token })).status).toBe(403);
  });
});

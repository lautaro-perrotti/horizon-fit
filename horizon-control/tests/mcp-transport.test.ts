import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { CLIENT_SCOPES } from "../src/config.js";
import {
  buildTestApp,
  closeServer,
  listenHorizon,
  mcpCallTool,
  mcpInitialize,
  mcpRpc,
  signToken,
} from "./helpers.js";

const servers: Server[] = [];

afterEach(async () => {
  while (servers.length) {
    const server = servers.pop();
    if (server) await closeServer(server);
  }
});

describe("MCP HTTP transport (JWT + adapters, fixtures)", () => {
  it("client → JWT → /mcp tools/call → catalog.get_product 001-TOP-AZU", async () => {
    const { services, keys } = await buildTestApp();
    const { server, base } = await listenHorizon(services);
    servers.push(server);
    const token = await signToken(keys.privateKey, { client: "claude", scopes: CLIENT_SCOPES.claude });

    const init = await mcpInitialize(base, token);
    expect(init.status).toBe(200);

    const call = await mcpCallTool(base, token, "catalog.get_product", { id: "001-TOP-AZU" });
    expect(call.httpStatus).toBe(200);
    expect(call.isError).toBe(false);
    expect(call.tool).toMatchObject({
      sku: "001-TOP-AZU",
      parent_sku: "001-TOP-AZU",
    });
  });

  it("ops.health, merchant.get_diagnostics, repo.status, audit.history go through /mcp", async () => {
    const { services, keys } = await buildTestApp();
    const { server, base } = await listenHorizon(services);
    servers.push(server);
    const admin = await signToken(keys.privateKey, { client: "admin", scopes: CLIENT_SCOPES.admin });
    await mcpInitialize(base, admin);

    const health = await mcpCallTool(base, admin, "ops.health", {});
    expect(health.isError).toBe(false);
    expect(["healthy", "degraded", "unavailable"]).toContain(health.tool?.status);

    const merchant = await mcpCallTool(base, admin, "merchant.get_diagnostics", {});
    expect(merchant.isError).toBe(false);
    expect(String(merchant.tool?.diagnosticsTxt ?? "")).toMatch(/Merchant diagnostics/);

    const repo = await mcpCallTool(base, admin, "repo.status", {});
    expect(repo.isError).toBe(false);
    expect(repo.tool?.branch).toBe("feat/horizon-control");

    const seo = await mcpCallTool(base, admin, "seo.audit", {});
    expect(seo.isError).toBe(false);
    expect(seo.tool?.type).toBe("seo.audit");
    const jobId = String(seo.tool?.id ?? "");

    const job = await mcpCallTool(base, admin, "jobs.get", { id: jobId });
    expect(job.isError).toBe(false);
    expect(job.tool?.id).toBe(jobId);

    const history = await mcpCallTool(base, admin, "audit.history", { limit: 20 });
    expect(history.isError).toBe(false);
    const events = (history.tool?.events as Array<Record<string, unknown>>) ?? [];
    expect(events.some((event) => event.tool === "catalog.get_product" || event.tool === "ops.health" || event.tool === "seo.audit")).toBe(
      true,
    );
    const sample = events.find((event) => event.tool === "seo.audit") ?? events[0];
    expect(sample.clientId).toBe("admin");
    expect(sample.subject).toBe("admin");
    expect(typeof sample.timestamp).toBe("number");
    expect(typeof sample.durationMs).toBe("number");
    expect(typeof sample.status).toBe("number");
    expect(sample.jobId === jobId || sample.tool === "ops.health" || sample.tool === "seo.audit").toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/Bearer |password|Authorization/i);
  });

  it("does not skip MCP: tools/list is served by the Streamable HTTP adapter", async () => {
    const { services, keys } = await buildTestApp();
    const { server, base } = await listenHorizon(services);
    servers.push(server);
    const token = await signToken(keys.privateKey, { client: "admin", scopes: CLIENT_SCOPES.admin });
    await mcpInitialize(base, token);
    const listed = await mcpRpc(base, token, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
      params: {},
    });
    expect(listed.status).toBe(200);
    const rpc = listed.json as { result?: { tools?: Array<{ name: string }> } };
    const names = (rpc.result?.tools ?? []).map((tool) => tool.name);
    expect(names).toContain("catalog.get_product");
    expect(names).toContain("repo.status");
    expect(names).not.toContain("shell.execute");
    expect(names).not.toContain("http.request");
  });
});

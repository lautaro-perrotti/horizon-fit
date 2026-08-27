import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { CLIENT_SCOPES, DENIED_TOOLS, loadConfig } from "../src/config.js";
import { assertAllowedBind, isAllowedBind } from "../src/net/bind.js";
import {
  buildTestApp,
  closeServer,
  listenHorizon,
  mcpCallTool,
  mcpInitialize,
  mcpRpc,
  request,
  signToken,
} from "./helpers.js";

const servers: Server[] = [];

afterEach(async () => {
  while (servers.length) {
    const server = servers.pop();
    if (server) await closeServer(server);
  }
});

describe("security: JWT / scopes / SSRF / deny list (test JWKS)", () => {
  it("missing token on /mcp is 401", async () => {
    const { services } = await buildTestApp();
    const { server, base } = await listenHorizon(services);
    servers.push(server);
    const response = await mcpRpc(base, undefined, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "ops.health", arguments: {} },
    });
    expect(response.status).toBe(401);
    expect(JSON.stringify(response.json)).toMatch(/invalid_token|missing_token/);
    expect(response.headers.get("www-authenticate") ?? "").toMatch(/resource_metadata=/);
  });

  it("invalid token on /mcp is 401", async () => {
    const { services } = await buildTestApp();
    const { server, base } = await listenHorizon(services);
    servers.push(server);
    const response = await mcpRpc(base, "not-a-jwt", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "x", version: "0" } },
    });
    expect(response.status).toBe(401);
  });

  it("expired token on /mcp is 401", async () => {
    const { services, keys } = await buildTestApp();
    const { server, base } = await listenHorizon(services);
    servers.push(server);
    const token = await signToken(keys.privateKey, {
      client: "admin",
      exp: Math.floor(Date.now() / 1000) - 120,
    });
    const response = await mcpRpc(base, token, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "ops.health", arguments: {} },
    });
    expect(response.status).toBe(401);
  });

  it("wrong issuer and audience on /mcp are 401", async () => {
    const { services, keys } = await buildTestApp();
    const { server, base } = await listenHorizon(services);
    servers.push(server);
    const wrongIss = await signToken(keys.privateKey, { client: "admin", iss: "https://evil.example/" });
    const wrongAud = await signToken(keys.privateKey, { client: "admin", aud: "https://someone-else.example/mcp" });
    expect((await mcpRpc(base, wrongIss, { jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(401);
    expect((await mcpRpc(base, wrongAud, { jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(401);
  });

  it("missing scope is 403 via MCP", async () => {
    const { services, keys } = await buildTestApp();
    const { server, base } = await listenHorizon(services);
    servers.push(server);
    const token = await signToken(keys.privateKey, { client: "claude", scopes: ["ops.read"] });
    await mcpInitialize(base, token);
    const call = await mcpCallTool(base, token, "catalog.get_product", { id: "001-TOP-AZU" });
    expect(call.isError).toBe(true);
    expect(call.tool?.status).toBe(403);
    expect(String(call.tool?.code ?? call.tool?.error ?? "")).toMatch(/insufficient_scope/);
  });

  it("Cursor token calling seo.audit is 403", async () => {
    const { app, services, keys } = await buildTestApp();
    const { server, base } = await listenHorizon(services);
    servers.push(server);
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    await mcpInitialize(base, token);
    const call = await mcpCallTool(base, token, "seo.audit", {});
    expect(call.isError).toBe(true);
    expect(call.tool?.status).toBe(403);
    expect((await request(app, "/v1/seo/audit", { method: "POST", token, body: {} })).status).toBe(403);
  });

  it("Claude token calling repo.status is 403", async () => {
    const { services, keys } = await buildTestApp();
    const { server, base } = await listenHorizon(services);
    servers.push(server);
    const token = await signToken(keys.privateKey, { client: "claude", scopes: CLIENT_SCOPES.claude });
    await mcpInitialize(base, token);
    const call = await mcpCallTool(base, token, "repo.status", {});
    expect(call.isError).toBe(true);
    expect(call.tool?.status).toBe(403);
  });

  it("SSRF args are rejected", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "claude", scopes: CLIENT_SCOPES.claude });
    const response = await request(app, "/v1/seo/audit", {
      method: "POST",
      token,
      body: { url: "https://evil.example/steal" },
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("unsafe_args");
    expect(String(body.error_description)).toMatch(/ssrf/i);
  });

  it("path traversal args are rejected", async () => {
    const { app, services, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "claude", scopes: CLIENT_SCOPES.claude });
    const response = await request(app, "/v1/catalog/products/..%2F..%2Fetc%2Fpasswd", { token });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("unsafe_args");
    expect(String(body.error_description)).toMatch(/path_traversal/i);

    const { server, base } = await listenHorizon(services);
    servers.push(server);
    await mcpInitialize(base, token);
    const call = await mcpCallTool(base, token, "catalog.get_product", { id: "../../etc/passwd" });
    expect(call.isError).toBe(true);
    expect(call.tool?.status).toBe(400);
  });

  it("production SQLite defaults outside the git repo", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      HORIZON_BIND: "127.0.0.1",
      HORIZON_OIDC_ISSUER: "https://horizon-fit.test.auth0.com/",
      HORIZON_OIDC_AUDIENCE: "https://horizon-control",
      HORIZON_SQLITE_PATH: "",
      HORIZON_DATA_DIR: "",
    });
    expect(config.sqlitePath).toBe("/var/lib/horizon-control/horizon-control.sqlite");
    expect(config.dataDir).toBe("/var/lib/horizon-control");
  });

  it("has no shell, ssh, or generic HTTP tool or route", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "admin", scopes: CLIENT_SCOPES.admin });
    for (const denied of ["shell.execute", "ssh", "http.request"] as const) {
      expect(DENIED_TOOLS).toContain(denied);
    }
    expect((await request(app, "/v1/shell", { token })).status).toBe(404);
    expect((await request(app, "/v1/ssh", { token })).status).toBe(404);
    expect((await request(app, "/v1/http", { method: "POST", token, body: { url: "https://example.com" } })).status).toBe(404);

    const { services } = await buildTestApp();
    const { server, base } = await listenHorizon(services);
    servers.push(server);
    await mcpInitialize(base, token);
    const shell = await mcpCallTool(base, token, "shell.execute", { command: "id" });
    expect(shell.isError).toBe(true);
    expect(shell.tool?.status === 403 || Boolean(shell.rpc.error)).toBe(true);
    const httpTool = await mcpCallTool(base, token, "http.request", { url: "https://example.com" });
    expect(httpTool.isError).toBe(true);
    expect(httpTool.tool?.status === 403 || Boolean(httpTool.rpc.error)).toBe(true);
  });

  it("refuses public bind addresses", () => {
    expect(isAllowedBind("127.0.0.1")).toBe(true);
    expect(isAllowedBind("100.64.1.5")).toBe(true);
    expect(isAllowedBind("0.0.0.0")).toBe(false);
    expect(isAllowedBind("::")).toBe(false);
    expect(isAllowedBind("1.2.3.4")).toBe(false);
    expect(() => assertAllowedBind("0.0.0.0")).toThrow(/HORIZON_BIND/);
    expect(() =>
      loadConfig({
        HORIZON_BIND: "0.0.0.0",
        HORIZON_OIDC_ISSUER: "https://horizon-fit.test.auth0.com/",
        HORIZON_OIDC_AUDIENCE: "https://horizon-control",
      }),
    ).toThrow(/HORIZON_BIND/);
  });

  it("liveness /healthz does not require a token", async () => {
    const { app } = await buildTestApp();
    const response = await request(app, "/healthz");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("horizon-control");
  });
});

import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES } from "../src/config.js";
import { buildTestApp, request, signToken } from "./helpers.js";

describe("scope matrix", () => {
  it("Claude token cannot call Cursor-only tools (tests.run, repo.status)", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "claude", scopes: CLIENT_SCOPES.claude });

    const testsRun = await request(app, "/v1/tests/run", { method: "POST", token });
    expect(testsRun.status).toBe(403);
    const testsBody = await testsRun.json();
    expect(testsBody.error).toBe("insufficient_scope");
    expect(testsBody.error_description).toMatch(/tests\.run/);

    const repo = await request(app, "/v1/repo/status", { token });
    expect(repo.status).toBe(403);
    const repoBody = await repo.json();
    expect(repoBody.error).toBe("insufficient_scope");
    expect(repoBody.error_description).toMatch(/repo\.status/);
  });

  it("Claude can call catalog, seo, merchant, health, jobs, audit", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "claude", scopes: CLIENT_SCOPES.claude });

    expect((await request(app, "/v1/health", { token })).status).toBe(200);
    expect((await request(app, "/v1/catalog/products?q=calza", { token })).status).toBe(200);
    expect((await request(app, "/v1/storefront/config", { token })).status).toBe(200);
    expect((await request(app, "/v1/seo/audit", { method: "POST", token, body: {} })).status).toBe(200);
    expect((await request(app, "/v1/merchant/diagnostics", { token })).status).toBe(200);
    expect((await request(app, "/v1/audit/history", { token })).status).toBe(200);
  });

  it("Cursor token cannot call seo.* or merchant.*", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });

    expect((await request(app, "/v1/seo/audit", { method: "POST", token, body: {} })).status).toBe(403);
    expect((await request(app, "/v1/seo/audits/latest", { token })).status).toBe(403);
    expect((await request(app, "/v1/analytics/ga4", { token })).status).toBe(403);
    expect((await request(app, "/v1/merchant/audit", { method: "POST", token })).status).toBe(403);
    expect((await request(app, "/v1/merchant/diagnostics", { token })).status).toBe(403);
    expect((await request(app, "/v1/insights/products/001-TOP-AZU", { token })).status).toBe(403);
  });

  it("Cursor can call health, catalog, storefront, repo.status, tests.run", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });

    expect((await request(app, "/v1/health", { token })).status).toBe(200);
    expect((await request(app, "/v1/catalog/products?q=top", { token })).status).toBe(200);
    expect((await request(app, "/v1/storefront/config", { token })).status).toBe(200);
    expect((await request(app, "/v1/repo/status", { token })).status).toBe(200);
    expect((await request(app, "/v1/tests/run", { method: "POST", token })).status).toBe(200);
  });

  it("Codex matches Cursor (tests.run allowed, seo.audit denied)", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "codex", scopes: CLIENT_SCOPES.codex });
    expect((await request(app, "/v1/tests/run", { method: "POST", token })).status).toBe(200);
    expect((await request(app, "/v1/seo/audit", { method: "POST", token, body: {} })).status).toBe(403);
  });

  it("missing scope on an otherwise valid token is 403 forbidden", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "claude", scopes: ["ops.read"] });
    const response = await request(app, "/v1/catalog/products?q=x", { token });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("insufficient_scope");
    expect(response.headers.get("www-authenticate") ?? "").toMatch(/insufficient_scope/);
  });

  it("admin can call all registered tools", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "admin", scopes: CLIENT_SCOPES.admin });
    const listed = await request(app, "/v1/tools", { token });
    const body = await listed.json();
    expect(body.tools).toHaveLength(22);
  });

  it("dashboard client can call health, catalog, commerce, alerts, seo; not merchant or repo", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    expect((await request(app, "/v1/health", { token })).status).toBe(200);
    expect((await request(app, "/v1/catalog/products?q=top", { token })).status).toBe(200);
    expect((await request(app, "/v1/commerce/sales", { token })).status).toBe(200);
    expect((await request(app, "/v1/insights/products/001-TOP-AZU", { token })).status).toBe(200);
    expect((await request(app, "/v1/commerce/settings", { token })).status).toBe(200);
    expect((await request(app, "/v1/alerts", { token })).status).toBe(200);
    expect((await request(app, "/v1/seo/audits/latest", { token })).status).toBe(200);
    expect((await request(app, "/v1/seo/audit", { method: "POST", token, body: {} })).status).toBe(200);
    expect((await request(app, "/v1/analytics/ga4", { token })).status).toBe(200);
    expect((await request(app, "/v1/analytics/search-console", { token })).status).toBe(200);
    expect((await request(app, "/v1/analytics/competitors", { token })).status).toBe(200);
    expect((await request(app, "/v1/merchant/diagnostics", { token })).status).toBe(403);
    expect((await request(app, "/v1/repo/status", { token })).status).toBe(403);
  });
});

import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES } from "../src/config.js";
import { buildTestApp, request, signToken } from "./helpers.js";

describe("resource server JWT validation", () => {
  it("rejects missing bearer token with 401 and WWW-Authenticate resource_metadata", async () => {
    const { app } = await buildTestApp();
    const response = await request(app, "/v1/health");
    expect(response.status).toBe(401);
    const www = response.headers.get("www-authenticate") ?? "";
    expect(www).toMatch(/Bearer/);
    expect(www).toMatch(/resource_metadata=/);
    expect(www).toMatch(/invalid_token/);
  });

  it("rejects a token signed with the wrong key", async () => {
    const { app } = await buildTestApp();
    const other = await (await import("./helpers.js")).createTestKeys();
    const token = await signToken(other.privateKey, { client: "admin" });
    const response = await request(app, "/v1/health", { token });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("invalid_token");
  });

  it("rejects an expired token", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, {
      client: "admin",
      exp: Math.floor(Date.now() / 1000) - 120,
    });
    const response = await request(app, "/v1/health", { token });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("invalid_token");
    expect(String(body.error_description)).toMatch(/expired|invalid_token/i);
  });

  it("rejects a token with the wrong audience", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, {
      client: "admin",
      aud: "https://someone-else.example/mcp",
    });
    const response = await request(app, "/v1/health", { token });
    expect(response.status).toBe(401);
  });

  it("rejects a token with the wrong issuer", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, {
      client: "admin",
      iss: "https://evil.example/",
    });
    const response = await request(app, "/v1/health", { token });
    expect(response.status).toBe(401);
  });

  it("accepts a valid admin token for health", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "admin", scopes: CLIENT_SCOPES.admin });
    const response = await request(app, "/v1/health", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.containers).toHaveLength(4);
    expect(body.github.enabled).toBe(false);
  });

  it("publishes RFC 9728 protected resource metadata", async () => {
    const { app } = await buildTestApp();
    const response = await request(app, "/.well-known/oauth-protected-resource");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.resource).toBe("http://127.0.0.1:8787/mcp");
    expect(body.authorization_servers[0]).toMatch(/auth0\.com/);
    expect(body.scopes_supported).toContain("catalog.read");
  });
});

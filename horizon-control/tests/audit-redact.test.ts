import { describe, expect, it } from "vitest";
import { redactArgs } from "../src/auth/redact.js";
import { CLIENT_SCOPES } from "../src/config.js";
import { buildTestApp, request, signToken } from "./helpers.js";

describe("audit redaction", () => {
  it("redacts password, token, authorization, and secret keys", () => {
    const redacted = redactArgs({
      query: "calza",
      password: "hunter2",
      token: "abc",
      authorization: "Bearer xyz",
      secret: "shh",
      app_password: "woo-secret",
      nested: { api_key: "k", q: "ok" },
    });
    expect(redacted.query).toBe("calza");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.token).toBe("[REDACTED]");
    expect(redacted.authorization).toBe("[REDACTED]");
    expect(redacted.secret).toBe("[REDACTED]");
    expect(redacted.app_password).toBe("[REDACTED]");
    expect((redacted.nested as { api_key: string; q: string }).api_key).toBe("[REDACTED]");
    expect((redacted.nested as { q: string }).q).toBe("ok");
  });

  it("persists redacted args and never stores live secrets", async () => {
    const { app, keys, services } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "claude", scopes: CLIENT_SCOPES.claude });
    const response = await request(app, "/v1/catalog/products?q=calza", {
      token,
    });
    expect(response.status).toBe(200);

    const principal = await services.auth.verifyAccessToken(token);
    await services.audit.record({
      principal,
      tool: "catalog.search_products",
      args: { query: "calza", password: "should-not-leak", authorization: "Bearer secret-token" },
      outcome: "ok",
      statusCode: 200,
    });
    await services.audit.record({
      principal,
      tool: "ops.health",
      args: { password: "should-not-leak", authorization: "Bearer secret-token", HORIZON_OIDC_ISSUER: "hidden" },
      outcome: "ok",
      statusCode: 200,
    });

    const history = await request(app, "/v1/audit/history", { token });
    expect(history.status).toBe(200);
    const body = (await history.json()) as {
      events: Array<{
        tool: string;
        clientId: string;
        subject: string;
        scope: string;
        timestamp: number;
        durationMs: number;
        status: number;
        argsRedacted: Record<string, unknown>;
      }>;
    };
    const blob = JSON.stringify(body);
    expect(blob).not.toMatch(/should-not-leak/);
    expect(blob).not.toMatch(/secret-token/);
    expect(blob).not.toMatch(/WOO_APP_PASSWORD/);
    expect(blob).toMatch(/\[REDACTED\]/);
    const catalogEvent = body.events.find((event) => event.tool === "catalog.search_products");
    expect(catalogEvent?.clientId).toBe("claude");
    expect(catalogEvent?.subject).toBe("claude");
    expect(catalogEvent?.scope).toBe("catalog.read");
    expect(typeof catalogEvent?.timestamp).toBe("number");
    expect(typeof catalogEvent?.durationMs).toBe("number");
    expect(catalogEvent?.status).toBe(200);
    expect(catalogEvent?.argsRedacted).toEqual({ query: "calza" });
  });
});

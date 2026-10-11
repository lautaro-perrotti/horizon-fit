import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES, loadConfig } from "../src/config.js";
import { createModelGateway } from "../src/ai/gateway.js";
import { AUDIENCE, ISSUER, buildTestApp, request, signToken } from "./helpers.js";

describe("ModelGateway", () => {
  it("lists models as not configured and never invents a reply without keys", async () => {
    const { app, keys, services } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const listed = await request(app, "/v1/ai/models", { token });
    expect(listed.status).toBe(200);
    const body = await listed.json();
    expect(body.configured).toBe(false);
    expect(body.reason).toBe("missing_ai_provider_keys");
    expect(body.models.every((row: { configured: boolean }) => row.configured === false)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/sk-|AIza|claude-key/);

    const chat = await services.gateway.chat({ messages: [{ role: "user", content: "hola" }] });
    expect(chat.configured).toBe(false);
    expect(chat.text).toBe("");
    expect(chat.model).toBeNull();
  });

  it("routes auto, records usage, failovers and respects daily budget", async () => {
    const { services } = await buildTestApp({
      config: loadConfig({
        HORIZON_OIDC_ISSUER: ISSUER,
        HORIZON_OIDC_AUDIENCE: AUDIENCE,
        HORIZON_BIND: "127.0.0.1",
        HORIZON_PORT: "8787",
        HORIZON_PUBLIC_URL: "http://127.0.0.1:8787",
        HORIZON_SQLITE_PATH: ":memory:",
        HORIZON_OPENAI_API_KEY: "test-openai",
        HORIZON_ANTHROPIC_API_KEY: "test-anthropic",
        HORIZON_AI_BUDGET_USD_DAILY: "0.0001",
      }),
      gateway: undefined,
    });
    const gateway = createModelGateway({
      db: services.db,
      openaiKey: "test-openai",
      anthropicKey: "test-anthropic",
      dailyBudgetUsd: 0.0001,
      complete: {
        openai: async () => {
          throw new Error("openai_down");
        },
        anthropic: async () => ({ text: "ok from anthropic", input_tokens: 10, output_tokens: 5 }),
      },
    });
    const first = await gateway.chat({ messages: [{ role: "user", content: "prioridad" }], task: "chat", user: "ada" });
    expect(first.configured).toBe(true);
    expect(first.text).toBe("ok from anthropic");
    expect(first.provider).toBe("anthropic");
    expect(first.routed.failover).toContain("openai:gpt-4o-mini");
    expect(first.usage.cost_usd).not.toBeNull();

    const usage = gateway.usage();
    expect(usage.calls).toBe(1);
    expect(usage.by_provider[0].provider).toBe("anthropic");

    const blocked = await gateway.chat({ messages: [{ role: "user", content: "otra" }], user: "ada" });
    expect(blocked.reason).toBe("budget_exceeded_daily_usd");
    expect(blocked.text).toBe("");
  });

  it("Cursor cannot read models or usage", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    expect((await request(app, "/v1/ai/models", { token })).status).toBe(403);
    expect((await request(app, "/v1/ai/usage", { token })).status).toBe(403);
  });
});

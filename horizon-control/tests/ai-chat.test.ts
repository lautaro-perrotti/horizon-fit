import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES, loadConfig } from "../src/config.js";
import { createModelGateway } from "../src/ai/gateway.js";
import { CHAT_EVALS, scoreChatEval } from "../src/ai/eval.js";
import { AUDIENCE, ISSUER, buildTestApp, request, signToken } from "./helpers.js";

describe("native chat", () => {
  it("does not invent an answer when no provider is configured", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/ai/chat", { method: "POST", token, body: { message: "¿cómo vamos?" } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toBe(false);
    expect(body.text).toBe("");
    expect(body.reason).toBe("missing_ai_provider_keys");
    expect(JSON.stringify(body)).not.toMatch(/\$214\.000/);
  });

  it("runs a tool through the shared registry and persists evidence", async () => {
    let calls = 0;
    const { app, keys, services } = await buildTestApp({
      config: loadConfig({
        HORIZON_OIDC_ISSUER: ISSUER,
        HORIZON_OIDC_AUDIENCE: AUDIENCE,
        HORIZON_BIND: "127.0.0.1",
        HORIZON_PORT: "8787",
        HORIZON_PUBLIC_URL: "http://127.0.0.1:8787",
        HORIZON_SQLITE_PATH: ":memory:",
        HORIZON_OPENAI_API_KEY: "test-openai",
      }),
    });
    services.gateway = createModelGateway({
      db: services.db,
      openaiKey: "test-openai",
      complete: {
        openai: async () => {
          calls += 1;
          if (calls === 1) {
            return { text: JSON.stringify({ message: "", tools: [{ name: "commerce.sales", args: {} }] }), input_tokens: 20, output_tokens: 8 };
          }
          return {
            text: JSON.stringify({
              message: "Revenue not_configured. Falta HORIZON_WOO_KEY. Source woo_rest_orders.",
              tools: [],
            }),
            input_tokens: 30,
            output_tokens: 12,
          };
        },
      },
    });
    services.chat = (await import("../src/ai/chat.js")).createChatAdapter({
      db: services.db,
      gateway: services.gateway,
      runtime: services.runtime,
    });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/ai/chat", { method: "POST", token, body: { message: "¿cómo viene revenue?" } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toBe(true);
    expect(body.text).toMatch(/not_configured/);
    expect(body.tools[0].name).toBe("commerce.sales");
    expect(body.trace_id).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/\$214\.000/);
    const stored = await request(app, `/v1/ai/sessions/${body.session_id}`, { token });
    expect(stored.status).toBe(200);
    const session = await stored.json();
    expect(session.messages.some((row: { role: string }) => row.role === "assistant")).toBe(true);
  });

  it("eval suite scores tool selection and rejects invented revenue", () => {
    expect(CHAT_EVALS).toHaveLength(5);
    const good = scoreChatEval({
      id: "prioritize",
      tools: ["growth.list_opportunities"],
      text: "Hay que revisar oportunidades abiertas. Source growth_engine.",
      latency_ms: 1200,
      cost_usd: 0.01,
    });
    expect(good.tool_hit).toBe(true);
    expect(good.unsupported).toBe(false);
    expect(good.score).toBeGreaterThanOrEqual(90);
    const bad = scoreChatEval({
      id: "decline",
      tools: [],
      text: "Revenue cayó a $214.000",
      latency_ms: 9000,
      cost_usd: null,
    });
    expect(bad.tool_hit).toBe(false);
    expect(bad.unsupported).toBe(true);
    expect(bad.score).toBe(0);
  });
});

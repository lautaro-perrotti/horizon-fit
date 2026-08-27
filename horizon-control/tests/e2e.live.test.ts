import { describe, expect, it } from "vitest";

const enabled = process.env.HORIZON_E2E === "1";
const base = (process.env.HORIZON_CONTROL_URL ?? "").replace(/\/$/, "");
const token = process.env.HORIZON_E2E_TOKEN ?? process.env.HORIZON_CONTROL_TOKEN ?? "";

/**
 * Live smoke: client → OAuth JWT → MCP Streamable HTTP → CP adapters.
 * Gated so default `npm test` never talks to Auth0/Tailscale/Woo.
 *
 *   HORIZON_E2E=1 HORIZON_CONTROL_URL=http://<tailscale-ip>:8787 HORIZON_E2E_TOKEN=<jwt> npm run test:e2e
 */
describe.skipIf(!enabled)("live MCP e2e (HORIZON_E2E=1)", () => {
  it("requires a control plane URL and bearer token", () => {
    expect(base).toMatch(/^https?:\/\//);
    expect(token.length).toBeGreaterThan(20);
  });

  async function mcp(name: string, args: Record<string, unknown> = {}) {
    const response = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    const text = await response.text();
    let rpc: { result?: { content?: Array<{ text?: string }>; isError?: boolean } } = {};
    try {
      rpc = JSON.parse(text);
    } catch {
      const data = text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter(Boolean)
        .at(-1);
      if (data) rpc = JSON.parse(data);
    }
    const payload = rpc.result?.content?.[0]?.text ? JSON.parse(rpc.result.content[0].text) : null;
    return { status: response.status, isError: Boolean(rpc.result?.isError), payload, raw: text };
  }

  it("catalog_get_product 001-TOP-AZU", async () => {
    const result = await mcp("catalog_get_product", { id: "001-TOP-AZU" });
    expect(result.status).toBe(200);
    expect(result.isError).toBe(false);
    expect(result.payload?.sku ?? result.payload?.parent_sku).toBe("001-TOP-AZU");
  });

  it("ops_health", async () => {
    const result = await mcp("ops_health");
    expect(result.status).toBe(200);
    expect(["healthy", "degraded", "unavailable"]).toContain(result.payload?.status);
  });

  it("repo_status", async () => {
    const result = await mcp("repo_status");
    expect(result.status).toBe(200);
    expect(result.payload).toHaveProperty("head");
  });

  it("merchant_get_diagnostics", async () => {
    const result = await mcp("merchant_get_diagnostics");
    expect(result.status).toBe(200);
    expect(["local", "endpoint", "unavailable"]).toContain(result.payload?.source);
  });

  it("seo_audit then jobs_get and audit_history", async () => {
    const audit = await mcp("seo_audit");
    expect(audit.status).toBe(200);
    const jobId = String(audit.payload?.id ?? "");
    if (jobId) {
      const job = await mcp("jobs_get", { id: jobId });
      expect(job.status).toBe(200);
      expect(job.payload?.id).toBe(jobId);
    }
    const history = await mcp("audit_history", { limit: 10 });
    expect(history.status).toBe(200);
    expect(JSON.stringify(history.payload)).not.toMatch(/Bearer [A-Za-z0-9._\-]+/);
  });
});

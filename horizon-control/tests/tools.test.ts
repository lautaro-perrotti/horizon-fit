import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES } from "../src/config.js";
import { dispatchCommand } from "../src/core/commands/index.js";
import { buildTestApp, request, signToken } from "./helpers.js";

describe("MVP tools", () => {
  it("catalog.search_products uses the mocked Woo adapter and never needs production", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "claude", scopes: CLIENT_SCOPES.claude });
    const response = await request(app, "/v1/catalog/products?q=calza", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.products[0].sku).toBe("HF-C1");
  });

  it("catalog.get_product returns Horizon SKU 001-TOP-AZU", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "claude", scopes: CLIENT_SCOPES.claude });
    const response = await request(app, "/v1/catalog/products/001-TOP-AZU", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sku).toBe("001-TOP-AZU");
    expect(body.parent_sku).toBe("001-TOP-AZU");
    expect(body.variations[0].sku).toBe("001-TOP-AZU-S");
  });

  it("seo.audit enqueues a mocked job and does not crawl production", async () => {
    const { app, keys, services } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "claude", scopes: CLIENT_SCOPES.claude });
    const response = await request(app, "/v1/seo/audit", { method: "POST", token, body: { url: "https://horizonfit.com.ar" } });
    expect(response.status).toBe(200);
    const job = await response.json();
    expect(job.type).toBe("seo.audit");
    expect(job.status).toBe("queued");
    await services.worker.tick();
    const stored = await services.jobs.get(job.id);
    expect(stored?.status).toBe("succeeded");
    expect((stored?.result as { mocked?: boolean })?.mocked).toBe(true);
  });

  it("seo.audit ignores agent URLs and always stores the allowlisted origin", async () => {
    const { services, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "admin", scopes: CLIENT_SCOPES.admin });
    const principal = await services.auth.verifyAccessToken(token);
    const enqueued = await dispatchCommand(services, "seo.audit", { url: "https://evil.example" }, principal);
    expect(enqueued.ok).toBe(true);
    if (enqueued.ok) {
      const job = enqueued.data as { id: string; args: { target: string } };
      expect(job.args.target).toBe("https://horizonfit.com.ar");
    }
  });

  it("merchant.audit reads existing diagnostics and does not regenerate", async () => {
    const { app, keys, services } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "claude", scopes: CLIENT_SCOPES.claude });
    const response = await request(app, "/v1/merchant/audit", { method: "POST", token });
    expect(response.status).toBe(200);
    const job = await response.json();
    expect(job.args.regenerated).toBe(false);
    const diagnostics = await request(app, "/v1/merchant/diagnostics", { token });
    const body = await diagnostics.json();
    expect(body.diagnosticsTxt).toMatch(/Merchant diagnostics/);
    expect(services.github.enabled).toBe(false);
  });

  it("tests.run is mocked and does not invoke PHP in unit tests", async () => {
    const { app, keys, jobsRun, services } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    const response = await request(app, "/v1/tests/run", { method: "POST", token });
    expect(response.status).toBe(200);
    await services.worker.tick();
    expect(jobsRun.some((job) => job.type === "tests.run")).toBe(true);
  });

  it("ops.health degrades when HTTP probes fail", async () => {
    const { app, keys } = await buildTestApp({
      fetchImpl: async () => new Response("down", { status: 503 }),
    });
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    const response = await request(app, "/v1/health", { token });
    const body = await response.json();
    expect(body.status).toBe("unavailable");
    expect(body.storefront.ok).toBe(false);
    expect(body.api.ok).toBe(false);
  });
});

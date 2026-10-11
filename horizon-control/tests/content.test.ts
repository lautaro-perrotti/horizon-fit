import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES } from "../src/config.js";
import { composeFromEvidence } from "../src/adapters/content.js";
import { notConfiguredSlice, okSlice } from "../src/core/slice.js";
import type { ProductInsight } from "../src/adapters/insights.js";
import { buildTestApp, request, signToken } from "./helpers.js";

function insight(): ProductInsight {
  return {
    found: true,
    store_id: "horizon-fit",
    keys: {
      input: "001-TOP-AZU",
      kind: "parent_sku",
      parent_sku: "001-TOP-AZU",
      variant_sku: null,
      product_id: 99,
      variation_id: null,
      slug: "top-liso-azul",
      canonical_url: "https://horizonfit.com.ar/product/top-liso-azul/",
    },
    catalog: okSlice("woo_store_api", {
      name: "Top Dynamic blue",
      price: { amount: "67000.00", currency: "ARS" },
      stock_status: "instock",
      variants: [],
      categories: ["tops"],
      images: [],
    }),
    sales: notConfiguredSlice("woo_rest_orders", "missing_woo_rest_credentials"),
    analytics: notConfiguredSlice("ga4", "missing_google_credentials"),
    search: okSlice("gsc", {
      page: "https://horizonfit.com.ar/product/top-liso-azul/",
      clicks: 4,
      impressions: 80,
      ctr: 0.05,
      position: 12,
      queries: [{ query: "top training azul", clicks: 3, impressions: 40, ctr: 0.07, position: 9 }],
    }),
    seo: notConfiguredSlice("seo_audit", "missing_seo_report"),
    merchant: notConfiguredSlice("merchant_feed", "diagnostics_unavailable"),
    competition: notConfiguredSlice("competitors", "missing_competitor_urls"),
    insights: [],
  };
}

describe("content drafts", () => {
  it("composes only from observed slices and never invents revenue", () => {
    const draft = composeFromEvidence("seo_title", insight(), []);
    expect(draft.body).toMatch(/top training azul|Top Dynamic blue/);
    expect(draft.notes).toMatch(/search:ok/);
    expect(draft.notes).toMatch(/no_publish_to_horizon_fit/);
    expect(JSON.stringify(draft)).not.toMatch(/\$214\.000/);
  });

  it("persists a draft, approves, and refuses to publish to the storefront", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const created = await request(app, "/v1/content/generate", {
      method: "POST",
      token,
      body: { kind: "seo_title", parent_sku: "001-TOP-AZU" },
    });
    expect(created.status).toBe(200);
    const draft = await created.json();
    expect(draft.status).toBe("draft");
    expect(draft.prompt_version).toBe("content.v1");
    expect(draft.parent_sku).toBe("001-TOP-AZU");
    expect(draft.body).not.toMatch(/\$214\.000/);

    const tooSoon = await request(app, `/v1/content/drafts/${draft.id}`, {
      method: "POST",
      token,
      body: { action: "published-externally" },
    });
    expect(tooSoon.status).toBe(400);

    const approved = await request(app, `/v1/content/drafts/${draft.id}`, {
      method: "POST",
      token,
      body: { action: "approve" },
    });
    expect(approved.status).toBe(200);
    expect((await approved.json()).status).toBe("approved");

    const external = await request(app, `/v1/content/drafts/${draft.id}`, {
      method: "POST",
      token,
      body: { action: "published-externally" },
    });
    expect(external.status).toBe(200);
    const published = await external.json();
    expect(published.status).toBe("published-externally");
    expect(published.notes).toMatch(/no_publish_to_horizon_fit/);
  });

  it("Cursor cannot generate or list drafts", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    expect((await request(app, "/v1/content/drafts", { token })).status).toBe(403);
    expect((await request(app, "/v1/content/generate", { method: "POST", token, body: { kind: "ad_copy" } })).status).toBe(403);
  });
});

import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES } from "../src/config.js";
import { notConfiguredSlice, okSlice } from "../src/core/slice.js";
import type { ProductInsight } from "../src/adapters/insights.js";
import { emptyCohort, evaluateRules, scoreOpportunity } from "../src/adapters/growth-engine.js";
import { buildTestApp, request, signToken } from "./helpers.js";

function insight(overrides: Partial<ProductInsight> = {}): ProductInsight {
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
    search: notConfiguredSlice("gsc", "missing_google_credentials"),
    seo: notConfiguredSlice("seo_audit", "missing_seo_report"),
    merchant: notConfiguredSlice("merchant_feed", "diagnostics_unavailable"),
    competition: notConfiguredSlice("competitors", "missing_competitor_urls"),
    insights: [],
    ...overrides,
  };
}

describe("growth engine", () => {
  it("skips HIGH_TRAFFIC_LOW_CONVERSION when GA4 is not available", () => {
    const drafts = evaluateRules(
      insight(),
      { ...emptyCohort(), viewsP75: 200, cvrMedian: 0.04 },
    );
    expect(drafts.map((row) => row.type)).not.toContain("HIGH_TRAFFIC_LOW_CONVERSION");
  });

  it("emits HIGH_TRAFFIC_LOW_CONVERSION only with a real GA4 slice pair", () => {
    const drafts = evaluateRules(
      insight({
        analytics: okSlice("ga4", {
          period: "28d",
          join: { item_id: "001-TOP-AZU", page_path: "/product/top-liso-azul/" },
          pdp_views: 400,
          view_item: 400,
          add_to_cart: 8,
          begin_checkout: 4,
          purchase: 4,
          purchase_revenue: 80000,
          atc_rate: 0.02,
          checkout_rate: 0.01,
          cvr: 0.01,
        }),
      }),
      { ...emptyCohort(), viewsP75: 200, cvrMedian: 0.04 },
    );
    expect(drafts.map((row) => row.type)).toContain("HIGH_TRAFFIC_LOW_CONVERSION");
  });

  it("renormalizes score weights instead of filling missing components", () => {
    const scored = scoreOpportunity(
      insight({
        sales: okSlice("woo_rest_orders", {
          currency: "ARS",
          d7: null,
          d30: { units: 4, revenue: 50000, orders: 3, aov: 16666, avg_unit_price: 12500, units_per_order: 1.3 },
          d90: null,
          last_sale_at: null,
          velocity_30d: 0.1,
          orders: 3,
          units: 4,
          revenue: 50000,
          aov: 16666,
        }),
      }),
      { ...emptyCohort(), revenueMax: 100000 },
    );
    expect(Object.keys(scored.components)).toEqual(["revenue_importance"]);
    expect(scored.weights_used.revenue_importance).toBe(1);
    expect(scored.score_caption).toMatch(/renormalized/);
    expect(scored.score_caption).not.toMatch(/GA4 not configured/);
  });

  it("PRICE_OUTLIER is fact-only and never recommends lowering price", () => {
    const drafts = evaluateRules(
      insight({
        competition: okSlice("competitors", {
          segment: "tops",
          peers: [
            { competitor: "a", url: "https://a.example/tops", status: 200, title: "A", ok: true },
            { competitor: "b", url: "https://b.example/tops", status: 200, title: "B", ok: true },
          ],
          price_index: { horizon: 90000, median: 45000, index: 2, n: 2 },
        }),
      }),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe("PRICE_OUTLIER");
    expect(drafts[0].recommended_action).toMatch(/no se recomienda bajar el precio/i);
  });

  it("persists evaluate, lists open rows, and keeps dismissed closed", async () => {
    const blocked = insight({
      sales: okSlice("woo_rest_orders", {
        currency: "ARS",
        d7: null,
        d30: { units: 10, revenue: 80000, orders: 8, aov: 10000, avg_unit_price: 8000, units_per_order: 1.25 },
        d90: null,
        last_sale_at: null,
        velocity_30d: 0.3,
        orders: 8,
        units: 10,
        revenue: 80000,
        aov: 10000,
      }),
      merchant: okSlice("merchant_feed", {
        included: true,
        ready: 0,
        blocked: 3,
        variants: [],
        generated_path: "/tmp",
      }),
    });
    const { app, keys, services } = await buildTestApp({
      insights: {
        async getProduct(id) {
          return String(id).includes("001-TOP-AZU") ? blocked : null;
        },
        async overview() {
          return {
            store_id: "horizon-fit",
            fetched_at: new Date().toISOString(),
            revenue: notConfiguredSlice("woo_rest_orders", "missing_woo_rest_credentials"),
            demand: notConfiguredSlice("ga4+gsc", "missing_google_credentials"),
            conversion: notConfiguredSlice("ga4", "conversion_needs_ga4_sessions_and_purchases"),
            opportunities: okSlice("growth_engine", { items: [] }),
            problems: okSlice("warehouse", { items: [] }),
          };
        },
      },
    });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const empty = await request(app, "/v1/growth/opportunities", { token });
    expect(empty.status).toBe(200);
    expect((await empty.json()).opportunities).toEqual([]);

    const result = await services.growth.evaluate();
    expect(result.open).toBeGreaterThan(0);
    const listed = await request(app, "/v1/growth/opportunities", { token });
    const body = await listed.json();
    const merchant = body.opportunities.find((row: { type: string }) => row.type === "MERCHANT_BLOCKED_HIGH_VALUE");
    expect(merchant).toBeTruthy();
    expect(merchant.score_caption).toMatch(/renormalized|uses/);

    const dismissed = await request(app, `/v1/growth/opportunities/${merchant.id}`, {
      method: "POST",
      token,
      body: { action: "dismiss" },
    });
    expect(dismissed.status).toBe(200);
    expect((await dismissed.json()).status).toBe("dismissed");

    await services.growth.evaluate();
    const stillOpen = await request(app, "/v1/growth/opportunities?status=open", { token });
    expect((await stillOpen.json()).opportunities.some((row: { id: string }) => row.id === merchant.id)).toBe(false);
    const archived = await request(app, "/v1/growth/opportunities?status=dismissed", { token });
    expect((await archived.json()).opportunities[0].id).toBe(merchant.id);
  });

  it("Cursor cannot read or mutate opportunities", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    expect((await request(app, "/v1/growth/opportunities", { token })).status).toBe(403);
    expect((await request(app, "/v1/growth/opportunities/x", { method: "POST", token, body: { action: "dismiss" } })).status).toBe(403);
  });
});

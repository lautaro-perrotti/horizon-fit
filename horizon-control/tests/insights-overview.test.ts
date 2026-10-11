import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES } from "../src/config.js";
import { overviewFromSources, seoSlice, merchantSlice } from "../src/adapters/insights.js";
import type { CommerceSales } from "../src/adapters/commerce.js";
import type { Ga4Report, GscReport } from "../src/adapters/analytics.js";
import { SAMPLE_SEO_SUMMARY, buildTestApp, mockAnalytics, mockSeo, request, signToken } from "./helpers.js";

const emptySales = (configured: boolean, revenue = 0): CommerceSales => ({
  configured,
  reason: configured ? undefined : "missing_woo_rest_credentials",
  store_id: "horizon-fit",
  currency: "ARS",
  fetched_at: configured ? "2026-10-11T00:00:00.000Z" : null,
  incomplete: false,
  source: "orders",
  today: { orders: 0, units: 0, revenue: null, aov: null, currency: "ARS" },
  week: { orders: 0, units: 0, revenue: null, aov: null, currency: "ARS" },
  month: { orders: configured ? 3 : 0, units: configured ? 3 : 0, revenue: configured ? revenue : null, aov: configured ? revenue / 3 : null, currency: "ARS" },
  ninety: { orders: 0, units: 0, revenue: null, aov: null, currency: "ARS" },
  recent_orders: [],
  products: [],
});

const emptyGa4 = (overrides: Partial<Ga4Report> = {}): Ga4Report => ({
  configured: false,
  ok: false,
  reason: "missing_google_credentials",
  store_id: "horizon-fit",
  property_id: "",
  sessions: null,
  users: null,
  purchases: null,
  channels: [],
  ...overrides,
});

const emptyGsc = (overrides: Partial<GscReport> = {}): GscReport => ({
  configured: false,
  ok: false,
  reason: "missing_google_credentials",
  store_id: "horizon-fit",
  site_url: "https://horizonfit.com.ar/",
  start_date: "2026-07-30",
  end_date: "2026-08-27",
  clicks: null,
  impressions: null,
  ctr: null,
  position: null,
  queries: [],
  ...overrides,
});

describe("insights.overview and product slices", () => {
  it("keeps conversion unknown unless GA4 has sessions and purchases", () => {
    const overview = overviewFromSources({
      sales: emptySales(false),
      ga4: emptyGa4(),
      gsc: emptyGsc(),
      seoConfigured: false,
      seoCritical: 0,
      merchantBlocked: null,
      merchantAvailable: false,
      storefrontOk: true,
    });
    expect(overview.revenue.status).toBe("not_configured");
    expect(overview.demand.status).toBe("not_configured");
    expect(overview.conversion.status).toBe("unknown");
    expect(overview.conversion.reason).toBe("conversion_needs_ga4_sessions_and_purchases");
    expect(overview.opportunities.status).toBe("zero");
    expect(overview.opportunities.reason).toBe("no_open_opportunities");
    expect(overview.problems.status).toBe("zero");
  });

  it("surfaces SEO criticals and merchant blocked as problems without inventing conversion", () => {
    const overview = overviewFromSources({
      sales: emptySales(true, 201000),
      ga4: emptyGa4({ configured: true, ok: true, sessions: 1000, users: 800, purchases: 21, reason: undefined }),
      gsc: emptyGsc({ configured: true, ok: true, clicks: 40, impressions: 900, reason: undefined }),
      seoConfigured: true,
      seoCritical: 1,
      merchantBlocked: 4,
      merchantAvailable: true,
      storefrontOk: true,
    });
    expect(overview.revenue.status).toBe("ok");
    expect(overview.revenue.data?.revenue).toBe(201000);
    expect(overview.demand.status).toBe("ok");
    expect(overview.conversion.status).toBe("ok");
    expect(overview.conversion.data?.cvr).toBeCloseTo(0.021);
    expect(overview.problems.status).toBe("ok");
    expect(overview.problems.data?.items.map((row) => row.type)).toEqual(["seo_critical", "merchant_blocked"]);
    expect(overview.opportunities.status).toBe("zero");
  });

  it("seoSlice and merchantSlice stay honest when the page or SKU is missing", () => {
    expect(seoSlice(null, false, "missing_seo_report").status).toBe("not_configured");
    expect(seoSlice(null, true).status).toBe("unknown");
    expect(seoSlice(null, true).reason).toBe("seo_page_not_in_audit");
    expect(
      merchantSlice(
        {
          path: "/tmp",
          diagnosticsTxt: "",
          productsJson: { items: [] },
          source: "local",
          summary: { ready: 0, blocked: 0, problems: [] },
        },
        "001-TOP-AZU",
        ["001-TOP-AZU-S"],
      ).status,
    ).toBe("unknown");
  });

  it("GET /v1/insights/overview returns five slices without inventing metrics", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/insights/overview", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.store_id).toBe("horizon-fit");
    expect(body.revenue.status).toBe("not_configured");
    expect(body.demand.status).toBe("not_configured");
    expect(body.conversion.status).toBe("unknown");
    expect(body.opportunities.status).toBe("zero");
    expect(body.opportunities.reason).toBe("no_open_opportunities");
    expect(body.opportunities.data.items).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/\$214\.000/);
  });

  it("GET /v1/insights/overview joins a real SEO audit into problems", async () => {
    const { app, keys } = await buildTestApp({
      seo: mockSeo(SAMPLE_SEO_SUMMARY),
      analytics: mockAnalytics(
        { configured: true, ok: true, clicks: 10, impressions: 100, reason: undefined },
        { configured: true, ok: true, sessions: 200, users: 150, purchases: 4, reason: undefined },
      ),
    });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/insights/overview", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.demand.status).toBe("ok");
    expect(body.conversion.status).toBe("ok");
    expect(body.problems.data.items.some((row: { type: string }) => row.type === "seo_critical")).toBe(true);
  });
});

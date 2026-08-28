import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES } from "../src/config.js";
import { dispatchCommand } from "../src/core/commands/index.js";
import { createAnalyticsAdapter, normalizeGscSite, pagePathFromUrl } from "../src/adapters/analytics.js";
import { createCompetitorsAdapter, parseCompetitorUrls } from "../src/adapters/competitors.js";
import { buildTestApp, mockAnalytics, mockCompetitors, request, signToken } from "./helpers.js";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("analytics + competitors warehouse", () => {
  it("normalizeGscSite only allows Horizon origins", () => {
    expect(normalizeGscSite("https://evil.example/")).toBe("https://horizonfit.com.ar/");
    expect(normalizeGscSite("sc-domain:horizonfit.com.ar")).toBe("sc-domain:horizonfit.com.ar");
    expect(normalizeGscSite("https://horizonfit.com.ar")).toBe("https://horizonfit.com.ar/");
  });

  it("parseCompetitorUrls drops private hosts, http, and the shop itself", () => {
    expect(
      parseCompetitorUrls(
        "https://127.0.0.1/, http://rival.test/, https://horizonfit.com.ar/, https://rival.test/shop, https://rival.test/shop/",
      ),
    ).toEqual(["https://rival.test/shop"]);
    expect(parseCompetitorUrls("https://10.0.0.1/ https://192.168.1.2/ https://172.16.0.1/")).toEqual([]);
  });

  it("GA4 and GSC return configured:false without inventing traffic", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const ga4 = await request(app, "/v1/analytics/ga4", { token });
    const gsc = await request(app, "/v1/analytics/search-console", { token });
    expect(ga4.status).toBe(200);
    expect(gsc.status).toBe(200);
    const ga4Body = await ga4.json();
    const gscBody = await gsc.json();
    expect(ga4Body.configured).toBe(false);
    expect(ga4Body.reason).toBe("missing_google_credentials");
    expect(ga4Body.sessions).toBeNull();
    expect(gscBody.configured).toBe(false);
    expect(gscBody.clicks).toBeNull();
    expect(JSON.stringify(ga4Body)).not.toMatch(/\$214\.000/);
  });

  it("competitors return configured:false without env URLs", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/analytics/competitors", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toBe(false);
    expect(body.reason).toBe("missing_competitor_urls");
    expect(body.pages).toEqual([]);
  });

  it("mocked GSC and GA4 write warehouse snapshots", async () => {
    const { app, keys } = await buildTestApp({
      analytics: mockAnalytics(
        {
          configured: true,
          ok: true,
          clicks: 40,
          impressions: 800,
          ctr: 0.05,
          position: 8,
          queries: [{ query: "calza", clicks: 12, impressions: 100, ctr: 0.12, position: 4.2 }],
        },
        {
          configured: true,
          ok: true,
          property_id: "123456",
          sessions: 120,
          users: 90,
          purchases: 2,
          channels: [{ channel: "Organic Search", sessions: 80 }],
        },
      ),
    });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const gsc = await request(app, "/v1/analytics/search-console", { token });
    expect((await gsc.json()).clicks).toBe(40);
    const ga4 = await request(app, "/v1/analytics/ga4", { token });
    expect((await ga4.json()).sessions).toBe(120);

    const clicks = await request(app, "/v1/metrics/snapshots?kpi=gsc_clicks&limit=5", { token });
    const sessions = await request(app, "/v1/metrics/snapshots?kpi=ga4_sessions&limit=5", { token });
    expect((await clicks.json()).snapshots.some((row: { kpi: string; value: number }) => row.kpi === "gsc_clicks" && row.value === 40)).toBe(
      true,
    );
    expect(
      (await sessions.json()).snapshots.some((row: { kpi: string; value: number }) => row.kpi === "ga4_sessions" && row.value === 120),
    ).toBe(true);
  });

  it("GSC adapter posts to Search Console with a mocked token", async () => {
    const calls: string[] = [];
    const adapter = createAnalyticsAdapter({
      gscSiteUrl: "https://horizonfit.com.ar/",
      getAccessToken: async () => "ya29.test",
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push(url);
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        if (url.includes("searchAnalytics/query") && body.dimensions) {
          return jsonResponse({
            rows: [{ keys: ["calza deportiva"], clicks: 12, impressions: 100, ctr: 0.12, position: 4.2 }],
          });
        }
        if (url.includes("searchAnalytics/query")) {
          return jsonResponse({ rows: [{ clicks: 40, impressions: 800, ctr: 0.05, position: 8 }] });
        }
        return jsonResponse({}, 404);
      },
    });
    const report = await adapter.searchConsole();
    expect(report.configured).toBe(true);
    expect(report.ok).toBe(true);
    expect(report.clicks).toBe(40);
    expect(report.queries[0].query).toBe("calza deportiva");
    expect(calls.every((url) => url.includes("searchconsole.googleapis.com"))).toBe(true);
  });

  it("GA4 adapter runs a mocked report", async () => {
    const adapter = createAnalyticsAdapter({
      ga4PropertyId: "123456",
      getAccessToken: async () => "ya29.test",
      fetchImpl: async (input) => {
        expect(String(input)).toContain("analyticsdata.googleapis.com");
        expect(String(input)).toContain("properties/123456");
        return jsonResponse({
          rows: [
            {
              dimensionValues: [{ value: "Organic Search" }],
              metricValues: [{ value: "80" }, { value: "60" }, { value: "1" }],
            },
            {
              dimensionValues: [{ value: "Direct" }],
              metricValues: [{ value: "40" }, { value: "30" }, { value: "1" }],
            },
          ],
        });
      },
    });
    const report = await adapter.ga4();
    expect(report.configured).toBe(true);
    expect(report.sessions).toBe(120);
    expect(report.users).toBe(90);
    expect(report.channels).toHaveLength(2);
  });

  it("pagePathFromUrl only allows Horizon PDP paths", () => {
    expect(pagePathFromUrl("https://horizonfit.com.ar/product/top-liso-azul/")).toBe("/product/top-liso-azul/");
    expect(pagePathFromUrl("https://evil.example/product/top-liso-azul/")).toBeNull();
    expect(pagePathFromUrl("https://horizonfit.com.ar/coleccion/")).toBeNull();
  });

  it("GA4 product report joins itemId and pagePath", async () => {
    const adapter = createAnalyticsAdapter({
      ga4PropertyId: "550763778",
      getAccessToken: async () => "ya29.test",
      fetchImpl: async (_input, init) => {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        if (body.metrics?.[0]?.name === "screenPageViews") {
          return jsonResponse({
            rows: [{ dimensionValues: [{ value: "/product/top-liso-azul/" }], metricValues: [{ value: "1420" }] }],
          });
        }
        return jsonResponse({
          rows: [
            { dimensionValues: [{ value: "view_item" }, { value: "001-TOP-AZU" }], metricValues: [{ value: "900" }, { value: "0" }] },
            { dimensionValues: [{ value: "add_to_cart" }, { value: "001-TOP-AZU" }], metricValues: [{ value: "86" }, { value: "0" }] },
            { dimensionValues: [{ value: "purchase" }, { value: "001-TOP-AZU" }], metricValues: [{ value: "21" }, { value: "842000" }] },
          ],
        });
      },
    });
    const report = await adapter.ga4Product({
      parent_sku: "001-TOP-AZU",
      page_path: "https://horizonfit.com.ar/product/top-liso-azul/",
      item_ids: ["001-TOP-AZU-S"],
    });
    expect(report.configured).toBe(true);
    expect(report.pdp_views).toBe(1420);
    expect(report.add_to_cart).toBe(86);
    expect(report.purchase).toBe(21);
    expect(report.purchase_revenue).toBe(842000);
    expect(report.join.item_id).toBe("001-TOP-AZU");
    expect(report.cvr).toBeCloseTo(21 / 1420);
  });

  it("GSC product report filters by PDP slug", async () => {
    const adapter = createAnalyticsAdapter({
      gscSiteUrl: "sc-domain:horizonfit.com.ar",
      getAccessToken: async () => "ya29.test",
      fetchImpl: async (_input, init) => {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        expect(String(body.dimensionFilterGroups[0].filters[0].expression)).toContain("/product/top-liso-azul");
        if (body.dimensions) {
          return jsonResponse({ rows: [{ keys: ["top azul"], clicks: 40, impressions: 900, ctr: 0.044, position: 5.1 }] });
        }
        return jsonResponse({ rows: [{ clicks: 283, impressions: 12480, ctr: 0.0227, position: 7.8 }] });
      },
    });
    const report = await adapter.gscProduct({ slug: "top-liso-azul" });
    expect(report.configured).toBe(true);
    expect(report.clicks).toBe(283);
    expect(report.impressions).toBe(12480);
    expect(report.queries[0].query).toBe("top azul");
  });

  it("competitors adapter probes allowlisted HTML and ignores agent URLs at the tool layer", async () => {
    const adapter = createCompetitorsAdapter({
      urls: ["https://rival.test/shop"],
      fetchImpl: async (input) => {
        expect(String(input)).toBe("https://rival.test/shop");
        return new Response(
          `<html><head><title>Rival Shop</title><meta name="description" content="ropa deportiva"><link rel="canonical" href="https://rival.test/shop"></head><body><h1>Colección</h1></body></html>`,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      },
    });
    const report = await adapter.snapshot();
    expect(report.configured).toBe(true);
    expect(report.pages[0]).toMatchObject({
      host: "rival.test",
      ok: true,
      title: "Rival Shop",
      h1: "Colección",
      description: "ropa deportiva",
    });

    const { app, keys, services } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const principal = await services.auth.verifyAccessToken(token);
    const rejected = await dispatchCommand(services, "analytics.competitors", { url: "https://evil.example/" }, principal);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.status).toBe(400);
      expect(rejected.code).toBe("unsafe_args");
    }
    const empty = await request(app, "/v1/analytics/competitors", { token });
    expect(empty.status).toBe(200);
    expect((await empty.json()).pages).toEqual([]);
  });

  it("alerts.evaluate opens competitor_down and does not invent Google metrics", async () => {
    const { app, keys } = await buildTestApp({
      competitors: mockCompetitors({
        configured: true,
        pages: [
          {
            url: "https://rival.test/",
            host: "rival.test",
            status: 503,
            latency_ms: 12,
            title: "",
            description: "",
            h1: "",
            canonical: "",
            ok: false,
            error: "down",
          },
        ],
      }),
    });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const evaluated = await request(app, "/v1/alerts/evaluate", { method: "POST", token });
    expect(evaluated.status).toBe(200);
    const body = await evaluated.json();
    const open = (body.alerts as Array<{ rule_id: string; status: string }>).filter((alert) => alert.status === "open");
    expect(open.some((alert) => alert.rule_id === "competitor_down")).toBe(true);
    expect(open.some((alert) => alert.rule_id.startsWith("ga4_") || alert.rule_id.startsWith("gsc_"))).toBe(false);

    const snaps = await request(app, "/v1/metrics/snapshots?kpi=ga4_sessions&limit=5", { token });
    expect((await snaps.json()).snapshots).toEqual([]);
  });

  it("assistant.ask routes tráfico, GSC, competencia and allowlisted GA4 charts", async () => {
    const { app, keys } = await buildTestApp({
      analytics: mockAnalytics(
        { configured: true, ok: true, clicks: 40, impressions: 800 },
        { configured: true, ok: true, sessions: 120, users: 90 },
      ),
      competitors: mockCompetitors({
        configured: true,
        pages: [
          {
            url: "https://rival.test/",
            host: "rival.test",
            status: 200,
            latency_ms: 40,
            title: "Rival",
            description: "",
            h1: "Shop",
            canonical: "",
            ok: true,
          },
        ],
      }),
    });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    await request(app, "/v1/analytics/ga4", { token });

    const traffic = await request(app, "/v1/assistant/ask", {
      method: "POST",
      token,
      body: { question: "¿Cómo está el tráfico?" },
    });
    expect((await traffic.json()).intent).toBe("ga4");

    const gsc = await request(app, "/v1/assistant/ask", {
      method: "POST",
      token,
      body: { question: "¿Cuántos clicks hay en Search Console?" },
    });
    expect((await gsc.json()).intent).toBe("gsc");

    const rivals = await request(app, "/v1/assistant/ask", {
      method: "POST",
      token,
      body: { question: "¿Cómo está la competencia?" },
    });
    expect((await rivals.json()).intent).toBe("competitors");

    const chart = await request(app, "/v1/assistant/ask", {
      method: "POST",
      token,
      body: { question: "Generá un gráfico de sesiones GA4" },
    });
    const chartBody = await chart.json();
    expect(chartBody.intent).toBe("chart");
    expect(chartBody.data.chart).toMatchObject({ type: "line", kpi: "ga4_sessions", title: "Sesiones GA4" });
  });

  it("Cursor cannot call analytics tools", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    expect((await request(app, "/v1/analytics/ga4", { token })).status).toBe(403);
    expect((await request(app, "/v1/analytics/search-console", { token })).status).toBe(403);
    expect((await request(app, "/v1/analytics/competitors", { token })).status).toBe(403);
  });
});

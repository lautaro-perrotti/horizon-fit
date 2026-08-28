import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES } from "../src/config.js";
import { productSlugFromUrl, summarizeSeoReport } from "../src/adapters/seo-report.js";
import { buildTestApp, mockSeo, request, SAMPLE_SEO_SUMMARY, signToken } from "./helpers.js";

describe("SEO warehouse", () => {
  it("summarizeSeoReport keeps only pages with issues and product slugs", () => {
    const summary = summarizeSeoReport(
      {
        generatedAt: "2026-08-27T12:00:00.000Z",
        auditedCount: 3,
        totals: { critical: 1, warning: 1 },
        pages: [
          { url: "https://horizonfit.com.ar/", title: "Home", issues: { critical: [], warning: [] } },
          {
            url: "https://horizonfit.com.ar/product/top-liso-azul/",
            title: "Top",
            issues: { critical: [{ message: "H1 vacío" }], warning: [] },
          },
          {
            url: "https://horizonfit.com.ar/coleccion/",
            title: "Shop",
            issues: { critical: [], warning: [{ message: "Title duplicado." }] },
          },
        ],
      },
      "reports/seo-audit/latest.json",
    );
    expect(summary?.pages).toHaveLength(2);
    expect(productSlugFromUrl("https://horizonfit.com.ar/product/top-liso-azul/")).toBe("top-liso-azul");
    expect(summary?.pages[0].slug).toBe("top-liso-azul");
    expect(summary?.totals.critical).toBe(1);
  });

  it("seo.get_latest_audit returns configured:false without inventing issues", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/seo/audits/latest", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toBe(false);
    expect(body.reason).toBe("missing_seo_report");
    expect(body.summary).toBeNull();
    expect(body.job).toBeNull();
  });

  it("seo.get_latest_audit returns the summary from the adapter", async () => {
    const { app, keys } = await buildTestApp({ seo: mockSeo(SAMPLE_SEO_SUMMARY) });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/seo/audits/latest", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toBe(true);
    expect(body.summary.totals.critical).toBe(1);
    expect(body.summary.pages[0].slug).toBe("top-liso-azul");
    expect(JSON.stringify(body)).not.toMatch(/\$214\.000/);
  });

  it("alerts.evaluate opens seo_stale without a report and does not invent criticals", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const evaluated = await request(app, "/v1/alerts/evaluate", { method: "POST", token });
    expect(evaluated.status).toBe(200);
    const body = await evaluated.json();
    const open = (body.alerts as Array<{ rule_id: string; status: string }>).filter((alert) => alert.status === "open");
    expect(open.some((alert) => alert.rule_id === "seo_stale")).toBe(true);
    expect(open.some((alert) => alert.rule_id === "seo_critical")).toBe(false);
  });

  it("alerts.evaluate opens seo_critical and writes seo snapshots when a report exists", async () => {
    const { app, keys } = await buildTestApp({ seo: mockSeo(SAMPLE_SEO_SUMMARY) });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const evaluated = await request(app, "/v1/alerts/evaluate", { method: "POST", token });
    expect(evaluated.status).toBe(200);
    const body = await evaluated.json();
    const open = (body.alerts as Array<{ rule_id: string; status: string }>).filter((alert) => alert.status === "open");
    expect(open.some((alert) => alert.rule_id === "seo_critical")).toBe(true);
    expect(open.some((alert) => alert.rule_id === "seo_warnings")).toBe(true);
    expect(open.some((alert) => alert.rule_id === "seo_stale")).toBe(false);

    const snaps = await request(app, "/v1/metrics/snapshots?kpi=seo_critical&limit=5", { token });
    const snapBody = await snaps.json();
    expect(snapBody.snapshots.some((row: { kpi: string; value: number }) => row.kpi === "seo_critical" && row.value === 1)).toBe(
      true,
    );
  });

  it("assistant.ask routes SEO and allowlisted chart specs", async () => {
    const { app, keys } = await buildTestApp({ seo: mockSeo(SAMPLE_SEO_SUMMARY) });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    await request(app, "/v1/alerts/evaluate", { method: "POST", token });

    const seo = await request(app, "/v1/assistant/ask", {
      method: "POST",
      token,
      body: { question: "¿Cómo está el SEO?" },
    });
    expect(seo.status).toBe(200);
    const seoBody = await seo.json();
    expect(seoBody.intent).toBe("seo");
    expect(seoBody.data.configured).toBe(true);
    expect(seoBody.data.summary.totals.warning).toBe(7);

    const chart = await request(app, "/v1/assistant/ask", {
      method: "POST",
      token,
      body: { question: "Generá un gráfico de warnings SEO" },
    });
    const chartBody = await chart.json();
    expect(chartBody.intent).toBe("chart");
    expect(chartBody.data.chart).toMatchObject({ type: "line", kpi: "seo_warning", title: "Warnings SEO" });
    expect(Array.isArray(chartBody.data.series)).toBe(true);
  });

  it("assistant.ask lists allowlisted KPIs when the chart is unknown", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/assistant/ask", {
      method: "POST",
      token,
      body: { question: "Generá un gráfico de marte" },
    });
    const body = await response.json();
    expect(body.intent).toBe("chart");
    expect(body.data.chart).toBeNull();
    expect(body.data.available.some((row: { kpi: string }) => row.kpi === "seo_warning")).toBe(true);
  });
});

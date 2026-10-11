import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES } from "../src/config.js";
import { isInfraJobFailure, shouldRefreshMetric, shouldScheduleSeoAudit, uniqueHosts } from "../src/adapters/warehouse.js";
import { productSlugFromUrl, resolveSeoReportPath, summarizeSeoReport } from "../src/adapters/seo-report.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildTestApp, mockSeo, request, SAMPLE_SEO_SUMMARY, signToken } from "./helpers.js";

describe("SEO warehouse", () => {
  it("prefers the newest SEO report over a stale latest.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hc-seo-"));
    fs.writeFileSync(path.join(dir, "latest.json"), "{\"generatedAt\":\"2026-08-28T00:00:00.000Z\"}\n");
    const stamped = path.join(dir, "seo-audit-20261011-094357.json");
    fs.writeFileSync(stamped, "{\"generatedAt\":\"2026-10-11T09:43:57.000Z\"}\n");
    const older = Date.now() - 86_400_000;
    const newer = Date.now();
    fs.utimesSync(path.join(dir, "latest.json"), older / 1000, older / 1000);
    fs.utimesSync(stamped, newer / 1000, newer / 1000);
    expect(resolveSeoReportPath(dir)).toBe(stamped);
  });

  it("deduplicates competitor_down hosts", () => {
    expect(uniqueHosts([{ host: "www.adidas.com.ar" }, { host: "www.adidas.com.ar" }, { host: "touchesport.com" }])).toEqual([
      "www.adidas.com.ar",
      "touchesport.com",
    ]);
  });

  it("refreshes GA4/GSC warehouse metrics only after TTL", () => {
    const now = 1_000_000;
    expect(shouldRefreshMetric(null, now, 30 * 60_000)).toBe(true);
    expect(shouldRefreshMetric(now - 60_000, now, 30 * 60_000)).toBe(false);
    expect(shouldRefreshMetric(now - 31 * 60_000, now, 30 * 60_000)).toBe(true);
  });

  it("does not treat seo.audit findings exit as infra failure", () => {
    expect(isInfraJobFailure({ type: "seo.audit", status: "failed", error: "exit_1" })).toBe(false);
    expect(isInfraJobFailure({ type: "sales.sync", status: "failed", error: "timeout" })).toBe(true);
  });

  it("does not re-enqueue seo.audit when a failed job already wrote a fresh report", () => {
    const now = Date.parse("2026-10-11T12:00:00.000Z");
    expect(
      shouldScheduleSeoAudit({
        busy: false,
        lastJob: { status: "failed", createdAt: now - 60_000, finishedAt: now - 30_000 },
        reportGeneratedAt: "2026-10-11T11:59:00.000Z",
        now,
      }),
    ).toBe(false);
    expect(
      shouldScheduleSeoAudit({
        busy: false,
        lastJob: { status: "failed", createdAt: now - 13 * 3_600_000, finishedAt: now - 13 * 3_600_000 },
        reportGeneratedAt: "2026-10-10T20:00:00.000Z",
        now,
      }),
    ).toBe(true);
  });

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
    expect(productSlugFromUrl("https://horizonfit.com.ar/producto/top-falda-bordo/")).toBe("top-falda-bordo");
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

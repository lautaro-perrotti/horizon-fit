import { describe, expect, it } from "vitest";
import { chartStateFromSeries, executiveAnswers, HORIZON_CHARTS, seriesToLine } from "../src/adapters/charts.js";
import type { MetricSeries } from "../src/adapters/history.js";
import { CLIENT_SCOPES } from "../src/config.js";
import { buildTestApp, request, signToken } from "./helpers.js";
import { createHistoryStore } from "../src/adapters/history.js";
import { isoDay } from "../src/core/slice.js";

describe("HorizonChart states", () => {
  it("keeps missing days as null so the plot does not fabricate zeros", () => {
    const series = {
      store_id: "horizon-fit",
      entity: "store" as const,
      parent_sku: null,
      source: "woo_rest_orders",
      metric: "revenue",
      range: { label: "7d" as const, start: isoDay(6), end: isoDay(0) },
      compare: null,
      current: {
        points: [
          { day: isoDay(1), value: 50000, status: "ok" as const },
          { day: isoDay(0), value: null, status: "unknown" as const, reason: "no_observation" },
        ],
        total: 50000,
        status: "ok" as const,
      },
      previous: null,
      delta: null,
      delta_pct: null,
      note: "comparison is the previous window of equal length; not seasonally adjusted",
      sync: { last_success_at: null, covered_from: null, covered_to: null, last_status: null },
    };
    const state = chartStateFromSeries(series, "woo_rest_orders");
    expect(state.plottable).toBe(true);
    expect(seriesToLine(series).values).toEqual([50000, null]);
    expect(chartStateFromSeries(null, "gsc")).toMatchObject({ status: "unknown", plottable: false });
  });

  it("does not invent actions when Growth is not joined", () => {
    const answers = executiveAnswers({
      revenueStatus: "not_configured",
      demandStatus: "not_configured",
      conversionStatus: "unknown",
      problems: [],
      opportunitiesStatus: "not_joined",
      changes: [],
    });
    expect(answers.what_works[0]).toMatch(/Ninguna fuente/);
    expect(answers.what_to_do_today[0]).toMatch(/Growth Engine/);
    const shipped = executiveAnswers({
      revenueStatus: "not_configured",
      demandStatus: "not_configured",
      conversionStatus: "unknown",
      problems: [],
      opportunitiesStatus: "zero",
      opportunityTitles: [],
      changes: [],
    });
    expect(shipped.what_to_do_today[0]).not.toMatch(/Growth Engine todavía no está shipped/);
    expect(HORIZON_CHARTS.filter((row) => row.kind === "deferred").every((row) => row.status === "not_joined")).toBe(true);
  });

  it("serves vendored ECharts from /app/vendor without a CDN", async () => {
    const { app } = await buildTestApp();
    const js = await request(app, "/app/vendor/echarts.min.js");
    expect(js.status).toBe(200);
    const text = await js.text();
    expect(text).toMatch(/Apache Software Foundation/);
    expect(text).not.toMatch(/cdn\.jsdelivr|unpkg|cdnjs/);

    const page = await request(app, "/app/");
    const html = await page.text();
    expect(html).toMatch(/\/app\/vendor\/echarts\.min\.js/);
    expect(html).toMatch(/HorizonChart/);
    expect(html).toMatch(/Cómo vamos|execAnswers/);
    expect(html).not.toMatch(/\$214\.000/);
  });

  it("series used by charts still leaves gaps as unknown", async () => {
    const { app, keys, services } = await buildTestApp();
    createHistoryStore(services.db).upsert([{ day: isoDay(0), source: "woo_rest_orders", metric: "revenue", value: 1000, status: "ok" }]);
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/metrics/series?metric=revenue&range=7d&compare=none", { token });
    const body = await response.json<MetricSeries>();
    const line = seriesToLine(body);
    expect(line.values.some((value) => value === null)).toBe(true);
    expect(line.values.includes(0)).toBe(false);
  });
});

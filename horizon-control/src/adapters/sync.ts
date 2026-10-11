import type { CommerceAdapter } from "./commerce.js";
import type { AnalyticsAdapter } from "./analytics.js";
import type { HistoryStore } from "./history.js";
import { isoDay, type SliceStatus } from "../core/slice.js";

export type SyncResult = {
  source: string;
  status: SliceStatus;
  reason?: string;
  store_points: number;
  product_points: number;
  covered_from: string | null;
  covered_to: string | null;
};

function result(source: string, status: SliceStatus, extra: Partial<SyncResult> = {}): SyncResult {
  return { source, status, store_points: 0, product_points: 0, covered_from: null, covered_to: null, ...extra };
}

export async function runSalesSync(commerce: CommerceAdapter, history: HistoryStore): Promise<SyncResult> {
  const source = "woo_rest_orders";
  const breakdown = await commerce.dailyBreakdown();
  if (!breakdown.configured) {
    history.markSync(source, { status: "not_configured", reason: breakdown.reason, success: false });
    return result(source, "not_configured", { reason: breakdown.reason });
  }
  if (breakdown.reason && !breakdown.store.length && !breakdown.products.length) {
    history.markSync(source, { status: "error", reason: breakdown.reason, success: false });
    return result(source, "error", { reason: breakdown.reason });
  }
  const points = [
    ...breakdown.store.flatMap((row) =>
      (["orders", "units", "revenue"] as const).map((metric) => ({
        day: row.day,
        source,
        metric,
        value: row[metric],
        status: (row.orders === 0 && row.units === 0 ? "zero" : "ok") as SliceStatus,
      })),
    ),
    ...breakdown.products.flatMap((row) =>
      (["orders", "units", "revenue"] as const).map((metric) => ({
        day: row.day,
        source,
        metric,
        value: row[metric],
        status: (row.orders === 0 && row.units === 0 ? "zero" : "ok") as SliceStatus,
        parent_sku: row.parent_sku,
      })),
    ),
  ];
  history.upsert(points);
  const days = [...new Set(points.map((point) => point.day))].sort();
  const covered = { coveredFrom: days[0] ?? isoDay(90), coveredTo: days.at(-1) ?? isoDay(0) };
  history.markSync(source, { status: "ok", ...covered });
  return result(source, "ok", {
    store_points: breakdown.store.length * 3,
    product_points: breakdown.products.length * 3,
    covered_from: covered.coveredFrom,
    covered_to: covered.coveredTo,
  });
}

export async function runGa4Sync(analytics: AnalyticsAdapter, history: HistoryStore): Promise<SyncResult> {
  const source = "ga4";
  const report = await analytics.ga4Daily(90);
  if (!report.configured) {
    history.markSync(source, { status: "not_configured", reason: report.reason, success: false });
    return result(source, "not_configured", { reason: report.reason });
  }
  if (!report.ok) {
    history.markSync(source, { status: "error", reason: report.reason, success: false });
    return result(source, "error", { reason: report.reason });
  }
  const points = report.points.flatMap((point) =>
    Object.entries(point.metrics).map(([metric, value]) => ({
      day: point.day,
      source,
      metric,
      value,
      status: point.status,
      reason: point.reason,
    })),
  );
  history.upsert(points);
  const days = report.points.map((point) => point.day).sort();
  const covered = { coveredFrom: days[0] ?? null, coveredTo: days.at(-1) ?? null };
  history.markSync(source, { status: "ok", ...covered });
  return result(source, "ok", { store_points: points.length, covered_from: covered.coveredFrom, covered_to: covered.coveredTo });
}

export async function runGscSync(analytics: AnalyticsAdapter, history: HistoryStore): Promise<SyncResult> {
  const source = "gsc";
  const report = await analytics.gscDaily(90);
  if (!report.configured) {
    history.markSync(source, { status: "not_configured", reason: report.reason, success: false });
    return result(source, "not_configured", { reason: report.reason });
  }
  if (!report.ok) {
    history.markSync(source, { status: "error", reason: report.reason, success: false });
    return result(source, "error", { reason: report.reason });
  }
  const points = report.points.flatMap((point) =>
    Object.entries(point.metrics).map(([metric, value]) => ({
      day: point.day,
      source,
      metric,
      value,
      status: point.status,
      reason: point.reason,
    })),
  );
  history.upsert(points);
  const days = report.points.map((point) => point.day).sort();
  const covered = { coveredFrom: days[0] ?? null, coveredTo: days.at(-1) ?? null };
  history.markSync(source, { status: "ok", ...covered });
  return result(source, "ok", { store_points: points.length, covered_from: covered.coveredFrom, covered_to: covered.coveredTo });
}

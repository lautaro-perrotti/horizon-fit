import { and, eq, gte, lte } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { dailyProductMetrics, dailyStoreMetrics, syncState } from "../db/schema.js";
import { isoDay, type SliceStatus } from "../core/slice.js";

export const STORE_ID = "horizon-fit";

export type SeriesRange = "7d" | "28d" | "90d" | "ytd" | "custom";

export type SeriesPoint = {
  day: string;
  value: number | null;
  status: SliceStatus;
  reason?: string;
};

export type MetricSeries = {
  store_id: string;
  entity: "store" | "product";
  parent_sku: string | null;
  source: string;
  metric: string;
  range: { label: SeriesRange | "custom"; start: string; end: string };
  compare: { start: string; end: string; label: "previous" } | null;
  current: { points: SeriesPoint[]; total: number | null; status: SliceStatus };
  previous: { points: SeriesPoint[]; total: number | null; status: SliceStatus } | null;
  delta: number | null;
  delta_pct: number | null;
  note: string;
  sync: { last_success_at: string | null; covered_from: string | null; covered_to: string | null; last_status: string | null };
};

export type HistoryPoint = {
  day: string;
  source: string;
  metric: string;
  value: number | null;
  status: SliceStatus;
  parent_sku?: string;
};

const DEFAULT_SOURCE: Record<string, string> = {
  revenue: "woo_rest_orders",
  units: "woo_rest_orders",
  orders: "woo_rest_orders",
  sessions: "ga4",
  users: "ga4",
  purchases: "ga4",
  clicks: "gsc",
  impressions: "gsc",
  ctr: "gsc",
  position: "gsc",
};

const NOTE = "comparison is the previous window of equal length; not seasonally adjusted";

function daysInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= last.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function resolveRange(range: SeriesRange, start?: string, end?: string, now = new Date()): { start: string; end: string } {
  if (range === "custom") {
    if (!start || !end || start > end) throw Object.assign(new Error("invalid_custom_range"), { status: 400 });
    return { start, end };
  }
  const today = isoDay(0, now);
  if (range === "ytd") return { start: `${now.getUTCFullYear()}-01-01`, end: today };
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 28;
  return { start: isoDay(days - 1, now), end: today };
}

export function previousRange(start: string, end: string): { start: string; end: string } {
  const length = daysInclusive(start, end).length;
  const prevEnd = isoDay(1, new Date(`${start}T00:00:00Z`));
  return { start: isoDay(length - 1, new Date(`${prevEnd}T00:00:00Z`)), end: prevEnd };
}

function fillPoints(days: string[], rows: Array<{ day: string; value: number | null; status: string }>): SeriesPoint[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return days.map((day) => {
    const row = byDay.get(day);
    if (!row) return { day, value: null, status: "unknown", reason: "no_observation" };
    return { day, value: row.value, status: row.status as SliceStatus };
  });
}

function summarize(points: SeriesPoint[]): { total: number | null; status: SliceStatus } {
  const observed = points.filter((point) => point.value != null);
  if (!observed.length) {
    if (points.every((point) => point.status === "not_configured")) return { total: null, status: "not_configured" };
    if (points.every((point) => point.status === "error")) return { total: null, status: "error" };
    return { total: null, status: "unknown" };
  }
  const total = observed.reduce((sum, point) => sum + (point.value ?? 0), 0);
  if (total === 0 && observed.every((point) => point.status === "zero" || point.value === 0)) return { total: 0, status: "zero" };
  return { total, status: "ok" };
}

export function createHistoryStore(db: HorizonDb) {
  function upsert(points: HistoryPoint[], now = Date.now()) {
    for (const point of points) {
      if (point.parent_sku) {
        db.insert(dailyProductMetrics)
          .values({
            storeId: STORE_ID,
            day: point.day,
            parentSku: point.parent_sku,
            source: point.source,
            metric: point.metric,
            value: point.value,
            status: point.status,
            syncedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              dailyProductMetrics.storeId,
              dailyProductMetrics.day,
              dailyProductMetrics.parentSku,
              dailyProductMetrics.source,
              dailyProductMetrics.metric,
            ],
            set: { value: point.value, status: point.status, syncedAt: now },
          })
          .run();
      } else {
        db.insert(dailyStoreMetrics)
          .values({
            storeId: STORE_ID,
            day: point.day,
            source: point.source,
            metric: point.metric,
            value: point.value,
            status: point.status,
            syncedAt: now,
          })
          .onConflictDoUpdate({
            target: [dailyStoreMetrics.storeId, dailyStoreMetrics.day, dailyStoreMetrics.source, dailyStoreMetrics.metric],
            set: { value: point.value, status: point.status, syncedAt: now },
          })
          .run();
      }
    }
  }

  function markSync(source: string, input: {
    status: SliceStatus;
    reason?: string;
    coveredFrom?: string | null;
    coveredTo?: string | null;
    success?: boolean;
  }, now = Date.now()) {
    const existing = db.select().from(syncState).where(and(eq(syncState.storeId, STORE_ID), eq(syncState.source, source))).get();
    const lastSuccessAt = input.success === false ? existing?.lastSuccessAt ?? null : now;
    const row = {
      storeId: STORE_ID,
      source,
      lastSyncedAt: now,
      lastSuccessAt,
      coveredFrom: input.coveredFrom ?? existing?.coveredFrom ?? null,
      coveredTo: input.coveredTo ?? existing?.coveredTo ?? null,
      lastStatus: input.status,
      lastReason: input.reason ?? null,
    };
    if (existing) {
      db.update(syncState).set(row).where(and(eq(syncState.storeId, STORE_ID), eq(syncState.source, source))).run();
      return;
    }
    db.insert(syncState).values(row).run();
  }

  function syncOf(source: string) {
    const row = db.select().from(syncState).where(and(eq(syncState.storeId, STORE_ID), eq(syncState.source, source))).get();
    return {
      last_success_at: row?.lastSuccessAt ? new Date(row.lastSuccessAt).toISOString() : null,
      covered_from: row?.coveredFrom ?? null,
      covered_to: row?.coveredTo ?? null,
      last_status: row?.lastStatus ?? null,
      last_reason: row?.lastReason ?? null,
      last_synced_at: row?.lastSyncedAt ?? null,
    };
  }

  function series(input: {
    metric: string;
    entity?: string;
    source?: string;
    range?: SeriesRange;
    start?: string;
    end?: string;
    compare?: "previous" | "none";
  }): MetricSeries {
    const metric = input.metric.trim();
    if (!metric) throw Object.assign(new Error("missing_metric"), { status: 400 });
    const source = (input.source?.trim() || DEFAULT_SOURCE[metric] || "").trim();
    if (!source) throw Object.assign(new Error("missing_source"), { status: 400 });
    const range = resolveRange(input.range ?? "28d", input.start, input.end);
    const sku = !input.entity || input.entity === "store" ? null : input.entity.toUpperCase();
    const days = daysInclusive(range.start, range.end);
    const rows = sku
      ? db
          .select()
          .from(dailyProductMetrics)
          .where(
            and(
              eq(dailyProductMetrics.storeId, STORE_ID),
              eq(dailyProductMetrics.parentSku, sku),
              eq(dailyProductMetrics.source, source),
              eq(dailyProductMetrics.metric, metric),
              gte(dailyProductMetrics.day, range.start),
              lte(dailyProductMetrics.day, range.end),
            ),
          )
          .all()
      : db
          .select()
          .from(dailyStoreMetrics)
          .where(
            and(
              eq(dailyStoreMetrics.storeId, STORE_ID),
              eq(dailyStoreMetrics.source, source),
              eq(dailyStoreMetrics.metric, metric),
              gte(dailyStoreMetrics.day, range.start),
              lte(dailyStoreMetrics.day, range.end),
            ),
          )
          .all();
    const currentPoints = fillPoints(days, rows);
    const current = { points: currentPoints, ...summarize(currentPoints) };
    const compare = input.compare === "none" ? null : previousRange(range.start, range.end);
    let previous: MetricSeries["previous"] = null;
    let delta: number | null = null;
    let delta_pct: number | null = null;
    if (compare) {
      const prevRows = sku
        ? db
            .select()
            .from(dailyProductMetrics)
            .where(
              and(
                eq(dailyProductMetrics.storeId, STORE_ID),
                eq(dailyProductMetrics.parentSku, sku),
                eq(dailyProductMetrics.source, source),
                eq(dailyProductMetrics.metric, metric),
                gte(dailyProductMetrics.day, compare.start),
                lte(dailyProductMetrics.day, compare.end),
              ),
            )
            .all()
        : db
            .select()
            .from(dailyStoreMetrics)
            .where(
              and(
                eq(dailyStoreMetrics.storeId, STORE_ID),
                eq(dailyStoreMetrics.source, source),
                eq(dailyStoreMetrics.metric, metric),
                gte(dailyStoreMetrics.day, compare.start),
                lte(dailyStoreMetrics.day, compare.end),
              ),
            )
            .all();
      const prevPoints = fillPoints(daysInclusive(compare.start, compare.end), prevRows);
      previous = { points: prevPoints, ...summarize(prevPoints) };
      if (current.total != null && previous.total != null) {
        delta = current.total - previous.total;
        delta_pct = previous.total === 0 ? null : delta / previous.total;
      }
    }
    return {
      store_id: STORE_ID,
      entity: sku ? "product" : "store",
      parent_sku: sku,
      source,
      metric,
      range: { label: input.range ?? "28d", start: range.start, end: range.end },
      compare: compare ? { ...compare, label: "previous" } : null,
      current,
      previous,
      delta,
      delta_pct,
      note: NOTE,
      sync: syncOf(source),
    };
  }

  return { upsert, markSync, syncOf, series };
}

export type HistoryStore = ReturnType<typeof createHistoryStore>;

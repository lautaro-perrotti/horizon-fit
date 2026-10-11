/**
 * SourceSlice: the single envelope every integration result travels in.
 *
 * `status` is the contract. It separates a real zero from an unknown value, a missing
 * credential from a failed call, and a join that is not implemented from one that found
 * nothing. UI and AI read `status`; `available`/`configured` remain for older clients.
 */
export type SliceStatus = "ok" | "zero" | "unknown" | "not_configured" | "error" | "not_joined" | "stale";

export type JoinConfidence = "exact" | "inferred" | "none";

export type SlicePeriod = { start: string; end: string; label?: string };

export type SourceSlice<T> = {
  status: SliceStatus;
  /** true only for `ok` and `zero`: the data field holds real observations. */
  available: boolean;
  /** credentials/config present for this source. */
  configured: boolean;
  /** machine-readable reason for any non-ok status (missing_google_credentials, gsc_http_403, orders_page_cap, …). */
  reason?: string;
  /** system of record, e.g. woo_store_api, woo_rest_orders, ga4, gsc, seo_audit, merchant_feed, competitors. */
  source: string;
  fetched_at: string | null;
  period?: SlicePeriod;
  join_confidence?: JoinConfidence;
  /** after this many ms past fetched_at the slice is reported as `stale`. */
  stale_after_ms?: number;
  data: T | null;
};

type SliceMeta = {
  fetched_at?: string | null;
  period?: SlicePeriod;
  join_confidence?: JoinConfidence;
  stale_after_ms?: number;
  reason?: string;
};

export function okSlice<T>(source: string, data: T, meta: SliceMeta = {}): SourceSlice<T> {
  return {
    status: "ok",
    available: true,
    configured: true,
    source,
    fetched_at: meta.fetched_at ?? new Date().toISOString(),
    period: meta.period,
    join_confidence: meta.join_confidence ?? "exact",
    stale_after_ms: meta.stale_after_ms,
    reason: meta.reason,
    data,
  };
}

/** Source answered and the entity really has no activity in the period. */
export function zeroSlice<T>(source: string, data: T, meta: SliceMeta = {}): SourceSlice<T> {
  return { ...okSlice(source, data, meta), status: "zero" };
}

/** Source answered but this entity could not be measured (join key absent, page cap hit). */
export function unknownSlice<T = null>(source: string, reason: string, meta: SliceMeta = {}): SourceSlice<T> {
  return {
    status: "unknown",
    available: false,
    configured: true,
    reason,
    source,
    fetched_at: meta.fetched_at ?? null,
    period: meta.period,
    join_confidence: meta.join_confidence ?? "none",
    stale_after_ms: meta.stale_after_ms,
    data: null,
  };
}

export function notConfiguredSlice<T = null>(source: string, reason: string): SourceSlice<T> {
  return { status: "not_configured", available: false, configured: false, reason, source, fetched_at: null, data: null };
}

export function errorSlice<T = null>(source: string, reason: string, meta: SliceMeta = {}): SourceSlice<T> {
  return {
    status: "error",
    available: false,
    configured: true,
    reason,
    source,
    fetched_at: meta.fetched_at ?? null,
    period: meta.period,
    data: null,
  };
}

export function notJoinedSlice<T = null>(source: string, reason = "not_joined_yet"): SourceSlice<T> {
  return { status: "not_joined", available: false, configured: false, reason, source, fetched_at: null, data: null };
}

/** Re-labels an `ok`/`zero` slice as `stale` when its fetched_at is older than the TTL. Data is kept. */
export function withStaleness<T>(slice: SourceSlice<T>, now = Date.now()): SourceSlice<T> {
  if ((slice.status !== "ok" && slice.status !== "zero") || !slice.fetched_at || !slice.stale_after_ms) return slice;
  const age = now - Date.parse(slice.fetched_at);
  if (!Number.isFinite(age) || age <= slice.stale_after_ms) return slice;
  return { ...slice, status: "stale", reason: slice.reason ?? "stale" };
}

export function isoDay(daysAgo = 0, now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

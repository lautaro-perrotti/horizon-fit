// SourceSlice helpers. Mirrors src/core/slice.ts and the evidence rule in src/ai/tools.ts:
// status if present, configured:false → not_configured, available:true → ok, ok:false → error.

export const STATUS_LABEL = {
  ok: "ok",
  zero: "cero",
  unknown: "desconocido",
  not_configured: "sin configurar",
  error: "error",
  not_joined: "sin join",
  stale: "viejo",
  loading: "cargando",
  session: "sesión vencida",
  scope: "falta scope",
};

export const PLOTTABLE = new Set(["ok", "zero", "stale"]);

export function statusOf(payload) {
  if (!payload || typeof payload !== "object") return "unknown";
  if (typeof payload.status === "string" && STATUS_LABEL[payload.status]) return payload.status;
  if (payload.configured === false) return "not_configured";
  if (payload.ok === false) return "error";
  if (payload.available === true) return "ok";
  return "ok";
}

/** Normalizes a legacy `{configured, ok, reason}` payload into a slice-shaped object. */
export function asSlice(payload, source = null) {
  const status = statusOf(payload);
  return {
    status,
    available: status === "ok" || status === "zero" || status === "stale",
    reason: payload?.reason ?? (payload?.ok === false ? payload?.error ?? null : null),
    source: payload?.source ?? source,
    fetched_at: payload?.fetched_at ?? null,
    data: payload ?? null,
  };
}

export function isAvailable(slice) {
  return Boolean(slice && (slice.available || PLOTTABLE.has(slice.status)));
}

/** Status for an ApiError: 401 → session, 403 → scope, otherwise error. */
export function statusFromError(error) {
  if (error?.status === 401) return "session";
  if (error?.status === 403) return "scope";
  return "error";
}

export function label(status) {
  return STATUS_LABEL[status] ?? status ?? "desconocido";
}

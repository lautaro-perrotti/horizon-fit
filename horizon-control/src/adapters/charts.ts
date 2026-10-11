import type { MetricSeries } from "./history.js";
import type { SliceStatus } from "../core/slice.js";

export type ChartKind = "line" | "funnel" | "deferred";

export type HorizonChartSpec = {
  id: string;
  title: string;
  kind: ChartKind;
  metric?: string;
  source: string;
  definition: string;
  status?: SliceStatus;
  reason?: string;
};

export const HORIZON_CHARTS: HorizonChartSpec[] = [
  {
    id: "revenue",
    title: "Revenue",
    kind: "line",
    metric: "revenue",
    source: "woo_rest_orders",
    definition: "Suma diaria de line totals de pedidos paid (processing / completed / on-hold).",
  },
  {
    id: "units",
    title: "Units",
    kind: "line",
    metric: "units",
    source: "woo_rest_orders",
    definition: "Unidades vendidas por día desde line items, agrupadas por parent SKU o tienda.",
  },
  {
    id: "gsc_impressions",
    title: "GSC impressions",
    kind: "line",
    metric: "impressions",
    source: "gsc",
    definition: "Impresiones diarias de Search Console para horizonfit.com.ar.",
  },
  {
    id: "gsc_clicks",
    title: "GSC clicks",
    kind: "line",
    metric: "clicks",
    source: "gsc",
    definition: "Clicks diarios de Search Console. Días sin fila quedan unknown, no cero.",
  },
  {
    id: "gsc_ctr",
    title: "GSC CTR",
    kind: "line",
    metric: "ctr",
    source: "gsc",
    definition: "CTR diario reportado por Search Console. No se recalcula inventando clicks.",
  },
  {
    id: "ga4_sessions",
    title: "GA4 sessions",
    kind: "line",
    metric: "sessions",
    source: "ga4",
    definition: "Sesiones diarias de la property GA4. Requiere ga4.sync.",
  },
  {
    id: "ga4_funnel",
    title: "GA4 funnel",
    kind: "funnel",
    source: "ga4",
    definition: "Sesiones → usuarios → purchases del snapshot GA4 28d. Sin add_to_cart store-level no se inventa el medio.",
  },
  {
    id: "stock_velocity",
    title: "Stock vs velocity",
    kind: "deferred",
    source: "not_joined",
    definition: "Necesita stock diario. Hoy no hay serie de inventario.",
    status: "not_joined",
    reason: "daily_stock_not_shipped",
  },
  {
    id: "price_history",
    title: "Price history",
    kind: "deferred",
    source: "not_joined",
    definition: "El catálogo Woo no guarda historial de precio en Control.",
    status: "not_joined",
    reason: "price_history_not_shipped",
  },
  {
    id: "competitor_price",
    title: "Competitor price history",
    kind: "deferred",
    source: "not_joined",
    definition: "Espera Competitor 360 (snapshots). No se inventa un índice.",
    status: "not_joined",
    reason: "competitor_snapshots_not_shipped",
  },
  {
    id: "category_performance",
    title: "Category performance",
    kind: "deferred",
    source: "not_joined",
    definition: "No hay rollup diario por categoría todavía.",
    status: "not_joined",
    reason: "category_rollup_not_shipped",
  },
];

export type ChartViewState = {
  status: SliceStatus | "loading";
  reason?: string;
  plottable: boolean;
  source: string;
  note?: string;
};

export function chartStateFromSeries(series: MetricSeries | null | undefined, fallbackSource: string): ChartViewState {
  if (!series) {
    return { status: "unknown", reason: "missing_series", plottable: false, source: fallbackSource };
  }
  const status = series.current.status;
  return {
    status,
    reason: status === "unknown" ? "no_observation" : undefined,
    plottable: status === "ok" || status === "zero" || status === "stale",
    source: series.source,
    note: series.note,
  };
}

export function seriesToLine(series: MetricSeries): {
  days: string[];
  values: Array<number | null>;
  previous: Array<number | null> | null;
} {
  return {
    days: series.current.points.map((point) => point.day),
    values: series.current.points.map((point) => point.value),
    previous: series.previous ? series.previous.points.map((point) => point.value) : null,
  };
}

export function executiveAnswers(input: {
  revenueStatus: string;
  demandStatus: string;
  conversionStatus: string;
  problems: Array<{ title: string }>;
  opportunitiesStatus: string;
  changes: Array<{ title: string; delta: number | null; delta_pct: number | null; status: string }>;
}): {
  how_are_we_doing: string;
  what_changed: string[];
  what_is_wrong: string[];
  what_works: string[];
  what_to_do_today: string[];
} {
  const how = [
    `Revenue ${input.revenueStatus}`,
    `Demand ${input.demandStatus}`,
    `Conversion ${input.conversionStatus}`,
  ].join(" · ");
  const what_changed = input.changes
    .filter((row) => row.status === "ok" || row.status === "zero" || row.status === "stale")
    .filter((row) => row.delta != null)
    .map((row) => {
      const pct = row.delta_pct == null ? "" : ` (${Math.round(row.delta_pct * 1000) / 10}%)`;
      const sign = (row.delta ?? 0) > 0 ? "+" : "";
      return `${row.title} ${sign}${row.delta}${pct} vs ventana anterior`;
    });
  const what_is_wrong = input.problems.map((row) => row.title);
  const what_works = [
    input.revenueStatus === "ok" ? "Revenue con observaciones reales" : null,
    input.demandStatus === "ok" ? "Demand (GA4/GSC) respondió" : null,
    input.conversionStatus === "ok" ? "Conversion calculada con sesiones y purchases" : null,
  ].filter((row): row is string => Boolean(row));
  const what_to_do_today =
    input.opportunitiesStatus === "not_joined"
      ? [...what_is_wrong, "Growth Engine todavía no está shipped — no hay acciones priorizadas"]
      : what_is_wrong;
  return {
    how_are_we_doing: how,
    what_changed: what_changed.length ? what_changed : ["Sin comparación: faltan observaciones en la ventana previa"],
    what_is_wrong: what_is_wrong.length ? what_is_wrong : ["Sin problemas observados"],
    what_works: what_works.length ? what_works : ["Ninguna fuente clave está ok todavía"],
    what_to_do_today: what_to_do_today.length ? what_to_do_today : ["Nada accionable con las fuentes actuales"],
  };
}

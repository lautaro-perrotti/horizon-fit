export const CHART_CATALOG = [
  { id: "revenue", title: "Revenue", kind: "line", metric: "revenue", source: "woo_rest_orders", definition: "Suma diaria de line totals de pedidos paid (processing / completed / on-hold)." },
  { id: "units", title: "Units", kind: "line", metric: "units", source: "woo_rest_orders", definition: "Unidades vendidas por día desde line items, agrupadas por parent SKU o tienda." },
  { id: "gsc_impressions", title: "GSC impressions", kind: "line", metric: "impressions", source: "gsc", definition: "Impresiones diarias de Search Console para horizonfit.com.ar." },
  { id: "gsc_clicks", title: "GSC clicks", kind: "line", metric: "clicks", source: "gsc", definition: "Clicks diarios de Search Console. Días sin fila quedan unknown, no cero." },
  { id: "gsc_ctr", title: "GSC CTR", kind: "line", metric: "ctr", source: "gsc", definition: "CTR diario reportado por Search Console. No se recalcula inventando clicks." },
  { id: "ga4_sessions", title: "GA4 sessions", kind: "line", metric: "sessions", source: "ga4", definition: "Sesiones diarias de la property GA4. Requiere ga4.sync." },
  { id: "ga4_funnel", title: "GA4 funnel", kind: "funnel", source: "ga4", definition: "Sesiones → usuarios → purchases del snapshot GA4 28d. Sin add_to_cart store-level no se inventa el medio." },
  { id: "stock_velocity", title: "Stock vs velocity", kind: "deferred", source: "not_joined", definition: "Necesita stock diario. Hoy no hay serie de inventario.", status: "not_joined", reason: "daily_stock_not_shipped" },
  { id: "price_history", title: "Price history", kind: "deferred", source: "not_joined", definition: "El catálogo Woo no guarda historial de precio en Control.", status: "not_joined", reason: "price_history_not_shipped" },
  { id: "competitor_price", title: "Competitor price history", kind: "deferred", source: "not_joined", definition: "Espera Competitor 360 (snapshots). No se inventa un índice.", status: "not_joined", reason: "competitor_snapshots_not_shipped" },
  { id: "category_performance", title: "Category performance", kind: "deferred", source: "not_joined", definition: "No hay rollup diario por categoría todavía.", status: "not_joined", reason: "category_rollup_not_shipped" },
];

export function executiveAnswers(input) {
  const how = [`Revenue ${input.revenueStatus}`, `Demand ${input.demandStatus}`, `Conversion ${input.conversionStatus}`].join(" · ");
  const what_changed = (input.changes ?? [])
    .filter((row) => row.status === "ok" || row.status === "zero" || row.status === "stale")
    .filter((row) => row.delta != null)
    .map((row) => {
      const pct = row.delta_pct == null ? "" : ` (${Math.round(row.delta_pct * 1000) / 10}%)`;
      const sign = (row.delta ?? 0) > 0 ? "+" : "";
      return `${row.title} ${sign}${row.delta}${pct} vs ventana anterior`;
    });
  const what_is_wrong = (input.problems ?? []).map((row) => row.title);
  const what_works = [
    input.revenueStatus === "ok" ? "Revenue con observaciones reales" : null,
    input.demandStatus === "ok" ? "Demand (GA4/GSC) respondió" : null,
    input.conversionStatus === "ok" ? "Conversion calculada con sesiones y purchases" : null,
  ].filter(Boolean);
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

const STATUS_CLASS = {
  ok: "ok",
  zero: "ok",
  stale: "warn",
  unknown: "warn",
  not_configured: "",
  not_joined: "",
  error: "bad",
  loading: "warn",
};

export function chartStateFromSeries(series, fallbackSource) {
  if (!series) {
    return { status: "unknown", reason: "missing_series", plottable: false, source: fallbackSource };
  }
  const status = series.current?.status || "unknown";
  return {
    status,
    reason: status === "unknown" ? "no_observation" : undefined,
    plottable: status === "ok" || status === "zero" || status === "stale",
    source: series.source,
    note: series.note,
  };
}

export function seriesToLine(series) {
  return {
    days: (series.current?.points ?? []).map((point) => point.day),
    values: (series.current?.points ?? []).map((point) => point.value),
    previous: series.previous ? series.previous.points.map((point) => point.value) : null,
  };
}

export function horizonLineOption(title, line, compare) {
  const series = [
    {
      name: title,
      type: "line",
      data: line.values,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 2, color: "#35006d" },
      itemStyle: { color: "#35006d" },
    },
  ];
  if (compare && line.previous) {
    series.push({
      name: "ventana anterior",
      type: "line",
      data: line.previous,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 1.5, type: "dashed", color: "rgba(53,0,109,0.35)" },
    });
  }
  return {
    animation: false,
    grid: { left: 36, right: 12, top: 16, bottom: 24 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: line.days, boundaryGap: false, axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "rgba(20,10,40,0.08)" } } },
    series,
  };
}

export function horizonFunnelOption(ga4) {
  const rows = [
    { name: "sessions", value: ga4?.sessions ?? null },
    { name: "users", value: ga4?.users ?? null },
    { name: "purchases", value: ga4?.purchases ?? null },
  ];
  return {
    animation: false,
    grid: { left: 72, right: 12, top: 16, bottom: 16 },
    tooltip: { trigger: "item" },
    xAxis: { type: "value" },
    yAxis: { type: "category", data: rows.map((row) => row.name), inverse: true },
    series: [
      {
        type: "bar",
        data: rows.map((row) => row.value),
        itemStyle: { color: "#35006d" },
      },
    ],
  };
}

export function renderHorizonChart(root, spec, payload, echarts) {
  const state = spec.status
    ? { status: spec.status, reason: spec.reason, plottable: false, source: spec.source }
    : spec.kind === "funnel"
      ? funnelState(payload)
      : chartStateFromSeries(payload, spec.source);
  const cls = STATUS_CLASS[state.status] || "";
  root.innerHTML = `
    <div class="card-head">
      <h2 class="title">${escapeHtml(spec.title)}</h2>
      <span class="slice-status ${cls}">${escapeHtml(state.status)}</span>
    </div>
    <div class="src">${escapeHtml(spec.definition)}</div>
    <div class="src">Source: ${escapeHtml(state.source)}${state.note ? ` · ${escapeHtml(state.note)}` : ""}</div>
    <div class="chart-host" data-chart-host></div>`;
  const host = root.querySelector("[data-chart-host]");
  if (!state.plottable || !echarts) {
    host.innerHTML = `<div class="empty-row"><span>${escapeHtml(state.status)}${state.reason ? ` · ${escapeHtml(state.reason)}` : ""}</span></div>`;
    return state;
  }
  const chart = echarts.init(host);
  if (spec.kind === "funnel") {
    chart.setOption(horizonFunnelOption(payload));
  } else {
    chart.setOption(horizonLineOption(spec.title, seriesToLine(payload), Boolean(payload?.previous)));
  }
  return state;
}

function funnelState(ga4) {
  if (!ga4) return { status: "unknown", reason: "missing_ga4_snapshot", plottable: false, source: "ga4" };
  if (!ga4.configured) return { status: "not_configured", reason: ga4.reason || "missing_google_credentials", plottable: false, source: "ga4" };
  if (!ga4.ok) return { status: "error", reason: ga4.reason || "ga4_error", plottable: false, source: "ga4" };
  if (ga4.sessions == null && ga4.purchases == null) {
    return { status: "unknown", reason: "ga4_funnel_incomplete", plottable: false, source: "ga4" };
  }
  return { status: "ok", plottable: true, source: "ga4" };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

import { html, raw } from "../core/html.js";
import { label, statusFromError } from "../core/slice.js";
import { num, toNumber } from "../core/format.js";

export const OPP_TYPES = {
  HIGH_TRAFFIC_LOW_CONVERSION: "Mucho tráfico, baja conversión",
  HIGH_IMPRESSIONS_LOW_CTR: "Muchas impresiones, CTR bajo",
  HIGH_IMPRESSIONS_LOW_CONVERSION: "Muchas impresiones, baja conversión",
  MERCHANT_BLOCKED_HIGH_VALUE: "Merchant bloquea un producto que vende",
  SEO_ISSUE_HIGH_DEMAND: "SEO roto con demanda",
  LOW_STOCK_HIGH_DEMAND: "Sin stock con demanda",
  HIGH_STOCK_LOW_VELOCITY: "Stock quieto",
  PRICE_OUTLIER: "Precio fuera de rango",
};

/** Mirrors GROWTH_WEIGHTS in src/adapters/growth-engine.ts. */
export const SCORE_COMPONENTS = [
  { id: "revenue_importance", label: "Importancia en ventas", weight: 0.22, missing: "Sin ventas en la ventana o sin máximo del set" },
  { id: "demand", label: "Demanda en Google", weight: 0.16, missing: "Sin impresiones de Search Console" },
  { id: "traffic", label: "Tráfico a la PDP", weight: 0.16, missing: "Sin vistas de GA4 para este SKU" },
  { id: "conversion_gap", label: "Brecha de conversión", weight: 0.18, missing: "Falta conversión o la mediana del set es 0" },
  { id: "stock_exposure", label: "Exposición de stock", weight: 0.1, missing: "Solo aplica sin stock" },
  { id: "merchant_exposure", label: "Exposición en Merchant", weight: 0.08, missing: "Solo aplica con variantes bloqueadas" },
  { id: "seo_opportunity", label: "Oportunidad SEO", weight: 0.05, missing: "Sin issues SEO o sin impresiones" },
  { id: "competitive_pressure", label: "Presión competitiva", weight: 0.05, missing: "Sin índice de precio (n < 2) o dentro de 0,8–1,2" },
];
const COMPONENT_COLORS = ["var(--act)", "var(--act-2)", "var(--join)", "var(--ok)", "var(--warn)", "var(--coral)", "var(--ink-3)", "var(--ink-4)"];

export const ALERT_RULES = [
  { id: "storefront_down", title: "Sitio caído", severity: "critical", closes: "cuando el storefront vuelva a responder 2xx" },
  { id: "seo_critical", title: "Críticos de SEO en el sitio", severity: "critical", closes: "cuando la auditoría dé 0 críticos" },
  { id: "competitor_down", title: "Competidor caído o bloqueado", severity: "warning", closes: "cuando todas las URLs respondan" },
  { id: "sku_out_of_stock", title: "SKU sin stock", severity: "warning", closes: "cuando la muestra de 10 vuelva a tener stock" },
  { id: "job_failed", title: "Job de infraestructura fallido", severity: "warning", closes: "cuando los últimos 20 jobs no tengan fallas" },
  { id: "refresh_stale_sales", title: "Sync de ventas vencido", severity: "warning", closes: "cuando el sync de ventas tenga menos de 6 h" },
  { id: "seo_warnings", title: "Más de 5 warnings de SEO", severity: "warning", closes: "con 5 warnings o menos" },
  { id: "seo_stale", title: "Auditoría SEO vieja", severity: "warning", closes: "con una auditoría de menos de 24 h" },
];

export const SEGMENTS = [
  { id: "champions", rule: "R, F y M en 4 o más" },
  { id: "loyal", rule: "F en 3 o más" },
  { id: "at_risk", rule: "R en 2 o menos y F en 3 o más" },
  { id: "new", rule: "1 pedido en los últimos 30 d" },
  { id: "dormant", rule: "R en 2 o menos" },
  { id: "one_time", rule: "1 pedido, hace más de 30 d" },
  { id: "regular", rule: "el resto" },
];

export const CONTENT_KINDS = [
  ["seo_title", "Title SEO"],
  ["seo_meta", "Meta description"],
  ["product_description", "Descripción de producto"],
  ["collection_copy", "Copy de colección"],
  ["ad_copy", "Copy de anuncio"],
  ["email_subject", "Asunto de email"],
  ["email_body", "Cuerpo de email"],
  ["instagram_caption", "Caption de Instagram"],
  ["creative_brief", "Brief creativo"],
  ["image_prompt", "Prompt de imagen"],
];

const COLOR_WORDS = [
  [/wine|bord/i, "#6B1E2E", "Bordó"],
  [/sky|celes/i, "#8EC5E8", "Celeste"],
  [/blue|azul/i, "#2F4FA8", "Azul"],
  [/green|verde/i, "#3D7A57", "Verde"],
  [/black|negr/i, "#121216", "Negro"],
  [/white|blanc/i, "#F3F1EC", "Blanco"],
  [/red|roj/i, "#B8322A", "Rojo"],
  [/pink|ros/i, "#EFA6C1", "Rosa"],
];

/** Color swatch from the product name or color attribute; null when it cannot be told. */
export function colorOf(text) {
  const hit = COLOR_WORDS.find(([re]) => re.test(String(text ?? "")));
  return hit ? { hex: hit[1], name: hit[2] } : null;
}

export function chip(status, text, title) {
  return html`<span class="chip" data-s="${status}" title="${title ?? status}">${text ?? label(status)}</span>`;
}

export function pip(value) {
  return html`<span class="pip" data-v="${value || "info"}"></span>`;
}

export function loading(lines = 3) {
  const widths = [72, 48, 88, 60, 80];
  return html`<div class="loading-block" aria-busy="true" aria-label="Cargando">${Array.from({ length: lines }, (_, i) =>
    html`<span class="sk" style="height: ${i === 0 ? 28 : 10}px; width: ${widths[i % widths.length]}%;"></span>`,
  )}</div>`;
}

/** Honest empty / unavailable block: what is missing, where it gets fixed, the reason id. */
export function empty({ status = "zero", title, body, reason, action, tone } = {}) {
  return html`<div class="empty ${tone ?? ""}">
    ${status ? chip(status) : ""}
    ${title ? html`<span class="t">${title}</span>` : ""}
    ${body ? html`<span class="b">${body}</span>` : ""}
    ${reason ? html`<span class="r">${reason}</span>` : ""}
    ${action ?? ""}
  </div>`;
}

const ENV_HINTS = {
  missing_woo_rest_credentials: "Cargá HORIZON_WOO_KEY y HORIZON_WOO_SECRET en /etc/horizon-control.env.",
  missing_google_credentials: "Falta la cuenta de servicio de Google (HORIZON_GOOGLE_SA_PATH).",
  missing_ga4_property_id: "Falta HORIZON_GA4_PROPERTY_ID.",
  missing_competitor_urls: "Agregá URLs en HORIZON_COMPETITOR_URLS (máximo 8).",
  missing_ai_provider_keys: "No hay keys de modelo: Consulta usa el modo determinístico.",
  diagnostics_unavailable: "Falta HORIZON_MERCHANT_DIAGNOSTICS_PATH o el archivo no existe.",
  missing_seo_report: "Todavía no hay reporte de auditoría SEO.",
  ads_adapter_not_configured: "No hay adapter de Ads instalado. Sin gasto, sin clics, sin ROAS.",
};

export function notConfigured(reason, what) {
  return empty({
    status: "not_configured",
    title: what ?? "Fuente sin configurar",
    body: ENV_HINTS[reason] ?? "La fuente no está conectada en el Control Plane. No se muestran datos de relleno.",
    reason,
  });
}

/** Error / 401 / 403 rendered as states, never as a stack trace. */
export function errorState(error, what = "este bloque") {
  const status = statusFromError(error);
  if (status === "session") {
    return empty({ status, title: "Tu sesión venció", body: "Entrá de nuevo; volvés a esta misma vista.", reason: "401 · invalid_token", tone: "solid" });
  }
  if (status === "scope") {
    return empty({
      status,
      title: "Vista previa",
      body: `El cliente del dashboard no tiene permiso para ${what}. Se habilita en Auth0, no en Control.`,
      reason: `403 · ${error?.code || "insufficient_scope"}`,
      tone: "solid",
    });
  }
  return empty({
    status: "error",
    title: `No se pudo leer ${what}`,
    body: "Control respondió con error. Se reintenta en la próxima carga.",
    reason: error?.message || "error",
    tone: "solid",
  });
}

export function bar(ratio, color) {
  const n = Math.max(0, Math.min(1, toNumber(ratio) ?? 0));
  return html`<span class="bar"><i style="width: ${(n * 100).toFixed(1)}%;${color ? ` background: ${color};` : ""}"></i></span>`;
}

/** Inline SVG sparkline. Nulls break the line instead of dropping to zero. */
export function spark(values, { color = "var(--act)", height = 48, dashed } = {}) {
  const nums = values.map((v) => toNumber(v));
  const finite = nums.filter((v) => v != null);
  if (finite.length < 2) return html`<span class="muted small">Sin serie suficiente todavía.</span>`;
  const max = Math.max(...finite);
  const min = Math.min(0, ...finite);
  const span = max - min || 1;
  const w = 280;
  const step = w / Math.max(1, nums.length - 1);
  const segments = [];
  let current = [];
  nums.forEach((v, i) => {
    if (v == null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push(`${(i * step).toFixed(1)},${(height - 4 - ((v - min) / span) * (height - 8)).toFixed(1)}`);
  });
  if (current.length) segments.push(current);
  return html`<svg class="spark" viewBox="0 0 ${w} ${height}" preserveAspectRatio="none" style="height: ${height}px" aria-hidden="true">${segments.map(
    (points) =>
      html`<polyline points="${points.join(" ")}" style="fill: none; stroke: ${color}; stroke-width: 2;${dashed ? " stroke-dasharray: 3 3;" : ""}" vector-effect="non-scaling-stroke"></polyline>`,
  )}</svg>`;
}

export function scoreBreakdown(row) {
  const components = row.components ?? {};
  const weights = row.weights_used ?? {};
  const used = SCORE_COMPONENTS.filter((c) => components[c.id] != null);
  const parts = used.map((c, i) => ({
    ...c,
    value: Number(components[c.id]),
    used: Number(weights[c.id] ?? 0),
    contribution: Number(components[c.id]) * Number(weights[c.id] ?? 0),
    color: COMPONENT_COLORS[i % COMPONENT_COLORS.length],
  }));
  const fmt = (n, d = 2) => num(n, d);
  return html`
    <div class="stack">
      <div class="stack-bar" role="img" aria-label="Aportes al score">${parts.map(
        (p) => html`<span title="${p.id} ${fmt(p.contribution, 1)}" style="width: ${p.contribution.toFixed(1)}%; background: ${p.color};"></span>`,
      )}</div>
      <div class="legend">
        ${parts.map((p) => html`<span><span class="sw" style="background: ${p.color};"></span>${p.id} ${fmt(p.contribution, 1)}</span>`)}
        ${SCORE_COMPONENTS.length - parts.length
          ? html`<span><span class="sw hatch"></span>${SCORE_COMPONENTS.length - parts.length} fuera del cálculo</span>`
          : ""}
      </div>
    </div>
    <div class="rows flush" role="table" aria-label="Componentes del score" style="--cols: minmax(0, 1.3fr) 56px 64px 52px 60px minmax(0, 1.6fr);">
      <div class="rows-head" role="row"><span>Componente</span><span class="n">Base</span><span class="n">Usado</span><span class="n">Valor</span><span class="n">Aporte</span><span>Por qué</span></div>
      ${SCORE_COMPONENTS.map((c) => {
        const p = parts.find((row) => row.id === c.id);
        return html`<div class="rows-row" role="row" style="${p ? "" : "opacity: 0.6;"}">
          <span class="stack" style="gap: 0;"><span class="strong">${c.label}</span><span class="mono xs muted">${c.id}</span></span>
          <span class="n">${fmt(c.weight)}</span>
          <span class="n strong">${p ? fmt(p.used) : "—"}</span>
          <span class="n">${p ? num(p.value) : "—"}</span>
          <span class="n strong">${p ? fmt(p.contribution, 1) : "—"}</span>
          <span class="small muted">${p ? "Entra al cálculo" : c.missing}</span>
        </div>`;
      })}
    </div>`;
}

export function oppTypeLabel(type) {
  return OPP_TYPES[type] ?? type;
}

export function sevOf(row) {
  return row?.severity || (Number(row?.score) >= 40 ? "warning" : "info");
}

export function icon(path, size = 18) {
  return html`<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}

export const ISOTIPO = raw(
  `<svg aria-hidden="true" viewBox="0 0 190.96 65.91" width="36" height="13" fill="currentColor"><path d="M83.31,49.36c7.57,6.4,15.95,9.52,25.44,11.17-13.64,2.96-26.19-1.57-36.18-10.2l-22.48-19.4c-5.67-4.9-12.08-8.68-19.63-9.57-8.95-1.05-17.2,2.66-21.07,10.18s-3.12,16.79,3.22,22.89c4.25,4.09,9.97,6.14,15.35,4.94,5.26-1.17,10.36-4.8,11.93-10.37,1.72-6.07-.87-11.68-5.28-14.37-5.79-3.53-11.7-1.59-16.34,3.150,2.34-5.79,9.13-8.85,14.49-7.81,6.08,1.18,10.59,5.64,12.28,11.88,1.85,6.84-.67,13.97-5.66,18.44-5.25,4.69-12.54,6.9-20.05,4.89C6.74,61.79-1.18,49.02.14,35.83,1.98,17.47,16.81,4.12,35.28,2.84c24.62-1.71,44.63,17.08,61.77,32.22,15.12,13.35,27.63,23.87,48.62,24.27C94.1,77.46,73.04,7.84,30.33,15.22c10.39,1.43,19.42,5.76,27.31,12.43l25.67,21.72Z"/><path d="M190.96,27.37c-11.21,24.41-38.71,34.26-63.47,22.85C97.33,36.31,79.86,3.71,43.95.61c15.85-2.41,31.04,2.49,43.94,11.77l30.8,22.15c24.91,16.98,50.7,15.77,72.26-7.16Z"/><path d="M167.63,34.74c.58-.23,1.16-.47,1.75-.72,1.59-.69,4.03-1.95,5.34-3.11-.71.62-1.88,2.05-2.61,2.6-.81.62-1.65,1.2-2.52,1.74-1.66,1.04-3.41,1.93-5.23,2.65-3.49,1.39-7.21,2.13-10.96,2.28s-7.55-.32-11.21-1.22-7.43-2.33-10.91-4.05c-2.48-1.23-4.88-2.63-7.18-4.18l-25.69-17.21c-7.75-5.19-15.59-8.52-24.26-11.49,26.76,1.48,49.61,34.78,76.46,20.98-5.31,6.35-13.05,6.63-21.91,6.68.14,0,.47.3.59.38.23.15.47.3.7.44.45.28.91.55,1.37.81.91.52,1.84,1.01,2.79,1.47,1.87.91,3.8,1.69,5.78,2.34,3.92,1.28,8.01,2.01,12.14,2.13s8.42-.39,12.48-1.5c1.07-.29,2.08-.64,3.09-1.03Z"/></svg>`,
);

// Oportunidades: deterministic rules with a visible score. Facts, never a price to set.
import { html, mount } from "../core/html.js";
import { api, attempt, clearCache } from "../core/api.js";
import { ago, dateTime, num } from "../core/format.js";
import { CONTENT_KINDS, OPP_TYPES, chip, empty, errorState, loading, oppTypeLabel, pip, scoreBreakdown, sevOf } from "../ui/components.js";
import { toast } from "../core/kit.js";

export const crumb = (params) => (params.id ? "Oportunidades · detalle" : "Oportunidades");

const STATUSES = [
  ["open", "Abiertas"],
  ["snoozed", "Snoozed"],
  ["dismissed", "Descartadas"],
  ["done", "Hechas"],
];
const KIND_FOR_TYPE = {
  HIGH_TRAFFIC_LOW_CONVERSION: "product_description",
  HIGH_IMPRESSIONS_LOW_CTR: "seo_title",
  HIGH_IMPRESSIONS_LOW_CONVERSION: "product_description",
  SEO_ISSUE_HIGH_DEMAND: "seo_meta",
  MERCHANT_BLOCKED_HIGH_VALUE: "creative_brief",
  LOW_STOCK_HIGH_DEMAND: "email_subject",
  HIGH_STOCK_LOW_VELOCITY: "instagram_caption",
  PRICE_OUTLIER: "creative_brief",
};

function caption(text) {
  const match = /score uses ([^;]+);/.exec(text ?? "");
  if (!match) return text ? "El score no tiene componentes con dato." : "";
  return `El score usa ${match[1].split("+").join(" + ")}. Lo que no tiene dato sale del cálculo y los pesos se renormalizan para sumar 1,00. Nada se completa con supuestos.`;
}

function statusChip(row) {
  if (row.status === "snoozed") return chip("stale", `snoozed hasta ${dateTime(row.snoozed_until)}`);
  if (row.status === "dismissed") return chip("zero", "descartada");
  if (row.status === "done") return chip("ok", "hecha");
  return "";
}

function detail(row, can) {
  const metrics = Object.entries(row.metrics ?? {}).filter(([, v]) => v != null && typeof v !== "object");
  const kind = KIND_FOR_TYPE[row.type] ?? "seo_meta";
  return html`
    <header class="stack" style="gap: 8px;">
      <div class="row wrap">
        ${pip(sevOf(row))}
        <h2 style="font-size: 20px; font-weight: 700;">${oppTypeLabel(row.type)}</h2>
        <span class="mono xs muted">${row.type}</span>
        ${statusChip(row)}
      </div>
      <p class="small soft"><span class="mono muted">${row.parent_sku}</span> · ${row.product} · fuente ${row.source} · ${row.period} · detectada ${ago(row.detected_at)}</p>
    </header>
    <div style="display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 24px; align-items: center;">
      <div class="stack" style="gap: 4px;">
        <span class="lbl">Score</span>
        <span class="row" style="align-items: baseline; gap: 6px;"><span class="disp" style="font-size: 76px;">${num(row.score)}</span><span class="muted">/ 100</span></span>
        <span class="small strong" style="color: ${row.severity === "critical" ? "var(--bad)" : row.severity === "warning" ? "var(--warn)" : "var(--ink-3)"};">${row.severity}</span>
      </div>
      <div class="xs muted">${caption(row.score_caption)}</div>
    </div>
    ${scoreBreakdown(row)}
    <div class="grid-auto" style="--min: 240px; gap: 14px;">
      <div class="well stack" style="gap: 8px;">
        <span class="lbl">Evidencia de la regla</span>
        ${(row.evidence ?? []).map((line) => html`<span class="mono small">${line}</span>`)}
        ${metrics.length ? html`<span class="xs muted">${metrics.map(([k, v]) => `${k} ${typeof v === "number" ? num(v, Number.isInteger(v) ? 0 : 3) : v}`).join(" · ")}</span>` : ""}
      </div>
      <div class="well stack" style="gap: 8px;">
        <span class="lbl">Acción que propone la regla</span>
        <span style="font-size: 14px; font-weight: 600;">${row.recommended_action || "—"}</span>
        ${row.type === "PRICE_OUTLIER" ? html`<span class="xs muted">Describe dónde está el precio contra el segmento. No es una sugerencia de precio.</span>` : ""}
      </div>
    </div>
    <div class="row wrap" style="gap: 8px;">
      <a class="btn btn-act" href="#/producto/${encodeURIComponent(row.parent_sku)}">Abrir Product 360</a>
      ${can("content.generate")
        ? html`<span class="row" style="gap: 6px;">
            <label class="sr" for="opp-kind">Tipo de borrador</label>
            <select id="opp-kind" class="field" style="height: 32px;">${CONTENT_KINDS.map(([id, text]) => html`<option value="${id}" ${id === kind ? "selected" : ""}>${text}</option>`)}</select>
            <button type="button" class="btn" data-act="generate">Generar borrador</button>
          </span>`
        : ""}
    </div>
    ${can("growth.update_opportunity")
      ? html`<div class="row wrap" style="gap: 8px;">
          <label class="inline">Snooze
            <select class="field" id="snooze-days" style="height: 32px;"><option value="7">7 días</option><option value="14">14 días</option><option value="30">30 días</option><option value="90">90 días</option></select>
          </label>
          <button type="button" class="btn" data-act="snooze">Snooze</button>
          <button type="button" class="btn" data-act="done">Marcar hecha</button>
          <button type="button" class="btn btn-ghost" data-act="dismiss">Descartar</button>
        </div>
        <form class="stack" style="gap: 8px;" data-act="note-form">
          <label for="opp-note" class="lbl">Nota</label>
          <div class="row"><input id="opp-note" class="field" style="flex: 1;" maxlength="500" placeholder="Qué revisaste o decidiste (máx. 500)"><button type="submit" class="btn">Guardar nota</button></div>
          <span class="xs muted">Las notas se guardan en Control; todavía no hay endpoint para listarlas.</span>
        </form>`
      : ""}`;
}

export async function render(ctx) {
  const status = STATUSES.some(([id]) => id === ctx.query.s) ? ctx.query.s : "open";
  const typeFilter = OPP_TYPES[ctx.query.t] ? ctx.query.t : "";
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div><h1 class="disp">Oportunidades</h1><p>Reglas determinísticas con score visible. Cada fila dice qué pasa y con qué dato, nunca qué precio poner.</p></div>
      </section>
      <section class="row wrap" style="gap: 12px;">
        <div class="seg" role="group" aria-label="Estado">
          ${STATUSES.map(([id, text]) => html`<button type="button" data-status="${id}" aria-pressed="${id === status}">${text}</button>`)}
        </div>
        <span aria-hidden="true" style="width: 1px; height: 22px; background: var(--line);"></span>
        <div class="row wrap" style="gap: 6px;" data-slot="types"></div>
      </section>
      <section class="grid-auto" style="--min: 440px;">
        <article class="panel" aria-label="Lista" style="padding: 6px 0;" data-slot="list">${loading(6)}</article>
        <article class="panel pad stack" style="gap: 20px; padding: 22px 24px;" aria-label="Detalle" data-slot="detail">${loading(6)}</article>
      </section>`,
  );

  ctx.on("click", "[data-status]", (_, t) => ctx.nav.setQuery({ s: t.dataset.status === "open" ? undefined : t.dataset.status }, { replace: false }));
  ctx.on("click", "[data-type]", (_, t) => ctx.nav.setQuery({ t: t.dataset.type || undefined }));

  const list = await attempt(`/v1/growth/opportunities?status=${status}`);
  if (!ctx.alive()) return;
  if (!list.ok) {
    mount(ctx.slot("list"), html`<div class="pad">${errorState(list.error, "las oportunidades")}</div>`);
    mount(ctx.slot("detail"), "");
    return;
  }
  const all = [...(list.data.opportunities ?? [])].sort((a, b) => Number(b.score) - Number(a.score));
  const counts = Object.fromEntries(Object.keys(OPP_TYPES).map((type) => [type, all.filter((row) => row.type === type).length]));
  mount(
    ctx.slot("types"),
    html`<button type="button" class="btn btn-sm" data-type="" style="${typeFilter ? "" : "background: var(--sel);"}">Todas <span class="muted">${num(all.length)}</span></button>
      ${Object.keys(OPP_TYPES).map(
        (type) => html`<button type="button" class="btn btn-sm" data-type="${type}" title="${oppTypeLabel(type)}" style="${type === typeFilter ? "background: var(--sel);" : counts[type] ? "" : "opacity: 0.5;"}"><span class="mono" style="font-size: 10.5px;">${type}</span><span class="muted">${num(counts[type])}</span></button>`,
      )}`,
  );
  const rows = typeFilter ? all.filter((row) => row.type === typeFilter) : all;
  const selectedId = ctx.params.id ?? rows[0]?.id;

  if (!rows.length) {
    mount(
      ctx.slot("list"),
      html`<div class="pad">${empty({ status: "zero", title: `Sin oportunidades ${STATUSES.find(([id]) => id === status)[1].toLowerCase()}`, body: "Las reglas no emiten filas si falta el dato que necesitan; el score no completa componentes que faltan." })}</div>`,
    );
  } else {
    mount(
      ctx.slot("list"),
      html`<div class="rows" style="--cols: 14px minmax(0, 1fr) minmax(0, 0.9fr) 44px;">
        <div class="rows-head"><span></span><span>Producto</span><span>Regla</span><span class="n">Score</span></div>
        ${rows.map(
          (row) => html`<a class="rows-row" href="#/oportunidades/${encodeURIComponent(row.id)}${status !== "open" ? `?s=${status}` : ""}" aria-current="${row.id === selectedId}">
            ${pip(sevOf(row))}
            <span class="stack" style="gap: 0; min-width: 0;"><span class="mono xs muted">${row.parent_sku}</span><span class="ellipsis" style="font-weight: 550;">${row.product}</span></span>
            <span class="mono xs soft ellipsis" title="${oppTypeLabel(row.type)}">${row.type}</span>
            <span class="n" style="font-size: 15px; font-weight: 700;">${num(row.score)}</span>
          </a>`,
        )}
      </div>`,
    );
  }

  let current = all.find((row) => row.id === selectedId) ?? null;
  if (!current && ctx.params.id) {
    const one = await attempt(`/v1/growth/opportunities/${encodeURIComponent(ctx.params.id)}`);
    if (!ctx.alive()) return;
    if (one.ok) current = one.data;
    else return mount(ctx.slot("detail"), errorState(one.error, "esta oportunidad"));
  }
  if (!current) {
    mount(ctx.slot("detail"), html`<p class="small muted">Elegí una oportunidad. Cada componente del score y su peso quedan a la vista.</p>`);
    return;
  }
  ctx.setCrumb(`Oportunidades · ${current.parent_sku}`);
  mount(ctx.slot("detail"), detail(current, ctx.can));

  async function update(body, okText) {
    try {
      await api(`/v1/growth/opportunities/${encodeURIComponent(current.id)}`, { method: "POST", body, invalidate: "/v1/growth" });
      toast(okText);
      clearCache("/v1/insights");
      ctx.refreshBadges();
      if (body.action === "note") return;
      const target = `#/oportunidades${status === "open" ? "" : `?s=${status}`}`;
      if (location.hash === target) window.dispatchEvent(new HashChangeEvent("hashchange"));
      else location.hash = target;
    } catch (error) {
      toast(`No se pudo actualizar: ${error.message}`);
    }
  }
  ctx.on("click", '[data-act="snooze"]', () => {
    const days = Number(ctx.root.querySelector("#snooze-days")?.value || 7);
    void update({ action: "snooze", snooze_days: days }, `Snooze por ${days} días.`);
  });
  ctx.on("click", '[data-act="done"]', () => void update({ action: "done" }, "Marcada como hecha."));
  ctx.on("click", '[data-act="dismiss"]', () => {
    if (confirm("¿Descartar esta oportunidad? El motor no la vuelve a abrir.")) void update({ action: "dismiss" }, "Descartada.");
  });
  ctx.on("submit", '[data-act="note-form"]', (event) => {
    event.preventDefault();
    const input = ctx.root.querySelector("#opp-note");
    const note = input?.value.trim();
    if (!note) return;
    input.value = "";
    void update({ action: "note", note }, "Nota guardada.");
  });
  ctx.on("click", '[data-act="generate"]', async (_, target) => {
    target.disabled = true;
    try {
      const kind = ctx.root.querySelector("#opp-kind")?.value || "seo_meta";
      const draft = await api("/v1/content/generate", { method: "POST", body: { kind, parent_sku: current.parent_sku, opportunity_id: current.id }, invalidate: "/v1/content" });
      location.hash = `#/contenido/${encodeURIComponent(draft.id)}`;
    } catch (error) {
      toast(`No se pudo generar: ${error.message}`);
      target.disabled = false;
    }
  });
}

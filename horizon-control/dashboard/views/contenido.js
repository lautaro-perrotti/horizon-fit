// Contenido: drafts anchored to a SKU and its evidence. Control never publishes to the storefront.
import { html, mount } from "../core/html.js";
import { api, attempt } from "../core/api.js";
import { ago, num } from "../core/format.js";
import { CONTENT_KINDS, chip, empty, errorState, loading } from "../ui/components.js";
import { copyText, toast } from "../core/kit.js";

export const crumb = (params) => (params.id ? "Contenido · borrador" : "Contenido");

const STATUSES = [
  ["", "Todos"],
  ["draft", "draft"],
  ["approved", "approved"],
  ["published-externally", "published-externally"],
];
const KIND_LABEL = Object.fromEntries(CONTENT_KINDS);

function statusChip(status) {
  return chip(status === "approved" ? "ok" : status === "draft" ? "zero" : "unknown", status);
}

function stepper(status) {
  const order = ["draft", "approved", "published-externally"];
  const at = order.indexOf(status);
  const notes = ["generado", "vos lo aprobás", "lo pegaste en wp-admin"];
  return html`<ol aria-label="Estado del borrador" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; gap: 4px;">
    ${order.map(
      (step, i) => html`<li style="display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 3px solid ${i <= at ? "var(--act)" : "var(--s3)"};">
        <span class="small" style="font-weight: ${i === at ? 700 : 600}; color: ${i <= at ? "var(--ink)" : "var(--ink-3)"};">${step}</span>
        <span class="xs muted">${notes[i]}</span>
      </li>`,
    )}
  </ol>`;
}

function detail(row, can) {
  const context = row.source_context ?? {};
  const len = String(row.body ?? "").length;
  const ideal = row.kind === "seo_meta" ? " · ideal 90–165" : row.kind === "seo_title" ? " · ideal 20–65" : "";
  return html`
    <header class="stack" style="gap: 8px;">
      <div class="row wrap"><h2 style="font-size: 20px; font-weight: 700;">${KIND_LABEL[row.kind] ?? row.kind}</h2><span class="mono xs muted">${row.kind}${row.parent_sku ? ` · ${row.parent_sku}` : ""}</span>${statusChip(row.status)}</div>
      <p class="small muted">${row.prompt_version ?? "content.v1"} · ${row.model ? `modelo ${row.model}` : "sin modelo: armado con la evidencia del 360"}${row.opportunity_id ? " · desde una oportunidad" : ""} · ${ago(row.created_at)}</p>
    </header>
    ${stepper(row.status)}
    <div class="stack" style="gap: 8px;">
      <div class="row spread"><span class="lbl">Texto</span><span class="xs muted">${num(len)} caracteres${ideal}</span></div>
      <div style="padding: 16px 18px; border-radius: 8px; background: var(--bg); border: 1px solid var(--line); font-size: 15px; line-height: 1.55; white-space: pre-wrap;">${row.body}</div>
    </div>
    <div class="stack" style="gap: 8px;">
      <span class="lbl">Con qué se armó</span>
      <div class="row wrap" style="gap: 6px;">
        ${["catalog_status", "search_status", "seo_status"].map((key) => (context[key] ? chip(context[key], key.replace("_status", "")) : ""))}
        ${(context.queries ?? []).length ? chip("ok", `${context.queries.length} queries`) : ""}
        ${context.opportunity ? chip("ok", context.opportunity.type) : ""}
      </div>
      ${row.notes ? html`<pre class="raw" style="max-height: 120px;">${row.notes}</pre>` : ""}
    </div>
    <div class="row wrap" style="gap: 8px;">
      ${can("content.update_draft")
        ? html`<button type="button" class="btn btn-act" data-act="approve" ${row.status === "draft" ? "" : "disabled"}>Aprobar</button>
            <button type="button" class="btn" data-act="published-externally" ${row.status === "approved" ? "" : "disabled"}>Marcar publicado afuera</button>`
        : ""}
      <button type="button" class="btn" data-act="copy">Copiar texto</button>
      ${row.parent_sku ? html`<a class="btn btn-ghost" href="#/producto/${encodeURIComponent(row.parent_sku)}">Abrir Product 360</a>` : ""}
    </div>
    ${can("content.update_draft")
      ? html`<form class="row" style="gap: 8px;" data-act="note-form"><label class="sr" for="draft-note">Nota</label><input id="draft-note" class="field" style="flex: 1;" maxlength="500" placeholder="Nota para el historial del borrador"><button type="submit" class="btn">Agregar nota</button></form>`
      : ""}
    <p class="xs muted">Control nunca publica en horizonfit.com.ar. Lo aprobado se copia a mano en wp-admin.</p>`;
}

export async function render(ctx) {
  const status = STATUSES.some(([id]) => id === ctx.query.s) ? ctx.query.s : "";
  const prefill = ctx.query.sku ?? "";
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div><h1 class="disp">Contenido</h1><p>Borradores anclados a un SKU y a su evidencia. Control nunca publica en la tienda: lo aprobado se copia a mano.</p></div>
        ${ctx.can("content.generate")
          ? html`<form class="panel row wrap" style="gap: 8px; padding: 10px;" data-act="generate">
              <label class="sr" for="gen-sku">SKU</label>
              <input id="gen-sku" class="field mono" style="width: 150px;" placeholder="004-TOP-BOR" value="${prefill}">
              <label class="sr" for="gen-kind">Tipo</label>
              <select id="gen-kind" class="field" style="width: 200px;">${CONTENT_KINDS.map(([id, text]) => html`<option value="${id}">${text}</option>`)}</select>
              <label class="inline"><input type="checkbox" id="gen-opp" checked> anclar a su oportunidad abierta</label>
              <button type="submit" class="btn btn-act">Generar borrador</button>
            </form>`
          : ""}
      </section>
      <section class="grid-auto" style="--min: 420px;">
        <article class="panel" style="padding: 6px 0;">
          <div class="row" style="padding: 10px 16px;">
            <div class="seg" role="group" aria-label="Estado">${STATUSES.map(([id, text]) => html`<button type="button" data-status="${id}" aria-pressed="${id === status}">${text}</button>`)}</div>
          </div>
          <div data-slot="list">${loading(5)}</div>
        </article>
        <article class="panel pad stack" style="gap: 18px; padding: 22px 24px;" data-slot="detail">${loading(5)}</article>
      </section>`,
  );

  ctx.on("click", "[data-status]", (_, t) => ctx.nav.setQuery({ s: t.dataset.status || undefined }));
  ctx.on("submit", '[data-act="generate"]', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('[type="submit"]');
    const sku = ctx.root.querySelector("#gen-sku").value.trim().toUpperCase();
    const kind = ctx.root.querySelector("#gen-kind").value;
    button.disabled = true;
    try {
      let opportunity_id;
      if (sku && ctx.root.querySelector("#gen-opp").checked) {
        const opps = await attempt("/v1/growth/opportunities?status=open");
        opportunity_id = opps.ok ? (opps.data.opportunities ?? []).filter((row) => row.parent_sku === sku).sort((a, b) => b.score - a.score)[0]?.id : undefined;
      }
      const draft = await api("/v1/content/generate", { method: "POST", body: { kind, parent_sku: sku || undefined, opportunity_id }, invalidate: "/v1/content" });
      location.hash = `#/contenido/${encodeURIComponent(draft.id)}`;
    } catch (error) {
      toast(`No se pudo generar: ${error.message}`);
      button.disabled = false;
    }
  });

  const list = await attempt(`/v1/content/drafts${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  if (!ctx.alive()) return;
  if (!list.ok) {
    mount(ctx.slot("list"), html`<div class="pad">${errorState(list.error, "los borradores")}</div>`);
    mount(ctx.slot("detail"), "");
    return;
  }
  const rows = list.data.drafts ?? [];
  const selectedId = ctx.params.id ?? rows[0]?.id;
  mount(
    ctx.slot("list"),
    rows.length
      ? rows.map(
          (row) => html`<a class="rows-row" href="#/contenido/${encodeURIComponent(row.id)}${status ? `?s=${status}` : ""}" aria-current="${row.id === selectedId}" style="--cols: minmax(0, 1fr) auto; row-gap: 6px;">
            <span class="row" style="gap: 8px; min-width: 0;"><span class="mono small">${row.kind}</span><span class="mono xs muted">${row.parent_sku ?? "—"}</span></span>
            ${statusChip(row.status)}
            <span class="small soft ellipsis" style="grid-column: 1 / -1;">${row.body}</span>
          </a>`,
        )
      : html`<div class="pad">${empty({ status: "zero", title: "Sin borradores", body: "Generá uno desde un SKU o desde una oportunidad." })}</div>`,
  );

  let row = rows.find((item) => item.id === selectedId) ?? null;
  if (!row && ctx.params.id) {
    const one = await attempt(`/v1/content/drafts/${encodeURIComponent(ctx.params.id)}`);
    if (!ctx.alive()) return;
    if (!one.ok) return mount(ctx.slot("detail"), errorState(one.error, "este borrador"));
    row = one.data;
  }
  if (!row) return mount(ctx.slot("detail"), html`<p class="small muted">Elegí o generá un borrador.</p>`);
  mount(ctx.slot("detail"), detail(row, ctx.can));

  async function update(body, okText) {
    try {
      await api(`/v1/content/drafts/${encodeURIComponent(row.id)}`, { method: "POST", body, invalidate: "/v1/content" });
      toast(okText);
      const target = `#/contenido/${encodeURIComponent(row.id)}${status ? `?s=${status}` : ""}`;
      if (location.hash === target) window.dispatchEvent(new HashChangeEvent("hashchange"));
      else location.hash = target;
    } catch (error) {
      toast(`No se pudo actualizar: ${error.message}`);
    }
  }
  ctx.on("click", '[data-act="approve"]', () => void update({ action: "approve" }, "Borrador aprobado."));
  ctx.on("click", '[data-act="published-externally"]', () => void update({ action: "published-externally" }, "Marcado como publicado afuera."));
  ctx.on("submit", '[data-act="note-form"]', (event) => {
    event.preventDefault();
    const input = ctx.root.querySelector("#draft-note");
    const note = input.value.trim();
    if (note) void update({ action: "note", note }, "Nota agregada.");
  });
  ctx.on("click", '[data-act="copy"]', async () => toast((await copyText(row.body ?? "")) ? "Texto copiado." : "No se pudo copiar; seleccioná el texto a mano."));
}

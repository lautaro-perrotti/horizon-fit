// Alertas: eight fixed rules. They open and close with the data; there is no manual resolve.
import { html, mount } from "../core/html.js";
import { api, attempt } from "../core/api.js";
import { ago, dateTime, num } from "../core/format.js";
import { ALERT_RULES, empty, errorState, loading, pip } from "../ui/components.js";
import { toast } from "../core/kit.js";

export const crumb = () => "Alertas";

const VIEW_FOR = {
  seo_critical: ["#/seo", "Abrir SEO"],
  seo_warnings: ["#/seo", "Abrir SEO"],
  seo_stale: ["#/seo", "Abrir SEO"],
  competitor_down: ["#/competencia", "Abrir Competencia"],
  storefront_down: ["#/sitio", "Abrir Sitio"],
  sku_out_of_stock: ["#/catalogo", "Abrir Catálogo"],
  job_failed: ["#/operaciones", "Abrir Operaciones"],
  refresh_stale_sales: ["#/operaciones", "Abrir Operaciones"],
};

export async function render(ctx) {
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div><h1 class="disp">Alertas</h1><p>Ocho reglas fijas. Se abren y se cierran solas según el dato; no hay botón para silenciarlas a mano.</p></div>
        <div class="row">
          <span class="small muted">El worker evalúa cada 60 s</span>
          ${ctx.can("alerts.evaluate") ? html`<button type="button" class="btn btn-act" data-act="evaluate">Evaluar ahora</button>` : ""}
        </div>
      </section>
      <section class="strip" data-slot="totals">${loading(1)}</section>
      <section class="grid-auto" style="--min: 460px;">
        <article class="panel" style="padding: 6px 0;" data-slot="list">${loading(6)}</article>
        <article class="panel pad stack" style="gap: 18px; padding: 22px 24px;" data-slot="detail">${loading(4)}</article>
      </section>`,
  );

  async function load(fresh) {
    const res = await attempt("/v1/alerts", { fresh });
    if (!ctx.alive()) return;
    if (!res.ok) {
      mount(ctx.slot("list"), html`<div class="pad">${errorState(res.error, "las alertas")}</div>`);
      mount(ctx.slot("totals"), "");
      mount(ctx.slot("detail"), "");
      return;
    }
    const byRule = new Map((res.data.alerts ?? []).map((row) => [row.rule_id, row]));
    const rules = ALERT_RULES.map((rule) => ({ rule, row: byRule.get(rule.id) ?? null }));
    const open = rules.filter((r) => r.row?.status === "open");
    const sorted = [...rules].sort((a, b) => rank(a) - rank(b));
    const selected = rules.find((r) => r.rule.id === ctx.query.r) ?? open[0] ?? sorted[0];
    mount(
      ctx.slot("totals"),
      html`<div><span class="lbl">Abiertas</span><span class="disp" style="font-size: 40px;">${num(open.length)}</span></div>
        <div><span class="lbl" style="color: var(--bad);">Críticas</span><span class="disp" style="font-size: 40px; color: var(--bad);">${num(open.filter((r) => r.row.severity === "critical").length)}</span></div>
        <div><span class="lbl" style="color: var(--warn);">Warning</span><span class="disp" style="font-size: 40px; color: var(--warn);">${num(open.filter((r) => r.row.severity !== "critical").length)}</span></div>
        <div><span class="lbl">Sin disparar nunca</span><span class="disp" style="font-size: 40px; color: var(--ink-3);">${num(rules.filter((r) => !r.row).length)}</span></div>`,
    );
    mount(
      ctx.slot("list"),
      html`<div class="rows" style="--cols: 14px minmax(0, 1fr) 100px 96px;">
        <div class="rows-head"><span></span><span>Regla</span><span>Estado</span><span class="n">Desde</span></div>
        ${sorted.map(({ rule, row }) => {
          const state = row ? (row.status === "open" ? "abierta" : "resuelta") : "sin disparar";
          const color = row?.status === "open" ? "var(--ink)" : row ? "var(--ok)" : "var(--ink-3)";
          return html`<a class="rows-row" href="#/alertas?r=${rule.id}" aria-current="${selected?.rule.id === rule.id}">
            ${pip(row?.status === "open" ? row.severity : row ? "ok" : "off")}
            <span class="stack" style="gap: 0; min-width: 0;"><span class="ellipsis" style="font-weight: 580;">${row?.title ?? rule.title}</span><span class="mono xs muted">${rule.id} · ${row?.severity ?? rule.severity}</span></span>
            <span class="small strong" style="color: ${color};">${state}</span>
            <span class="n small muted">${row ? ago(row.status === "open" ? row.opened_at : row.updated_at) : "—"}</span>
          </a>`;
        })}
      </div>`,
    );
    const { rule, row } = selected;
    const [href, cta] = VIEW_FOR[rule.id] ?? ["#/", "Abrir Hoy"];
    mount(
      ctx.slot("detail"),
      html`
        <header class="stack" style="gap: 8px;">
          <div class="row">${pip(row?.status === "open" ? row.severity : row ? "ok" : "off")}<h2 style="font-size: 20px; font-weight: 700;">${row?.title ?? rule.title}</h2></div>
          <p class="small soft"><span class="mono muted">${rule.id}</span> · ${row?.severity ?? rule.severity} · ${row ? (row.status === "open" ? `abierta ${ago(row.opened_at)}` : `resuelta · última vez ${dateTime(row.updated_at)}`) : "nunca se disparó"} · se cierra ${rule.closes}</p>
        </header>
        ${row
          ? html`<div class="stack" style="gap: 8px;"><span class="lbl">Payload</span><pre class="raw">${JSON.stringify(row.payload ?? {}, null, 2)}</pre></div>`
          : empty({ status: "zero", title: "Esta regla no tiene registro", body: "Todavía no se cumplió nunca la condición. Cuando pase, aparece acá con su payload." })}
        <div class="row wrap"><a class="btn btn-act" href="${href}">${cta}</a><button type="button" class="btn" data-ask="${`¿Qué pasa con la alerta ${rule.id}?`}">Preguntar a Consulta</button></div>
        <div class="rule"></div>
        <div class="stack small soft" style="gap: 6px;">
          <span class="lbl">Cómo se comporta</span>
          <span>Una fila por regla: si vuelve a dispararse se reabre la misma, no se duplica.</span>
          <span>Evaluar ahora también encola los syncs vencidos (ventas, GA4, GSC, competencia).</span>
        </div>`,
    );
  }

  function rank({ row, rule }) {
    if (row?.status === "open") return rule.severity === "critical" || row.severity === "critical" ? 0 : 1;
    return row ? 2 : 3;
  }

  ctx.on("click", '[data-act="evaluate"]', async (_, target) => {
    target.disabled = true;
    try {
      await api("/v1/alerts/evaluate", { method: "POST", body: {} });
      toast("Alertas evaluadas.");
      ctx.refreshBadges();
      await load(true);
    } catch (error) {
      toast(`No se pudo evaluar: ${error.message}`);
    } finally {
      target.disabled = false;
    }
  });
  ctx.on("click", "[data-ask]", (_, t) => ctx.consulta.ask(t.dataset.ask));
  await load(false);
}

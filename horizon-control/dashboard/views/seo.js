// SEO: on-page audit of the initial HTML (what Google reads before JS). Control measures; Fit fixes.
import { html, mount } from "../core/html.js";
import { api, attempt } from "../core/api.js";
import { ago, dateTime, hoursAgo, num } from "../core/format.js";
import { chip, empty, errorState, loading, pip, spark } from "../ui/components.js";
import { toast } from "../core/kit.js";

export const crumb = () => "SEO";

const BUSY = new Set(["queued", "running"]);

function jobLine(job, summary) {
  if (!job) return html`${chip("unknown", "sin job registrado")}`;
  const st = job.status === "succeeded" ? "ok" : job.status === "failed" ? "error" : BUSY.has(job.status) ? "loading" : "unknown";
  const text = { succeeded: "completo", failed: "falló", queued: "en cola", running: "corriendo", cancelled: "cancelado" }[job.status] ?? job.status;
  return html`${chip(st, text)}<span class="small muted push">${job.finishedAt ? `terminó ${ago(job.finishedAt)}` : `creado ${ago(job.createdAt)}`}${summary?.age_h != null ? ` · reporte ${hoursAgo(summary.age_h)}` : ""}</span>`;
}

function pageRow(page, open) {
  const crit = page.issues?.critical ?? [];
  const warn = page.issues?.warning ?? [];
  const path = String(page.url ?? "").replace(/^https?:\/\//, "");
  return html`<details class="page" ${open ? "open" : ""}>
    <summary class="rows-row" style="--cols: 22px minmax(0, 1.2fr) minmax(0, 1fr) 80px 80px; border-bottom: 0;">
      <span class="caret" aria-hidden="true">▸</span>
      <span class="mono small ellipsis">${path}</span>
      <span class="soft ellipsis">${page.title || "sin title"}</span>
      <span class="n strong" style="color: ${page.critical ? "var(--bad)" : "var(--ink-3)"};">${num(page.critical)}</span>
      <span class="n" style="color: ${page.warning ? "var(--warn)" : "var(--ink-3)"};">${num(page.warning)}</span>
    </summary>
    <div class="issues">
      ${crit.map((row) => html`<div class="issue">${pip("critical")}<span class="stack" style="gap: 2px;"><span class="strong">${row.message}</span>${row.evidence ? html`<span class="mono xs muted">${row.evidence}</span>` : ""}</span></div>`)}
      ${warn.map((row) => html`<div class="issue">${pip("warning")}<span class="stack" style="gap: 2px;"><span>${row.message}</span>${row.evidence ? html`<span class="mono xs muted">${row.evidence}</span>` : ""}</span></div>`)}
      ${!crit.length && !warn.length ? html`<span class="small muted">Sin issues en esta URL.</span>` : ""}
      ${page.description ? html`<span class="xs muted">Description ${num(page.description.length)} caracteres</span>` : ""}
      <a class="small strong" href="#/sitio?u=${encodeURIComponent(String(page.url ?? "").replace(/^https?:\/\/[^/]+/, "") || "/")}">Ver en Sitio →</a>
    </div>
  </details>`;
}

export async function render(ctx) {
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div><h1 class="disp">SEO on-page</h1><p>Auditoría del HTML inicial de cada URL del sitemap, el que lee Google antes de ejecutar JavaScript. Control mide; el arreglo va en Fit.</p></div>
        <div class="side">
          ${ctx.can("seo.audit") ? html`<button type="button" class="btn btn-act" data-act="audit">Auditar ahora</button>` : html`<span class="chip" data-s="scope">falta scope seo.audit</span>`}
          <span class="xs muted">Se bloquea mientras haya un job en cola o corriendo</span>
        </div>
      </section>
      <section class="grid-auto" style="--min: 420px;">
        <div class="strip" style="--min: 120px;" data-slot="totals">${loading(1)}</div>
        <div class="panel pad stack" style="gap: 10px;" data-slot="job">${loading(2)}</div>
      </section>
      <article class="panel" style="padding: 6px 0;" data-slot="pages">${loading(6)}</article>`,
  );

  let polling = null;
  ctx.cleanup(() => clearTimeout(polling));

  async function load(fresh) {
    const [latest, snaps] = await Promise.all([attempt("/v1/seo/audits/latest", { fresh }), attempt("/v1/metrics/snapshots?kpi=seo_critical&limit=20", { fresh })]);
    if (!ctx.alive()) return;
    if (!latest.ok) {
      mount(ctx.slot("totals"), "");
      mount(ctx.slot("job"), "");
      mount(ctx.slot("pages"), html`<div class="pad">${errorState(latest.error, "la auditoría SEO")}</div>`);
      return;
    }
    const data = latest.data;
    const job = data.job;
    const busy = job && BUSY.has(job.status);
    const button = ctx.root.querySelector('[data-act="audit"]');
    if (button) button.disabled = Boolean(busy);
    const values = snaps.ok ? (snaps.data.snapshots ?? []).map((row) => Number(row.value)).reverse() : [];
    mount(
      ctx.slot("job"),
      html`<div class="row"><span class="lbl">Último job</span>${jobLine(job, data.summary)}</div>
        ${job?.error ? html`<span class="mono xs bad-t">${job.error}</span>` : ""}
        <span class="small soft">El script sale con código 1 cuando hay críticos; Control toma el reporte escrito como resultado y reaudita cada 12 h.</span>
        <div class="row"><span class="lbl">Críticos por auditoría</span><span style="flex: 1;">${spark(values, { color: "var(--bad)", height: 36 })}</span></div>`,
    );
    if (data.configured === false) {
      mount(ctx.slot("totals"), "");
      mount(ctx.slot("pages"), html`<div class="pad">${empty({ status: "not_configured", title: "Todavía no hay auditoría", body: "Corré Auditar ahora o esperá el job programado. No se inventan issues.", reason: data.reason })}</div>`);
    } else {
      const s = data.summary;
      mount(
        ctx.slot("totals"),
        html`<div><span class="lbl" style="color: var(--bad);">Críticos</span><span class="disp" style="font-size: 60px; color: ${s.totals.critical ? "var(--bad)" : "var(--ink)"};">${num(s.totals.critical)}</span></div>
          <div><span class="lbl" style="color: var(--warn);">Warnings</span><span class="disp" style="font-size: 60px;">${num(s.totals.warning)}</span></div>
          <div><span class="lbl">URLs auditadas</span><span class="disp" style="font-size: 60px;">${num(s.auditedCount)}</span><span class="xs muted">${s.generatedAt ? dateTime(s.generatedAt) : ""}</span></div>`,
      );
      const pages = [...(s.pages ?? [])].sort((a, b) => b.critical - a.critical || b.warning - a.warning);
      mount(
        ctx.slot("pages"),
        pages.length
          ? html`<div class="rows-head" style="--cols: 22px minmax(0, 1.2fr) minmax(0, 1fr) 80px 80px;"><span></span><span>URL</span><span>Title</span><span class="n">Críticos</span><span class="n">Warnings</span></div>
              ${pages.map((page, i) => pageRow(page, i === 0 && page.critical > 0))}
              ${(s.auditedCount ?? 0) > pages.length ? html`<p class="small muted" style="padding: 12px 18px;">El resumen trae las ${num(pages.length)} URLs con más issues de ${num(s.auditedCount)} auditadas.</p>` : ""}`
          : html`<div class="pad">${empty({ status: "zero", title: "Sin URLs con issues", body: "La última auditoría no encontró problemas." })}</div>`,
      );
    }
    if (busy) polling = setTimeout(() => void load(true), 5000);
  }

  ctx.on("click", '[data-act="audit"]', async (_, target) => {
    target.disabled = true;
    try {
      const job = await api("/v1/seo/audit", { method: "POST", body: {}, invalidate: "/v1/seo" });
      toast(`Auditoría ${job.status === "queued" ? "en cola" : job.status}.`);
      await load(true);
    } catch (error) {
      toast(`No se pudo auditar: ${error.message}`);
      target.disabled = false;
    }
  });
  await load(false);
}

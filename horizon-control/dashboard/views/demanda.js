// Demanda: GA4 (who reaches the site) and Search Console (who sees it on Google) in one window.
import { html, mount } from "../core/html.js";
import { api, attempt } from "../core/api.js";
import { ago, day, decimal, delta, num, pct } from "../core/format.js";
import { bar, chip, empty, errorState, loading, notConfigured } from "../ui/components.js";
import { chartState, renderLine, seriesToLine } from "../ui/chart.js";

export const crumb = () => "Demanda";

const GA = [
  ["sessions", "Sesiones"],
  ["users", "Usuarios"],
  ["purchases", "Compras"],
];
const GS = [
  ["impressions", "Impresiones"],
  ["clicks", "Clics"],
  ["ctr", "CTR"],
  ["position", "Posición"],
];

function seriesUrl(metric, win) {
  return `/v1/metrics/series?metric=${metric}&range=${win.w}&compare=${win.cmp ? "previous" : "none"}`;
}

function deltaCell(res) {
  if (!res?.ok || res.data.delta == null || !res.data.previous) return "";
  const d = delta(res.data.delta, res.data.delta_pct);
  return html`<span class="${d.dir === "up" ? "up" : d.dir === "down" ? "down" : "muted"} small strong">${d.text}</span>`;
}

function chartPanel(ctx, slot, metric, label, win) {
  return ctx.fill(
    slot,
    () => api(seriesUrl(metric, win)),
    (data) => {
      const state = chartState(data);
      if (!state.plottable) return empty({ status: state.status, title: `Sin serie de ${label.toLowerCase()}`, body: "No hay observaciones sincronizadas en la ventana.", reason: state.reason });
      setTimeout(() => {
        if (!ctx.alive()) return;
        const host = ctx.slot(slot)?.querySelector("[data-chart-host]");
        ctx.cleanup(renderLine(host, { ...seriesToLine(data), label }, { compare: win.cmp, percent: metric === "ctr", digits: metric === "position" ? 1 : 0 }));
      }, 0);
      return html`<div class="chart" data-chart-host role="img" aria-label="${label} por día"></div>
        <span class="xs muted">${data.sync?.last_success_at ? `sincronizado ${ago(data.sync.last_success_at)}` : "sin sync registrado"}${data.previous ? " · línea punteada: ventana anterior" : ""}</span>`;
    },
    { what: "la serie" },
  );
}

export async function render(ctx) {
  const { win } = ctx;
  const ga = GA.some(([id]) => id === ctx.query.ga) ? ctx.query.ga : "sessions";
  const gs = GS.some(([id]) => id === ctx.query.gs) ? ctx.query.gs : "impressions";
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div><h1 class="disp">Demanda</h1><p>GA4 dice quién llega al sitio; Search Console, quién lo ve en Google. Totales de 28 d; series en la ventana elegida.</p></div>
        <div class="row"><a class="btn btn-ghost" href="https://analytics.google.com/" target="_blank" rel="noopener">Abrir GA4 ↗</a><a class="btn btn-ghost" href="https://search.google.com/search-console" target="_blank" rel="noopener">Abrir Search Console ↗</a></div>
      </section>
      <section class="strip" style="--min: 150px;" data-slot="totals">${loading(1)}</section>
      <section class="grid-auto" style="--min: 460px;">
        <article class="panel pad stack">
          <header class="panel-head"><h2>GA4</h2><div class="seg push" role="group" aria-label="Métrica GA4">${GA.map(([id, text]) => html`<button type="button" data-ga="${id}" aria-pressed="${id === ga}">${text}</button>`)}</div></header>
          <div data-slot="ga-chart">${loading()}</div>
        </article>
        <article class="panel pad stack">
          <header class="panel-head"><h2>Search Console</h2><div class="seg push" role="group" aria-label="Métrica GSC">${GS.map(([id, text]) => html`<button type="button" data-gs="${id}" aria-pressed="${id === gs}">${text}</button>`)}</div></header>
          <div data-slot="gs-chart">${loading()}</div>
        </article>
      </section>
      <section class="grid-auto" style="--min: 360px;">
        <article class="panel pad stack" style="gap: 0;" data-slot="channels">${loading(4)}</article>
        <article class="panel pad stack" style="gap: 0;" data-slot="queries">${loading(5)}</article>
        <article class="panel pad stack" style="gap: 10px;">
          <h2 style="font-size: 15px; font-weight: 650;">Páginas</h2>
          ${empty({ status: "not_joined", title: "Por URL vive en cada Product 360", body: "A nivel sitio Search Console se lee por consulta. El detalle por página se joinea por /producto/{slug}/ en el 360.", action: html`<a class="small strong" href="#/catalogo">Elegir un producto →</a>` })}
        </article>
      </section>`,
  );
  ctx.on("click", "[data-ga]", (_, t) => ctx.nav.setQuery({ ga: t.dataset.ga }));
  ctx.on("click", "[data-gs]", (_, t) => ctx.nav.setQuery({ gs: t.dataset.gs }));

  const [ga4, gsc, imp, clk, ses] = await Promise.all([
    attempt("/v1/analytics/ga4"),
    attempt("/v1/analytics/search-console"),
    attempt(seriesUrl("impressions", win)),
    attempt(seriesUrl("clicks", win)),
    attempt(seriesUrl("sessions", win)),
  ]);
  if (!ctx.alive()) return;
  const g = ga4.ok ? ga4.data : null;
  const s = gsc.ok ? gsc.data : null;
  const gOk = g && g.configured !== false && g.ok !== false;
  const sOk = s && s.configured !== false && s.ok !== false;
  const cell = (labelText, value, extra, status) =>
    html`<div><span class="lbl">${labelText}</span><span class="row" style="align-items: baseline; gap: 8px;"><span class="disp" style="font-size: 40px;">${value}</span>${extra}</span>${status}</div>`;
  mount(
    ctx.slot("totals"),
    html`
      ${cell("Sesiones · GA4", gOk ? num(g.sessions) : "—", deltaCell(ses), gOk ? html`<span class="xs muted">28 d</span>` : chip(g ? (g.configured === false ? "not_configured" : "error") : "error"))}
      ${cell("Usuarios · GA4", gOk ? num(g.users) : "—", "", html`<span class="xs muted">28 d</span>`)}
      ${cell("Compras · GA4", gOk ? num(g.purchases) : "—", "", html`<span class="xs muted">${gOk && g.sessions ? `conversión ${pct((g.purchases ?? 0) / g.sessions)}` : "28 d"}</span>`)}
      ${cell("Impresiones · GSC", sOk ? num(s.impressions) : "—", deltaCell(imp), sOk ? html`<span class="xs muted">${s.start_date ? `${day(s.start_date)} – ${day(s.end_date)}` : "28 d"}</span>` : chip(s ? (s.configured === false ? "not_configured" : "error") : "error"))}
      ${cell("Clics · GSC", sOk ? num(s.clicks) : "—", deltaCell(clk), html`<span class="xs muted">28 d</span>`)}
      ${cell("CTR · posición", sOk ? pct(s.ctr) : "—", sOk ? html`<span class="small muted">pos. ${decimal(s.position, 1)}</span>` : "", html`<span class="xs muted">promedio del sitio</span>`)}`,
  );

  void chartPanel(ctx, "ga-chart", ga, GA.find(([id]) => id === ga)[1], win);
  void chartPanel(ctx, "gs-chart", gs, GS.find(([id]) => id === gs)[1], win);

  // Canales
  if (!ga4.ok) mount(ctx.slot("channels"), errorState(ga4.error, "GA4"));
  else if (g.configured === false) mount(ctx.slot("channels"), notConfigured(g.reason, "GA4 sin configurar"));
  else if (g.ok === false) mount(ctx.slot("channels"), empty({ status: "error", title: "GA4 respondió error", reason: g.reason }));
  else {
    const channels = g.channels ?? [];
    const max = Math.max(1, ...channels.map((row) => Number(row.sessions) || 0));
    mount(
      ctx.slot("channels"),
      html`<header class="panel-head" style="padding-bottom: 10px;"><h2>Canales</h2><span class="small muted">GA4 · sesiones · 28 d</span></header>
        ${channels.length
          ? channels.map((row) => html`<div style="display: grid; grid-template-columns: 130px minmax(0, 1fr) 40px; gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--hair); font-size: 12.5px;"><span class="ellipsis">${row.channel}</span>${bar(row.sessions / max)}<span class="n strong">${num(row.sessions)}</span></div>`)
          : html`<p class="small muted">Sin canales en la ventana.</p>`}`,
    );
  }

  // Consultas
  if (!gsc.ok) mount(ctx.slot("queries"), errorState(gsc.error, "Search Console"));
  else if (s.configured === false) mount(ctx.slot("queries"), notConfigured(s.reason, "Search Console sin configurar"));
  else if (s.ok === false) mount(ctx.slot("queries"), empty({ status: "error", title: "Search Console respondió error", reason: s.reason }));
  else {
    const queries = s.queries ?? [];
    mount(
      ctx.slot("queries"),
      html`<header class="panel-head" style="padding-bottom: 10px;"><h2>Consultas</h2><span class="small muted">GSC · top ${num(queries.length)}</span></header>
        ${queries.length
          ? html`<div class="rows flush" style="--cols: minmax(0, 1fr) 40px 52px 52px 40px;">
              <div class="rows-head"><span>Consulta</span><span class="n">Clics</span><span class="n">Impr.</span><span class="n">CTR</span><span class="n">Pos.</span></div>
              ${queries.map((q) => html`<div class="rows-row" style="font-size: 12.5px;"><span class="ellipsis">${q.query}</span><span class="n">${num(q.clicks)}</span><span class="n">${num(q.impressions)}</span><span class="n soft">${pct(q.ctr)}</span><span class="n muted">${decimal(q.position, 1)}</span></div>`)}
            </div>`
          : html`<p class="small muted">Sin consultas en la ventana.</p>`}`,
    );
  }
}

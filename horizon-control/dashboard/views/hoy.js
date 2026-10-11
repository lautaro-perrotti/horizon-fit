// Hoy: the morning brief. Five answers, three signals, what to do, what is wrong, source freshness.
import { html, mount } from "../core/html.js";
import { api, attempt } from "../core/api.js";
import { ago, delta, longToday, money, num, pct, toNumber } from "../core/format.js";
import { chip, empty, errorState, loading, notConfigured, oppTypeLabel, pip, sevOf, spark, bar } from "../ui/components.js";
import { chartState, renderLine, seriesToLine } from "../ui/chart.js";
import { isAvailable, label } from "../core/slice.js";

export const crumb = () => "Hoy";

const METRICS = [
  ["revenue", "Ingresos"],
  ["units", "Unidades"],
  ["orders", "Pedidos"],
  ["sessions", "Sesiones"],
  ["users", "Usuarios"],
  ["clicks", "Clics"],
  ["impressions", "Impresiones"],
  ["ctr", "CTR"],
  ["position", "Posición"],
];
const CHANGE_METRICS = [
  ["sessions", "Sesiones GA4"],
  ["impressions", "Impresiones GSC"],
  ["clicks", "Clics GSC"],
  ["revenue", "Ingresos"],
];
const RULE_VIEW = {
  seo_critical: "#/seo",
  seo_warnings: "#/seo",
  seo_stale: "#/seo",
  competitor_down: "#/competencia",
  storefront_down: "#/operaciones",
  job_failed: "#/operaciones",
  refresh_stale_sales: "#/operaciones",
  sku_out_of_stock: "#/catalogo",
};

function series(metric, win, compare = true) {
  return api(`/v1/metrics/series?metric=${metric}&range=${win.w}&compare=${compare && win.cmp ? "previous" : "none"}`);
}

function windowLabel(range) {
  if (!range?.start) return "";
  const f = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "");
  return `${f(range.start)} – ${f(range.end)}`;
}

export async function render(ctx) {
  const { win } = ctx;
  const metric = METRICS.some(([id]) => id === ctx.query.m) ? ctx.query.m : "sessions";
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div class="stack" style="gap: 12px; max-width: 860px;">
          <div class="lbl" data-slot="when">${longToday()} · ${win.w}${win.cmp ? " contra la ventana anterior" : ""}</div>
          <h1 class="disp" style="font-size: 60px;" data-slot="headline"><span class="sk" style="display: block; height: 52px; width: 70%;"></span></h1>
          <p style="font-size: 15px; line-height: 1.5; color: var(--ink-2); max-width: 760px;" data-slot="subline"></p>
        </div>
        <div class="side" data-slot="sources-chips"></div>
      </section>
      <section class="panel brief" aria-label="Brief de la mañana" data-slot="brief">${loading(4)}</section>
      <section class="grid-auto" style="--min: 300px;">
        <article class="panel pad stack" data-slot="plata">${loading()}</article>
        <article class="panel pad stack" data-slot="demanda">${loading()}</article>
        <article class="panel pad stack" data-slot="conversion">${loading()}</article>
      </section>
      <section class="grid-auto" style="--min: 420px;">
        <article class="panel" style="padding: 8px 0 6px;">
          <header class="panel-head" style="padding: 12px 20px 10px;">
            <h2 class="lg">Hacer hoy</h2>
            <span class="small muted" data-slot="opps-count"></span>
            <a class="push small strong" href="#/oportunidades">Ver todas →</a>
          </header>
          <div data-slot="opps">${loading()}</div>
        </article>
        <div class="stack" style="gap: 16px;">
          <article class="panel pad stack" style="gap: 4px;">
            <header class="panel-head" style="padding-bottom: 8px;">
              <h2 class="lg">Está mal</h2>
              <span class="small muted" data-slot="alerts-count"></span>
              ${ctx.can("alerts.evaluate") ? html`<button type="button" class="btn btn-sm push" data-act="evaluate">Evaluar ahora</button>` : ""}
            </header>
            <div data-slot="alerts">${loading(2)}</div>
          </article>
          <article class="panel pad" style="padding-bottom: 10px;">
            <h2 class="lg" style="font-size: 16px; font-weight: 650; padding-bottom: 10px;">Fuentes</h2>
            <div data-slot="sources">${loading(4)}</div>
          </article>
        </div>
      </section>
      <section class="panel pad stack">
        <header class="panel-head">
          <h2 class="lg">Serie diaria</h2>
          <div class="seg" role="group" aria-label="Métrica">
            ${METRICS.map(([id, text]) => html`<button type="button" data-metric="${id}" aria-pressed="${id === metric}">${text}</button>`)}
          </div>
          <div class="legend push" data-slot="chart-legend"></div>
        </header>
        <div data-slot="chart">${loading()}</div>
      </section>`,
  );

  ctx.on("click", "[data-metric]", (_, target) => ctx.nav.setQuery({ m: target.dataset.metric }));
  ctx.on("click", '[data-act="evaluate"]', async (_, target) => {
    target.disabled = true;
    try {
      await api("/v1/alerts/evaluate", { method: "POST", body: {} });
      ctx.refreshBadges();
      await loadAlerts();
    } catch (error) {
      mount(ctx.slot("alerts"), errorState(error, "evaluar alertas"));
    } finally {
      target.disabled = false;
    }
  });

  const [overview, sales, opps, alerts, seo, merchant, competition, health, healthz, ...changes] = await Promise.all([
    attempt("/v1/insights/overview"),
    attempt("/v1/commerce/sales"),
    attempt("/v1/growth/opportunities?status=open"),
    attempt("/v1/alerts"),
    attempt("/v1/seo/audits/latest"),
    attempt("/v1/merchant/diagnostics"),
    attempt("/v1/competition"),
    attempt("/v1/health"),
    api("/healthz").catch(() => null),
    ...CHANGE_METRICS.map(([id]) => series(id, win).then((data) => ({ ok: true, data }), (error) => ({ ok: false, error }))),
  ]);
  if (!ctx.alive()) return;

  const ov = overview.ok ? overview.data : null;
  const demand = ov?.demand;
  const conversion = ov?.conversion;
  const revenue = ov?.revenue;
  const sessions = toNumber(demand?.data?.sessions);
  const purchases = toNumber(conversion?.data?.purchases);
  const ninety = sales.ok && sales.data.configured !== false ? sales.data.ninety : null;
  const month = sales.ok && sales.data.configured !== false ? sales.data.month : null;
  const openOpps = opps.ok ? [...(opps.data.opportunities ?? [])].sort((a, b) => Number(b.score) - Number(a.score)) : [];
  const openAlerts = alerts.ok ? (alerts.data.alerts ?? []).filter((row) => row.status === "open") : [];
  const seoCritical = seo.ok && seo.data.configured !== false ? toNumber(seo.data.summary?.totals?.critical) : null;
  const changeRows = CHANGE_METRICS.map(([id, text], i) => ({ id, text, res: changes[i] }))
    .filter((row) => row.res.ok && isAvailable({ status: row.res.data.current?.status }) && row.res.data.delta != null && row.res.data.previous);

  // Headline and subline: composed only from what the sources returned.
  const headline =
    sessions != null && purchases != null
      ? `${num(sessions)} sesiones, ${num(purchases)} compras.`
      : month && month.orders
        ? `${money(month.revenue)} en 30 días.`
        : "El brief de hoy.";
  mount(ctx.slot("headline"), headline);
  const facts = [];
  if (sales.ok && sales.data.configured === false) facts.push("Woo no está conectado: no hay ventas para leer.");
  else if (month && !month.orders) facts.push(`Sin pedidos pagos en 30 días${ninety?.orders ? ", aunque hubo ventas en los últimos 90" : ""}.`);
  else if (month) facts.push(`${num(month.orders)} pedidos pagos en 30 días.`);
  if (seoCritical) facts.push(`${num(seoCritical)} problemas críticos de SEO.`);
  if (openOpps.length) facts.push(`${num(openOpps.length)} oportunidades abiertas.`);
  mount(ctx.slot("subline"), facts.join(" "));

  const sliceChips = [
    ["Woo", revenue?.status ?? (sales.ok ? (sales.data.configured === false ? "not_configured" : "ok") : "error")],
    ["GA4", conversion?.status ?? "unknown"],
    ["Search Console", demand?.status ?? "unknown"],
    ["SEO", seo.ok ? (seo.data.configured === false ? "not_configured" : "ok") : "error"],
    ["Merchant", merchant.ok ? (merchant.data.source === "unavailable" ? "not_configured" : merchant.data.summary?.blocked ? "ok" : "zero") : "error"],
    ["IA", healthz?.integrations?.ai ? "ok" : "not_configured"],
  ];
  mount(
    ctx.slot("sources-chips"),
    html`<div class="row wrap" style="gap: 6px; justify-content: flex-end; max-width: 420px;">${sliceChips.map(([name, st]) => chip(st, name, `${name} · ${label(st)}`))}</div>
      <span class="small muted">${ov?.fetched_at ? `Brief armado ${ago(ov.fetched_at)}` : ""}</span>`,
  );

  // Brief band
  const top = openOpps[0];
  mount(
    ctx.slot("brief"),
    html`
      <section>
        <div class="lbl">1 · Cómo vamos</div>
        <div class="stack" style="gap: 7px;">
          <div class="line"><span class="muted">Plata 30 d</span><span>${month ? money(month.revenue, { orders: month.orders }) : sales.ok ? "sin Woo" : "—"}</span></div>
          <div class="line"><span class="muted">Sesiones</span><span class="strong">${num(sessions)}</span></div>
          <div class="line"><span class="muted">Usuarios</span><span class="strong">${num(demand?.data?.users)}</span></div>
          <div class="line"><span class="muted">Conversión</span><span class="strong">${conversion && isAvailable(conversion) ? pct(conversion.data?.cvr) : "—"}</span></div>
        </div>
      </section>
      <section>
        <div class="lbl">2 · Qué cambió</div>
        <div class="stack" style="gap: 7px;">
          ${changeRows.length
            ? changeRows.map((row) => {
                const d = delta(row.res.data.delta, row.res.data.delta_pct);
                return html`<div class="line"><span class="muted">${row.text}</span><span class="${d.dir === "up" ? "up" : d.dir === "down" ? "down" : "muted"} strong">${d.text}</span></div>`;
              })
            : html`<span class="small muted">Sin ventana anterior con datos para comparar.</span>`}
          ${changeRows[0] ? html`<span class="xs muted">contra ${windowLabel(changeRows[0].res.data.compare) || "la ventana anterior"}</span>` : ""}
        </div>
      </section>
      <section>
        <div class="lbl" style="color: var(--bad);">3 · Qué está mal</div>
        <div class="stack" style="gap: 8px;">
          ${openAlerts.slice(0, 3).map(
            (row) => html`<a class="item" href="${RULE_VIEW[row.rule_id] ?? "#/alertas"}">${pip(row.severity)}<span class="ellipsis">${row.title}</span></a>`,
          )}
          ${sessions && purchases === 0 ? html`<a class="item" href="#/oportunidades">${pip("critical")}0 compras con ${num(sessions)} sesiones</a>` : ""}
          ${!openAlerts.length && !(sessions && purchases === 0) ? html`<span class="small muted">Nada abierto.</span>` : ""}
        </div>
      </section>
      <section>
        <div class="lbl" style="color: var(--ok);">4 · Qué funciona</div>
        <div class="stack" style="gap: 8px;">
          ${health.ok && health.data.storefront?.ok && health.data.api?.ok ? html`<span class="item">${pip("ok")}Sitio y API en ${health.data.storefront.status}</span>` : ""}
          ${merchant.ok && merchant.data.source !== "unavailable" && !merchant.data.summary?.blocked
            ? html`<span class="item">${pip("ok")}${num(merchant.data.summary?.ready)} variantes listas en Merchant</span>`
            : ""}
          ${conversion?.status === "ok" && demand?.status === "ok" ? html`<span class="item">${pip("ok")}GA4 y Search Console conectados</span>` : ""}
          ${revenue?.status === "ok" ? html`<span class="item">${pip("ok")}Ventas observadas en 30 d</span>` : ""}
        </div>
      </section>
      <section class="today">
        <div class="lbl" style="color: var(--act);">5 · Qué hacer hoy</div>
        ${top
          ? html`<div class="stack" style="gap: 2px;">
                <span class="mono xs muted">${top.parent_sku}</span>
                <span style="font-size: 15px; font-weight: 650;">${top.product || top.parent_sku}</span>
                <span class="small soft">${oppTypeLabel(top.type)} · score ${num(top.score)}</span>
              </div>
              <a class="btn btn-act" href="#/oportunidades/${encodeURIComponent(top.id)}" style="align-self: flex-start;">Abrir oportunidad</a>`
          : html`<span class="small muted">${opps.ok ? "Ninguna oportunidad abierta." : "No se pudo leer el motor de oportunidades."}</span>`}
      </section>`,
  );

  // Plata
  if (!sales.ok) mount(ctx.slot("plata"), errorState(sales.error, "las ventas"));
  else if (sales.data.configured === false) mount(ctx.slot("plata"), html`<h2 class="lbl">Plata · 30 d</h2>${notConfigured(sales.data.reason, "Woo REST sin configurar")}`);
  else {
    const s = sales.data;
    const zero = !s.month?.orders;
    const last = (s.recent_orders ?? [])[0]?.date;
    mount(
      ctx.slot("plata"),
      html`
        <header class="panel-head spread"><h2 class="lbl">Plata · 30 d</h2>${chip(zero ? "zero" : revenue?.status ?? "ok")}</header>
        <p class="disp" style="font-size: ${zero ? 38 : 52}px;">${zero ? "Sin pedidos pagos" : money(s.month.revenue)}</p>
        <p class="small soft">${zero ? `Woo conectado.${last ? ` Último pedido pago ${ago(last)}.` : ""}` : `${num(s.month.orders)} pedidos · ${num(s.month.units)} u. · ticket ${money(s.month.aov)}`}</p>
        <div class="rows flush" style="--cols: 70px repeat(4, minmax(0, 1fr));">
          <div class="rows-head"><span></span><span class="n">Hoy</span><span class="n">7 d</span><span class="n">30 d</span><span class="n">90 d</span></div>
          <div class="rows-row"><span class="muted">Pedidos</span>${[s.today, s.week, s.month, s.ninety].map((b) => html`<span class="n">${num(b?.orders)}</span>`)}</div>
          <div class="rows-row"><span class="muted">Ingresos</span>${[s.today, s.week, s.month, s.ninety].map((b) => html`<span class="n">${b?.orders ? money(b.revenue) : "—"}</span>`)}</div>
        </div>
        ${s.incomplete ? html`<span class="xs warn-t">Lectura parcial: se alcanzó el tope de páginas de pedidos.</span>` : ""}
        <a class="small strong" href="#/ventas">Ver ventas →</a>`,
    );
  }

  // Demanda
  const sessionsSeries = changes[0];
  if (!overview.ok) mount(ctx.slot("demanda"), errorState(overview.error, "la demanda"));
  else if (!isAvailable(demand)) mount(ctx.slot("demanda"), html`<h2 class="lbl">Demanda</h2>${empty({ status: demand?.status ?? "unknown", title: "Sin demanda observada", reason: demand?.reason })}`);
  else {
    const lines = sessionsSeries.ok ? seriesToLine(sessionsSeries.data) : null;
    const imp = changeRows.find((row) => row.id === "impressions");
    const clk = changeRows.find((row) => row.id === "clicks");
    mount(
      ctx.slot("demanda"),
      html`
        <header class="panel-head spread"><h2 class="lbl">Demanda · 28 d</h2><span class="row" style="gap: 6px;">${chip(conversion?.status ?? "unknown", "GA4")}${chip(demand.status, "GSC")}</span></header>
        <div class="row" style="align-items: flex-end; gap: 22px;">
          <div class="metric"><span class="disp" style="font-size: 56px;">${num(sessions)}</span><span class="small muted">sesiones</span></div>
          <div class="metric"><span class="disp" style="font-size: 34px; color: var(--ink-2);">${num(demand.data?.users)}</span><span class="small muted">usuarios</span></div>
          <div class="metric"><span class="disp" style="font-size: 34px; color: var(--ink-2);">${num(demand.data?.clicks)}</span><span class="small muted">clics GSC</span></div>
        </div>
        ${lines ? html`<div style="position: relative;">${lines.previous ? html`<div style="position: absolute; inset: 0;">${spark(lines.previous, { color: "var(--prev)", dashed: true })}</div>` : ""}${spark(lines.values)}</div>` : ""}
        <div class="row small" style="gap: 18px;">
          ${imp ? html`<span><span class="muted">Impresiones GSC</span> <span class="${delta(imp.res.data.delta).dir === "up" ? "up" : "down"} strong">${delta(imp.res.data.delta, imp.res.data.delta_pct).text}</span></span>` : html`<span class="muted">Impresiones ${num(demand.data?.impressions)}</span>`}
          ${clk ? html`<span><span class="muted">Clics GSC</span> <span class="${delta(clk.res.data.delta).dir === "up" ? "up" : "down"} strong">${delta(clk.res.data.delta, clk.res.data.delta_pct).text}</span></span>` : ""}
        </div>
        <a class="small strong" href="#/demanda">Ver demanda →</a>`,
    );
  }

  // Conversión
  if (!overview.ok) mount(ctx.slot("conversion"), errorState(overview.error, "la conversión"));
  else if (!isAvailable(conversion)) {
    mount(ctx.slot("conversion"), html`<h2 class="lbl">Conversión · 28 d</h2>${empty({ status: conversion?.status ?? "unknown", title: "No se puede calcular", body: "Hacen falta sesiones y compras de GA4.", reason: conversion?.reason })}`);
  } else {
    const max = Math.max(sessions ?? 0, 1);
    mount(
      ctx.slot("conversion"),
      html`
        <header class="panel-head spread"><h2 class="lbl">Conversión · 28 d</h2>${chip(conversion.status, "GA4")}</header>
        <p class="disp" style="font-size: 56px;">${pct(conversion.data?.cvr)}</p>
        <div class="stack" style="gap: 10px;">
          <div class="row small" style="display: grid; grid-template-columns: 76px 1fr 44px; gap: 10px;"><span class="muted">Sesiones</span><span class="bar" style="height: 10px;"><i style="width: 100%;"></i></span><span class="n strong">${num(sessions)}</span></div>
          <div class="row small" style="display: grid; grid-template-columns: 76px 1fr 44px; gap: 10px;"><span class="muted">Compras</span>${purchases ? bar(purchases / max) : html`<span class="bar hatch" style="height: 10px;"></span>`}<span class="n strong">${num(purchases)}</span></div>
        </div>
        <p class="xs muted">Carrito y checkout se miden por SKU en Product 360. A nivel tienda GA4 entrega sesiones, usuarios y compras.</p>`,
    );
  }

  // Hacer hoy
  mount(ctx.slot("opps-count"), opps.ok ? `${num(openOpps.length)} abiertas · por score` : "");
  if (!opps.ok) mount(ctx.slot("opps"), html`<div style="padding: 0 20px 14px;">${errorState(opps.error, "las oportunidades")}</div>`);
  else if (!openOpps.length) mount(ctx.slot("opps"), html`<div style="padding: 0 20px 14px;">${empty({ status: "zero", title: "Ninguna oportunidad abierta", body: "Las reglas no emiten filas si falta el dato que necesitan." })}</div>`);
  else {
    mount(
      ctx.slot("opps"),
      openOpps.slice(0, 5).map(
        (row) => html`<a class="opp-row" href="#/oportunidades/${encodeURIComponent(row.id)}">
          ${pip(sevOf(row))}
          <span class="stack" style="gap: 2px; min-width: 0;"><span class="strong">${oppTypeLabel(row.type)}</span><span class="mono xs muted ellipsis">${row.type}</span></span>
          <span class="stack" style="gap: 2px; min-width: 0;"><span class="ellipsis"><span class="mono muted" style="margin-right: 6px;">${row.parent_sku}</span>${row.product}</span><span class="small muted ellipsis">${(row.evidence ?? [])[0] ?? row.reason}</span></span>
          <span class="score-cell">${bar(Number(row.score) / 100)}<b>${num(row.score)}</b></span>
        </a>`,
      ),
    );
  }

  // Está mal
  async function loadAlerts() {
    const fresh = await attempt("/v1/alerts", { fresh: true });
    if (!ctx.alive()) return;
    if (!fresh.ok) return mount(ctx.slot("alerts"), errorState(fresh.error, "las alertas"));
    const open = (fresh.data.alerts ?? []).filter((row) => row.status === "open").sort((a, b) => (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1));
    mount(ctx.slot("alerts-count"), open.length === 1 ? "1 alerta abierta" : `${num(open.length)} alertas abiertas`);
    mount(
      ctx.slot("alerts"),
      open.length
        ? open.map(
            (row) => html`<a href="${RULE_VIEW[row.rule_id] ?? "#/alertas"}" style="display: grid; grid-template-columns: 14px 1fr; gap: 10px; padding: 10px 0; border-top: 1px solid var(--hair); color: var(--ink); text-decoration: none;">
              <span style="margin-top: 5px;">${pip(row.severity)}</span>
              <span class="stack" style="gap: 3px;"><span class="strong">${row.title} <span class="mono xs muted" style="margin-left: 6px;">${row.rule_id}</span></span><span class="small soft">abierta ${ago(row.opened_at)}</span></span>
            </a>`,
          )
        : html`<p class="small muted" style="padding: 8px 0;">Nada abierto. Las alertas se cierran solas cuando la regla deja de cumplirse.</p>`,
    );
  }
  void loadAlerts();

  // Fuentes con frescura real
  const syncOf = (i) => (changes[i]?.ok ? changes[i].data.sync?.last_success_at : null);
  const sources = [
    ["Woo · pedidos", sales.ok ? (sales.data.configured === false ? "not_configured" : "ok") : "error", sales.ok ? (sales.data.fetched_at ? ago(sales.data.fetched_at) : "sin keys") : "error"],
    ["GA4", conversion?.status ?? "unknown", syncOf(0) ? ago(syncOf(0)) : "—"],
    ["Search Console", demand?.status ?? "unknown", syncOf(1) ? ago(syncOf(1)) : "—"],
    ["Auditoría SEO", seo.ok ? (seo.data.configured === false ? "not_configured" : "ok") : "error", seo.ok && seo.data.summary?.age_h != null ? `hace ${num(seo.data.summary.age_h)} h` : "—"],
    ["Merchant feed", merchant.ok ? (merchant.data.source === "unavailable" ? "not_configured" : merchant.data.summary?.blocked ? "ok" : "zero") : "error", merchant.ok && merchant.data.source !== "unavailable" ? `${num(merchant.data.summary?.blocked ?? 0)} bloqueadas` : "—"],
    ["Competencia", competition.ok ? (competition.data.configured === false ? "not_configured" : "ok") : "error", competition.ok && competition.data.fetched_at ? ago(competition.data.fetched_at) : "—"],
    ["Modelo IA", healthz?.integrations?.ai ? "ok" : "not_configured", healthz?.integrations?.ai ? "con keys" : "sin keys"],
  ];
  mount(
    ctx.slot("sources"),
    sources.map(
      ([name, st, when]) => html`<div style="display: grid; grid-template-columns: 1fr auto 96px; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--hair); font-size: 12.5px;">
        <span>${name}</span>${chip(st)}<span class="n muted">${when}</span>
      </div>`,
    ),
  );

  // Serie diaria
  const metricLabel = METRICS.find(([id]) => id === metric)?.[1] ?? metric;
  await ctx.fill(
    "chart",
    () => series(metric, win),
    (data) => {
      const state = chartState(data);
      mount(
        ctx.slot("chart-legend"),
        html`<span><span class="sw" style="background: var(--act); height: 2px;"></span>${windowLabel(data.range) || metricLabel}</span>
          ${data.previous ? html`<span><span class="sw" style="border-top: 1.5px dashed var(--prev); height: 0;"></span>${windowLabel(data.compare) || "anterior"}</span>` : ""}`,
      );
      if (!state.plottable) return empty({ status: state.status, title: `Sin serie de ${metricLabel.toLowerCase()}`, body: "No hay observaciones sincronizadas en esta ventana.", reason: state.reason });
      const missing = (data.current?.points ?? []).filter((p) => p.status === "unknown").length;
      setTimeout(() => {
        if (!ctx.alive()) return;
        const host = ctx.root.querySelector("[data-chart-host]");
        ctx.cleanup(renderLine(host, { ...seriesToLine(data), label: metricLabel }, { compare: win.cmp, percent: metric === "ctr", digits: metric === "position" ? 1 : 0 }));
      }, 0);
      return html`<div class="chart" data-chart-host role="img" aria-label="${metricLabel} por día"></div>
        <footer class="row wrap small muted" style="gap: 10px;">
          ${chip(state.status, data.source)}
          <span>${data.sync?.last_success_at ? `sincronizado ${ago(data.sync.last_success_at)}` : "sin sync registrado"}</span>
          ${metric !== "ctr" && metric !== "position" && data.current?.total != null ? html`<span>· total ${num(data.current.total)}</span>` : ""}
          ${missing ? html`<span>· ${missing} ${missing === 1 ? "día" : "días"} sin observación: se dibujan como hueco, nunca como 0</span>` : ""}
        </footer>`;
    },
    { what: "la serie" },
  );
}

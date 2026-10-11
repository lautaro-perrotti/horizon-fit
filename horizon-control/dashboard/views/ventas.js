// Ventas: paid Woo orders, read-only. Without orders there is no $0, there is "Sin pedidos".
import { html, mount } from "../core/html.js";
import { api, attempt } from "../core/api.js";
import { ago, dateTime, decimal, money, num } from "../core/format.js";
import { chip, empty, errorState, loading, notConfigured } from "../ui/components.js";
import { chartState, renderLine, seriesToLine } from "../ui/chart.js";

export const crumb = () => "Ventas";

const WINDOWS = [
  ["7", "7 d", "d7"],
  ["30", "30 d", "d30"],
  ["90", "90 d", "d90"],
];

function bucket(labelText, b, highlight) {
  const zero = !b?.orders;
  return html`<div class="${highlight ? "hi" : ""}">
    <div class="row spread"><span class="lbl" style="${highlight ? "color: var(--ink);" : ""}">${labelText}</span>${chip(zero ? "zero" : "ok", zero ? "cero" : "ok")}</div>
    <span class="disp" style="font-size: ${zero ? 30 : 40}px; color: ${zero ? "var(--ink-2)" : "var(--ink)"};">${zero ? "Sin pedidos" : money(b.revenue)}</span>
    <span class="small muted">${zero ? "0 unidades" : `${num(b.orders)} pedidos · ${num(b.units)} u. · ticket ${money(b.aov)}`}</span>
  </div>`;
}

export async function render(ctx) {
  const rw = WINDOWS.some(([id]) => id === ctx.query.rw) ? ctx.query.rw : "30";
  const key = WINDOWS.find(([id]) => id === rw)[2];
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div><h1 class="disp">Ventas</h1><p>Pedidos pagos de Woo (processing, completed, on-hold), solo lectura. Sin pedidos no hay $0: hay “Sin pedidos”.</p></div>
        <div class="side" data-slot="meta"></div>
      </section>
      <section class="strip" style="--min: 220px;" data-slot="buckets">${loading(1)}</section>
      <article class="panel pad stack">
        <header class="panel-head"><h2>Ingresos por día</h2><span class="small muted push">ventana global · ${ctx.win.w}</span></header>
        <div data-slot="chart">${loading()}</div>
      </article>
      <section class="grid-auto" style="--min: 480px;">
        <article class="panel pad stack">
          <header class="panel-head"><h2>Por producto</h2><span class="small muted">rollup por parent_sku</span>
            <div class="seg push" role="group" aria-label="Ventana del rollup">${WINDOWS.map(([id, text]) => html`<button type="button" data-rw="${id}" aria-pressed="${id === rw}">${text}</button>`)}</div>
          </header>
          <div data-slot="products">${loading(5)}</div>
        </article>
        <article class="panel pad stack">
          <header class="panel-head"><h2>Pedidos recientes</h2><span class="small muted">últimos 10 pagos · sin datos personales</span></header>
          <div data-slot="orders">${loading(5)}</div>
        </article>
      </section>`,
  );
  ctx.on("click", "[data-rw]", (_, t) => ctx.nav.setQuery({ rw: t.dataset.rw === "30" ? undefined : t.dataset.rw }));

  void ctx.fill(
    "chart",
    () => api(`/v1/metrics/series?metric=revenue&range=${ctx.win.w}&compare=${ctx.win.cmp ? "previous" : "none"}`),
    (data) => {
      const state = chartState(data);
      if (!state.plottable) return empty({ status: state.status, title: "Sin serie de ingresos", reason: state.reason });
      setTimeout(() => {
        if (!ctx.alive()) return;
        ctx.cleanup(renderLine(ctx.slot("chart")?.querySelector("[data-chart-host]"), { ...seriesToLine(data), label: "Ingresos" }, { compare: ctx.win.cmp }));
      }, 0);
      return html`<div class="chart sm" data-chart-host role="img" aria-label="Ingresos por día"></div><span class="xs muted">${data.sync?.last_success_at ? `sincronizado ${ago(data.sync.last_success_at)}` : ""}</span>`;
    },
    { what: "la serie de ingresos" },
  );

  const res = await attempt("/v1/commerce/sales");
  if (!ctx.alive()) return;
  if (!res.ok) {
    mount(ctx.slot("buckets"), "");
    mount(ctx.slot("products"), errorState(res.error, "las ventas"));
    mount(ctx.slot("orders"), "");
    return;
  }
  const s = res.data;
  if (s.configured === false) {
    mount(ctx.slot("buckets"), "");
    mount(ctx.slot("products"), notConfigured(s.reason, "Woo REST sin configurar"));
    mount(ctx.slot("orders"), notConfigured(s.reason, "Woo REST sin configurar"));
    return;
  }
  mount(
    ctx.slot("meta"),
    html`<span class="row" style="gap: 6px;">${chip("ok", "Woo REST")}${s.incomplete ? chip("stale", "lectura parcial") : chip("ok", "completo")}</span><span class="xs muted">${s.fetched_at ? `leído ${ago(s.fetched_at)}` : ""}</span>`,
  );
  mount(ctx.slot("buckets"), html`${bucket("Hoy", s.today)}${bucket("7 d", s.week)}${bucket("30 d", s.month)}${bucket("90 d", s.ninety, true)}`);

  const products = [...(s.products ?? [])].filter((row) => row[key]?.units).sort((a, b) => (b[key]?.revenue ?? 0) - (a[key]?.revenue ?? 0));
  mount(
    ctx.slot("products"),
    products.length
      ? html`<div class="rows flush" style="--cols: 110px minmax(0, 1fr) 50px 54px 96px 70px 92px;">
          <div class="rows-head"><span>SKU</span><span>Producto</span><span class="n">Unid.</span><span class="n">Ped.</span><span class="n">Ingresos</span><span class="n">u/día</span><span class="n">Última</span></div>
          ${products.map((row) => {
            const w = row[key];
            return html`<a class="rows-row" href="#/producto/${encodeURIComponent(row.parent_sku)}">
              <span class="mono small">${row.parent_sku}</span><span class="ellipsis">${row.name ?? "—"}</span><span class="n">${num(w.units)}</span><span class="n">${num(w.orders)}</span><span class="n strong">${money(w.revenue)}</span><span class="n muted">${decimal(row.velocity_30d ?? 0, 2)}</span><span class="n xs muted">${row.last_sale_at ? ago(row.last_sale_at) : "—"}</span>
            </a>`;
          })}
        </div>`
      : empty({
          status: "zero",
          title: `Ningún SKU vendió en ${WINDOWS.find(([id]) => id === rw)[1]}.`,
          body: rw !== "90" && (s.products ?? []).some((row) => row.d90?.units) ? "Hubo ventas en 90 d: cambiá la ventana para ver qué productos fueron." : undefined,
          action: rw !== "90" ? html`<button type="button" class="btn btn-sm" data-rw="90">Ver 90 d</button>` : undefined,
        }),
  );

  const orders = s.recent_orders ?? [];
  mount(
    ctx.slot("orders"),
    orders.length
      ? html`<div class="rows flush" style="--cols: 64px 96px 88px minmax(0, 1fr) 90px 80px;">
          <div class="rows-head"><span>Pedido</span><span>Fecha</span><span>Estado</span><span>SKUs</span><span class="n">Total</span><span>Cupón</span></div>
          ${orders.map(
            (o) => html`<div class="rows-row small">
              <span class="mono">#${o.id}</span><span>${dateTime(o.date)}</span><span class="soft">${o.status}</span>
              <span class="mono xs ellipsis">${[...new Set((o.items ?? []).map((item) => item.parent_sku || item.sku))].join(" · ")}</span>
              <span class="n strong">${money(o.revenue ?? o.total)}</span>
              <span class="mono xs">${o.coupon ?? "—"}</span>
            </div>`,
          )}
        </div>
        <span class="xs muted">El cliente se ve como clave hasheada en Clientes.</span>`
      : empty({ status: "zero", title: "Sin pedidos pagos en 90 d" }),
  );
}

// Campañas: internal promos (coupons on paid orders) are measurable; Ads is not connected and is not simulated.
import { html, mount } from "../core/html.js";
import { attempt } from "../core/api.js";
import { money, num } from "../core/format.js";
import { chip, empty, errorState, loading, notConfigured } from "../ui/components.js";

export const crumb = () => "Campañas";

function adsBlock(name, row, note) {
  const configured = row?.configured === true;
  return html`<article class="panel pad stack" style="gap: 14px;">
    <header class="panel-head"><h2 style="font-size: 17px; font-weight: 700;">${name}</h2><span class="push">${chip(configured ? "ok" : "not_configured")}</span></header>
    ${configured
      ? html`<p class="small soft">Conectado.</p>`
      : empty({ status: "", title: "No hay adapter de Ads instalado.", body: note, reason: row?.reason ?? "ads_adapter_not_configured" })}
  </article>`;
}

export async function render(ctx) {
  mount(
    ctx.root,
    html`
      <section class="view-head"><div><h1 class="disp">Campañas</h1><p>Lo que hoy se puede medir son las promos internas: cupones usados en pedidos pagos. Ads no está conectado y acá no se simula.</p></div></section>
      <article class="panel pad stack" data-slot="promos">${loading(3)}</article>
      <section class="grid-auto" style="--min: 380px;" data-slot="ads">${loading(2)}</section>`,
  );
  const res = await attempt("/v1/campaigns");
  if (!ctx.alive()) return;
  if (!res.ok) {
    mount(ctx.slot("promos"), errorState(res.error, "las campañas"));
    mount(ctx.slot("ads"), "");
    return;
  }
  const d = res.data;
  const promos = (d.campaigns ?? []).filter((row) => row.channel === "internal_promo");
  mount(
    ctx.slot("promos"),
    html`<header class="panel-head"><h2>Promos internas</h2>${chip(d.configured === false ? "not_configured" : promos.length ? "ok" : "zero", d.configured === false ? undefined : "observadas")}<span class="small muted push">primer cupón de cada pedido pago · 90 d</span></header>
      ${d.configured === false
        ? notConfigured(d.reason, "Woo REST sin configurar")
        : promos.length
          ? html`<div class="rows flush" style="--cols: minmax(0, 1fr) 130px 100px 100px 120px;">
              <div class="rows-head"><span>Cupón</span><span>Canal</span><span>Estado</span><span class="n">Pedidos</span><span class="n">Ingresos</span></div>
              ${promos.map(
                (row) => html`<div class="rows-row"><span class="mono">${row.name}</span><span class="mono xs soft">${row.channel}</span><span class="ok-t strong small">${row.status === "observed" ? "observada" : row.status}</span><span class="n">${num(row.orders)}</span><span class="n strong">${money(row.revenue, { orders: row.orders })}</span></div>`,
              )}
            </div>
            <span class="xs muted">${num(promos.length)} ${promos.length === 1 ? "cupón visto" : "cupones vistos"} en pedidos de los últimos 90 d.</span>`
          : empty({ status: "zero", title: "Sin cupones en pedidos pagos", body: "Cuando un pedido pago use un cupón, aparece acá con sus pedidos e ingresos." })}`,
  );
  mount(
    ctx.slot("ads"),
    html`${adsBlock("Google Ads", d.ads?.google, "Sin gasto, sin clics, sin ROAS. Cuando exista el adapter, este bloque muestra campañas reales.")}
      ${adsBlock("Meta Ads", d.ads?.meta, "El píxel de Meta vive en la tienda; Control no lee su gasto ni sus eventos.")}`,
  );
}

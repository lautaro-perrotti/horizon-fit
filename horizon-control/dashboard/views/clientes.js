// Clientes: RFM over 90 d of paid orders. Each customer is a hashed key — no email, no name, no Woo id.
import { html, mount } from "../core/html.js";
import { attempt } from "../core/api.js";
import { ago, dateTime, money, num } from "../core/format.js";
import { SEGMENTS, chip, empty, errorState, loading, notConfigured } from "../ui/components.js";

export const crumb = (params) => (params.key ? "Clientes · clave" : "Clientes");

function detail(row) {
  return html`
    <header class="stack" style="gap: 6px;"><span class="lbl">Clave</span><span class="mono" style="font-size: 15px;">${row.customer_key}</span><span class="row">${chip("ok", row.segment)}</span></header>
    <div class="grid-auto" style="--min: 90px; gap: 12px;">
      ${[["R", row.r, "recencia"], ["F", row.f, "frecuencia"], ["M", row.m, "monto"]].map(
        ([k, v, t]) => html`<div class="well stack" style="gap: 2px;"><span class="lbl">${k}</span><span class="disp" style="font-size: 32px;">${v ?? "—"}</span><span class="xs muted">${t} · 1 a 5</span></div>`,
      )}
    </div>
    <div class="kv">
      <span>Pedidos</span><span>${num(row.orders)}</span>
      <span>Ingresos</span><span>${money(row.revenue)}</span>
      <span>Ticket medio</span><span>${money(row.aov)}</span>
      <span>Primera compra</span><span>${dateTime(row.first_purchase)}</span>
      <span>Última compra</span><span>${dateTime(row.last_purchase)} · ${num(row.recency_days)} días</span>
      <span>Productos</span><span>${(row.categories ?? []).length ? row.categories.map((sku) => html`<a class="mono small" href="#/producto/${encodeURIComponent(sku)}" style="margin-right: 8px;">${sku}</a>`) : "—"}</span>
      <span>Repite</span><span>${row.repeat ? "sí" : "no"}</span>
      <span>Usó cupón</span><span>${row.discount_used ? "sí" : "no"}</span>
    </div>`;
}

export async function render(ctx) {
  const segment = SEGMENTS.some((s) => s.id === ctx.query.seg) ? ctx.query.seg : "";
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div><h1 class="disp">Clientes</h1><p>RFM sobre pedidos pagos de 90 d. Cada cliente es una clave: sha256 truncado a 16 caracteres. Sin email, sin nombre, sin id de Woo.</p></div>
        <div class="row" style="align-items: baseline; gap: 10px;" data-slot="total"></div>
      </section>
      <section class="strip" style="--min: 140px;" data-slot="segments">${loading(1)}</section>
      <section class="grid-auto" style="--min: 460px;">
        <article class="panel" style="padding: 6px 0;" data-slot="list">${loading(5)}</article>
        <article class="panel pad stack" style="gap: 16px; padding: 20px 22px;" data-slot="detail">${loading(4)}</article>
      </section>`,
  );
  ctx.on("click", "[data-seg]", (_, t) => ctx.nav.go("/clientes", t.dataset.seg && t.dataset.seg !== segment ? { seg: t.dataset.seg } : {}));

  const [all, filtered] = await Promise.all([attempt("/v1/customers"), segment ? attempt(`/v1/customers?segment=${segment}`) : null]);
  if (!ctx.alive()) return;
  const res = filtered ?? all;
  if (!res.ok) {
    mount(ctx.slot("segments"), "");
    mount(ctx.slot("list"), html`<div class="pad">${errorState(res.error, "los clientes")}</div>`);
    mount(ctx.slot("detail"), "");
    return;
  }
  if (res.data.configured === false) {
    mount(ctx.slot("segments"), "");
    mount(ctx.slot("list"), html`<div class="pad">${notConfigured(res.data.reason, "Woo REST sin configurar")}</div>`);
    mount(ctx.slot("detail"), "");
    return;
  }
  const counts = all.ok ? all.data.segments ?? {} : res.data.segments ?? {};
  const total = all.ok ? (all.data.customers ?? []).length : null;
  mount(ctx.slot("total"), total != null ? html`<span class="disp" style="font-size: 48px;">${num(total)}</span><span class="soft">claves con compra en 90 d</span>` : "");
  mount(
    ctx.slot("segments"),
    SEGMENTS.map(
      (s) => html`<button type="button" data-seg="${s.id}" aria-pressed="${s.id === segment}" style="border: 0; text-align: left; cursor: pointer; font: inherit; color: inherit; ${s.id === segment ? "background: var(--sel);" : ""}">
        <span class="mono small soft">${s.id}</span>
        <span style="font-size: 22px; font-weight: 700;">${num(counts[s.id] ?? 0)}</span>
        <span class="xs muted">${s.rule}</span>
      </button>`,
    ),
  );
  const rows = res.data.customers ?? [];
  const selected = rows.find((row) => row.customer_key === ctx.params.key) ?? rows[0] ?? null;
  mount(
    ctx.slot("list"),
    rows.length
      ? html`<div class="rows" style="--cols: minmax(0, 1.3fr) 100px 50px 96px 80px;">
          <div class="rows-head"><span>Clave</span><span>Segmento</span><span class="n">Ped.</span><span class="n">Ingresos</span><span class="n">Recencia</span></div>
          ${rows.map(
            (row) => html`<a class="rows-row" href="#/clientes/${encodeURIComponent(row.customer_key)}${segment ? `?seg=${segment}` : ""}" aria-current="${row.customer_key === selected?.customer_key}">
              <span class="mono small">${row.customer_key}</span><span class="soft">${row.segment}</span><span class="n">${num(row.orders)}</span><span class="n strong">${money(row.revenue)}</span><span class="n muted">${num(row.recency_days)} d</span>
            </a>`,
          )}
        </div>
        <p class="xs muted" style="padding: 12px 18px;">${rows.length < 20 ? "Con pocas claves los quintiles RFM son gruesos: el segmento sirve como etiqueta, no como estadística." : ""}</p>`
      : html`<div class="pad">${empty({ status: "zero", title: segment ? `Nadie en ${segment}` : "Sin clientes en 90 d", body: "Se cuentan solo pedidos pagos con cliente identificable." })}</div>`,
  );

  let row = selected;
  if (ctx.params.key && !rows.some((r) => r.customer_key === ctx.params.key)) {
    const one = await attempt(`/v1/customers/${encodeURIComponent(ctx.params.key)}`);
    if (!ctx.alive()) return;
    if (!one.ok) return mount(ctx.slot("detail"), errorState(one.error, "esta clave"));
    row = one.data;
  }
  mount(ctx.slot("detail"), row ? detail(row) : html`<p class="small muted">Elegí una clave.</p>`);
}

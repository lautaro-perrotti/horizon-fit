// Product 360: one SKU, every join. Each slice keeps its own status; nothing is guessed.
import { html, mount } from "../core/html.js";
import { attempt } from "../core/api.js";
import { ago, dateTime, decimal, money, num, pct, toNumber } from "../core/format.js";
import { bar, chip, colorOf, empty, errorState, loading, oppTypeLabel, pip, spark } from "../ui/components.js";
import { isAvailable, label } from "../core/slice.js";
import { rememberSku, recentSkus } from "../core/prefs.js";

export const crumb = (params) => (params.ref ? `Product 360 · ${String(params.ref).toUpperCase()}` : "Product 360");

const JOIN_LABEL = { exact: "exacto", inferred: "inferido", none: "sin join" };

function insightsPath(ref) {
  return /^https?:\/\//i.test(ref) || ref.includes("/")
    ? `/v1/insights/products?id=${encodeURIComponent(ref)}`
    : `/v1/insights/products/${encodeURIComponent(ref)}`;
}

function sliceChip(slice, text) {
  const status = slice?.status ?? "unknown";
  const join = slice?.join_confidence && slice.join_confidence !== "exact" ? ` · ${JOIN_LABEL[slice.join_confidence]}` : "";
  return chip(status, `${text ?? label(status)}${join}`, `${status}${slice?.reason ? ` · ${slice.reason}` : ""}`);
}

function unavailable(slice, what) {
  return empty({
    status: slice?.status ?? "unknown",
    title: slice?.status === "not_joined" ? `Este SKU no matchea ${what} todavía` : slice?.status === "not_configured" ? `${what} sin configurar` : `Sin dato de ${what}`,
    body:
      slice?.reason === "ga4_join_unavailable"
        ? "El item_id de GA4 no es el parent_sku y la URL no apareció en la ventana. No se adivina."
        : slice?.reason === "seo_page_not_in_audit"
          ? "La PDP no está en la última auditoría."
          : slice?.reason === "merchant_sku_not_in_feed"
            ? "Ninguna variante de este SKU aparece en el feed."
            : undefined,
    reason: slice?.reason,
  });
}

function joinCell(name, slice, metric, joinText) {
  return html`<div>
    <div class="row spread"><span class="lbl" style="color: var(--ink-2);">${name}</span>${sliceChip(slice)}</div>
    <span class="v">${isAvailable(slice) ? metric : "—"}</span>
    <span class="xs muted">${joinText}</span>
    <span class="xs" style="color: var(--ink-4);">${slice?.fetched_at ? ago(slice.fetched_at) : slice?.reason ?? ""}</span>
  </div>`;
}

function searchForm(ctx) {
  const recent = recentSkus();
  mount(
    ctx.root,
    html`<section class="view-head"><div><h1 class="disp">Product 360</h1><p>Un SKU con todos sus joins: catálogo, ventas, GA4, Search Console, SEO, Merchant y competencia.</p></div></section>
      <form class="panel pad row wrap" data-act="open" style="gap: 10px;">
        <label class="sr" for="p360-ref">SKU, slug, id o URL</label>
        <input id="p360-ref" class="field" data-search style="flex: 1; min-width: 280px; font-family: var(--mono);" placeholder="004-TOP-BOR · top-falda-bordo · https://horizonfit.com.ar/producto/…">
        <button type="submit" class="btn btn-act">Abrir</button>
      </form>
      ${recent.length ? html`<div class="row wrap"><span class="lbl">Recientes</span>${recent.map((sku) => html`<a class="btn btn-sm" href="#/producto/${encodeURIComponent(sku)}"><span class="mono">${sku}</span></a>`)}</div>` : ""}`,
  );
  ctx.on("submit", '[data-act="open"]', (event) => {
    event.preventDefault();
    const ref = ctx.root.querySelector("#p360-ref").value.trim();
    if (ref) location.hash = `#/producto/${encodeURIComponent(ref)}`;
  });
}

export async function render(ctx) {
  const ref = String(ctx.params.ref ?? "").trim();
  if (!ref) return searchForm(ctx);
  mount(
    ctx.root,
    html`<section class="panel p-head" data-slot="head">${loading(4)}</section>
      <section class="strip joins" data-slot="joins">${loading(2)}</section>
      <section class="grid-auto" style="--min: 340px;">
        <div class="stack" style="gap: 16px;">
          <article class="panel pad stack" data-slot="funnel">${loading()}</article>
          <article class="panel pad stack" data-slot="sales">${loading()}</article>
        </div>
        <div class="stack" style="gap: 16px;">
          <article class="panel pad stack" data-slot="search">${loading()}</article>
          <article class="panel pad stack" style="gap: 10px;" data-slot="seo">${loading()}</article>
        </div>
        <div class="stack" style="gap: 16px;">
          <article class="panel pad stack" style="gap: 10px;" data-slot="merchant">${loading()}</article>
          <article class="panel pad stack" style="gap: 10px;" data-slot="competition">${loading()}</article>
          <article class="panel pad stack" style="gap: 10px;" data-slot="opps">${loading(2)}</article>
          <article class="panel pad stack" style="gap: 10px;" data-slot="drafts">${loading(2)}</article>
        </div>
      </section>`,
  );

  const res = await attempt(insightsPath(ref));
  if (!ctx.alive()) return;
  if (!res.ok) {
    mount(
      ctx.root,
      res.error?.status === 404
        ? html`<section class="view-head"><div><h1 class="disp">Product 360</h1></div></section>${empty({ status: "zero", title: `No encontré “${ref}”`, body: "Probá con el parent SKU (004-TOP-BOR), el slug, el id de Woo o la URL de la PDP." })}`
        : errorState(res.error, "este producto"),
    );
    return;
  }
  const p = res.data;
  const keys = p.keys ?? {};
  const sku = keys.parent_sku || ref.toUpperCase();
  rememberSku(sku);
  ctx.setCrumb(`Product 360 · ${sku}`);
  const cat = p.catalog?.data ?? {};
  const color = colorOf(cat.name);
  const pdp = keys.canonical_url || (keys.slug ? `${ctx.cfg?.storefrontUrl ?? "https://horizonfit.com.ar"}/producto/${keys.slug}/` : null);
  const pdpPath = pdp ? new URL(pdp).pathname : null;

  mount(
    ctx.slot("head"),
    html`
      ${cat.images?.[0]
        ? html`<img class="p-img" src="${cat.images[0]}" alt="${cat.name ?? sku}" loading="lazy">`
        : html`<div class="p-img ph" style="${color ? `background: ${color.hex};` : ""}">sin foto</div>`}
      <div class="stack spread" style="justify-content: space-between; gap: 14px; min-width: 0;">
        <div class="stack" style="gap: 8px;">
          <span class="lbl">${(cat.categories ?? []).join(" / ") || "Producto"}</span>
          <h1 class="disp" style="font-size: 64px;">${cat.name ?? sku}</h1>
          <span class="small muted"><span class="mono soft">${sku}</span> · ${keys.kind ?? "ref"} ${keys.input && keys.input !== sku ? `“${keys.input}”` : ""}${keys.slug ? html` · slug <span class="mono">${keys.slug}</span>` : ""}${keys.product_id ? ` · id ${keys.product_id}` : ""}</span>
        </div>
        <div class="row wrap" style="align-items: flex-end; gap: 28px;">
          <div class="metric"><span class="lbl">Precio</span><span class="disp" style="font-size: 40px;">${money(cat.price?.amount)}</span></div>
          <div class="stack" style="gap: 6px;">
            <span class="lbl">Talles · stock</span>
            <div class="sizes">${(cat.variants ?? []).length
              ? cat.variants.map((v) => html`<span class="size" title="${v.sku}"><b>${v.size ?? v.sku}</b><span style="color: ${v.in_stock ? "var(--ok)" : "var(--bad)"};">${v.in_stock ? "en stock" : "sin stock"}</span></span>`)
              : html`<span class="small muted">${cat.stock_status === "outofstock" ? "Sin stock" : "Sin variantes"}</span>`}</div>
          </div>
        </div>
      </div>
      <div class="stack" style="gap: 8px; min-width: 210px;">
        <a class="btn btn-act" href="#/sitio?u=${encodeURIComponent(pdpPath ?? "/")}">Ver en Sitio</a>
        ${pdp ? html`<a class="btn" href="${pdp}" target="_blank" rel="noopener">Abrir PDP ↗</a>` : ""}
        <button type="button" class="btn" data-act="ask">Preguntar sobre este SKU</button>
        ${ctx.can("content.generate") ? html`<a class="btn btn-ghost" href="#/contenido?sku=${encodeURIComponent(sku)}">Generar copy</a>` : ""}
      </div>`,
  );
  ctx.on("click", '[data-act="ask"]', () => ctx.consulta.ask(`¿Cómo viene ${sku}?`));

  const sales = p.sales;
  const an = p.analytics;
  const se = p.search;
  const seo = p.seo;
  const me = p.merchant;
  const co = p.competition;
  mount(
    ctx.slot("joins"),
    html`
      ${joinCell("Catálogo", p.catalog, `${money(cat.price?.amount)} · ${(cat.variants ?? []).map((v) => v.size).filter(Boolean).join(" ") || "—"}`, "Store API · exacto")}
      ${joinCell("Ventas", sales, sales?.data ? `${num(sales.data.d30?.units ?? sales.data.units ?? 0)} u. en 30 d` : "—", "Woo REST · por parent_sku")}
      ${joinCell("GA4", an, an?.data ? `${num(an.data.pdp_views)} vistas de PDP` : "—", an?.data?.join?.item_id ? `item_id ${an.data.join.item_id}` : an?.data?.join?.page_path ? `page_path ${an.data.join.page_path}` : "item_id o page_path")}
      ${joinCell("Search Console", se, se?.data ? `${num(se.data.impressions)} impresiones` : "—", "URL canónica")}
      ${joinCell("SEO", seo, seo?.data ? `${num(seo.data.critical)} críticos · ${num(seo.data.warning)} warn.` : "—", "auditoría de la PDP")}
      ${joinCell("Merchant", me, me?.data ? `${num(me.data.ready)}/${num((me.data.variants ?? []).length || me.data.ready)} listas` : "—", "feed por SKU de variante")}
      ${joinCell("Competencia", co, co?.data ? `${co.data.segment ?? "—"} · ${co.data.price_index?.index != null ? `índice ${decimal(co.data.price_index.index, 2)}` : "sin índice"}` : "—", "segmento por categoría")}`,
  );

  // Embudo GA4
  if (!isAvailable(an)) mount(ctx.slot("funnel"), html`<header class="panel-head"><h2>Embudo de la PDP</h2>${sliceChip(an)}</header>${unavailable(an, "GA4")}`);
  else {
    const d = an.data;
    const top = Math.max(toNumber(d.pdp_views) ?? 0, toNumber(d.view_item) ?? 0, 1);
    const steps = [
      ["Vistas PDP", d.pdp_views, null],
      ["view_item", d.view_item, null],
      ["Al carrito", d.add_to_cart, d.atc_rate],
      ["Checkout", d.begin_checkout, d.checkout_rate],
      ["Compra", d.purchase, d.cvr],
    ];
    mount(
      ctx.slot("funnel"),
      html`<header class="panel-head"><h2>Embudo de la PDP</h2><span class="small muted">GA4 · ${d.period ?? "28 d"}</span><span class="push">${sliceChip(an)}</span></header>
        ${steps.map(
          ([text, value, rate]) => html`<div style="display: grid; grid-template-columns: 110px minmax(0, 1fr) 40px 58px; align-items: center; gap: 10px; font-size: 12.5px;">
            <span class="muted">${text}</span>${toNumber(value) ? bar(toNumber(value) / top) : html`<span class="bar hatch" style="height: 6px;"></span>`}<span class="n strong">${num(value)}</span><span class="n xs muted">${rate != null ? pct(rate) : ""}</span>
          </div>`,
        )}
        ${toNumber(d.purchase_revenue) ? html`<span class="small soft">Ingresos atribuidos por GA4: ${money(d.purchase_revenue)}</span>` : ""}
        <p class="xs muted">Join ${JOIN_LABEL[an.join_confidence] ?? "—"}${d.join?.page_path ? html` por page_path <span class="mono">${d.join.page_path}</span>` : ""}${d.join?.item_id ? html` · item_id <span class="mono">${d.join.item_id}</span>` : ""}.</p>`,
    );
  }

  // Ventas
  if (!isAvailable(sales)) mount(ctx.slot("sales"), html`<header class="panel-head"><h2>Ventas del SKU</h2>${sliceChip(sales)}</header>${unavailable(sales, "ventas")}`);
  else {
    const d = sales.data;
    const windows = [d.d7, d.d30, d.d90];
    mount(
      ctx.slot("sales"),
      html`<header class="panel-head"><h2>Ventas del SKU</h2><span class="small muted">Woo REST · pedidos pagos</span><span class="push">${sliceChip(sales, sales.status === "zero" ? "cero" : undefined)}</span></header>
        <div class="rows flush" style="--cols: 100px repeat(3, minmax(0, 1fr));">
          <div class="rows-head"><span></span><span class="n">7 d</span><span class="n">30 d</span><span class="n">90 d</span></div>
          <div class="rows-row"><span class="muted">Unidades</span>${windows.map((w) => html`<span class="n">${num(w?.units ?? 0)}</span>`)}</div>
          <div class="rows-row"><span class="muted">Pedidos</span>${windows.map((w) => html`<span class="n">${num(w?.orders ?? 0)}</span>`)}</div>
          <div class="rows-row"><span class="muted">Ingresos</span>${windows.map((w) => html`<span class="n">${money(w?.revenue, { orders: w?.orders ?? 0 }).replace("Sin pedidos", "—")}</span>`)}</div>
          <div class="rows-row"><span class="muted">Ticket medio</span>${windows.map((w) => html`<span class="n">${w?.orders ? money(w.aov) : "—"}</span>`)}</div>
        </div>
        <div class="row wrap small muted" style="gap: 16px;"><span>Velocidad 30 d: ${decimal(d.velocity_30d ?? 0, 2)} u/día</span><span>Última venta: ${d.last_sale_at ? dateTime(d.last_sale_at) : "sin ventas en 90 d"}</span></div>
        <div data-slot="sku-series"></div>`,
    );
    void ctx.fill(
      "sku-series",
      attempt(`/v1/metrics/series?metric=units&sku=${encodeURIComponent(sku)}&range=90d&compare=none`).then((r) => (r.ok ? r.data : null)),
      (data) => {
        const values = (data?.current?.points ?? []).map((pt) => pt.value);
        return values.filter((v) => v != null).length >= 2
          ? html`<span class="lbl">Unidades por día · 90 d</span>${spark(values)}`
          : html`<span class="xs muted">Sin serie diaria de unidades para este SKU todavía.</span>`;
      },
      { lines: 1 },
    );
  }

  // Search Console
  if (!isAvailable(se)) mount(ctx.slot("search"), html`<header class="panel-head"><h2>Search Console</h2>${sliceChip(se)}</header>${unavailable(se, "Search Console")}`);
  else {
    const d = se.data;
    mount(
      ctx.slot("search"),
      html`<header class="panel-head"><h2>Search Console</h2><span class="small muted">28 d · esta URL</span><span class="push">${sliceChip(se)}</span></header>
        <div class="grid-auto" style="--min: 90px; gap: 12px;">
          <div class="metric"><span class="lbl">Impresiones</span><span class="disp" style="font-size: 32px;">${num(d.impressions)}</span></div>
          <div class="metric"><span class="lbl">Clics</span><span class="disp" style="font-size: 32px;">${num(d.clicks)}</span></div>
          <div class="metric"><span class="lbl">CTR</span><span class="disp" style="font-size: 32px;">${pct(d.ctr)}</span></div>
          <div class="metric"><span class="lbl">Posición</span><span class="disp" style="font-size: 32px;">${decimal(d.position, 1)}</span></div>
        </div>
        ${(d.queries ?? []).length
          ? html`<div class="rows flush" style="--cols: minmax(0, 1fr) 44px 56px 44px;">
              <div class="rows-head"><span>Consulta</span><span class="n">Clics</span><span class="n">Impr.</span><span class="n">Pos.</span></div>
              ${d.queries.map((q) => html`<div class="rows-row" style="font-size: 12.5px;"><span class="ellipsis">${q.query}</span><span class="n">${num(q.clicks)}</span><span class="n">${num(q.impressions)}</span><span class="n muted">${decimal(q.position, 1)}</span></div>`)}
            </div>`
          : html`<span class="small muted">Sin consultas para esta URL en la ventana.</span>`}`,
    );
  }

  // SEO
  if (!isAvailable(seo)) mount(ctx.slot("seo"), html`<header class="panel-head"><h2>SEO de la PDP</h2>${sliceChip(seo)}</header>${unavailable(seo, "la auditoría SEO")}`);
  else {
    const d = seo.data;
    const crit = d.issues?.critical ?? [];
    const warn = d.issues?.warning ?? [];
    const checks = [
      ["Title", Boolean(d.title), d.title || "falta", d.title ? `${d.title.length} caracteres` : ""],
      ["Meta description", Boolean(d.description), d.description ? `${d.description.slice(0, 60)}${d.description.length > 60 ? "…" : ""}` : "falta", d.description ? `${d.description.length} caracteres` : ""],
      ["H1", (d.h1 ?? []).length === 1, (d.h1 ?? []).join(" | ") || "sin H1 en el HTML inicial", ""],
      ["Canonical", Boolean(d.canonical), d.canonical || "falta", ""],
      ["Indexable", d.indexable !== false, d.indexable === false ? "noindex" : "index", ""],
      ["Schema", (d.schema ?? []).length > 0, (d.schema ?? []).join(", ") || "sin schema", ""],
      ["En sitemap", d.in_sitemap !== false, d.in_sitemap === false ? "no" : "sí", ""],
    ];
    mount(
      ctx.slot("seo"),
      html`<header class="panel-head"><h2>SEO de la PDP</h2><span class="small muted">HTML inicial${d.last_audit ? ` · ${ago(d.last_audit)}` : ""}</span><span class="push">${d.critical ? chip("error", `${num(d.critical)} críticos`) : sliceChip(seo)}</span></header>
        ${crit.map((row) => html`<div class="check"><b class="bad-t">✕</b><span class="stack" style="gap: 2px;"><span class="strong">${row.message}</span>${row.evidence ? html`<span class="mono xs muted">${row.evidence}</span>` : ""}</span><span class="xs muted">crítico</span></div>`)}
        ${warn.map((row) => html`<div class="check"><b class="warn-t">!</b><span class="stack" style="gap: 2px;"><span class="strong">${row.message}</span>${row.evidence ? html`<span class="mono xs muted">${row.evidence}</span>` : ""}</span><span class="xs muted">warning</span></div>`)}
        ${checks.map(([name, ok, ev, note]) => html`<div class="check"><b class="${ok ? "ok-t" : "bad-t"}">${ok ? "✓" : "✕"}</b><span class="stack" style="gap: 2px;"><span class="strong">${name}</span><span class="mono xs muted ellipsis">${ev}</span></span><span class="xs muted">${note}</span></div>`)}
        ${d.critical ? html`<p class="xs muted">Google lee primero el HTML inicial. El arreglo es del render de Fit, no de Control.</p>` : ""}`,
    );
  }

  // Merchant
  if (!isAvailable(me)) mount(ctx.slot("merchant"), html`<header class="panel-head"><h2>Merchant</h2>${sliceChip(me)}</header>${unavailable(me, "Merchant")}`);
  else {
    const d = me.data;
    mount(
      ctx.slot("merchant"),
      html`<header class="panel-head"><h2>Merchant</h2><span class="small muted">feed por variante</span><span class="push">${d.blocked ? chip("error", `${num(d.blocked)} bloqueadas`) : chip("zero", "0 bloqueadas")}</span></header>
        <div class="grid-auto" style="--min: 120px; gap: 8px;">
          ${(d.variants ?? []).map(
            (v) => html`<div class="well stack" style="gap: 3px;"><span class="mono xs muted">${v.sku}</span><span class="small strong" style="color: ${v.ready ? "var(--ok)" : "var(--bad)"};">${v.ready ? "lista" : "bloqueada"}</span>
              ${(v.issues ?? []).slice(0, 2).map((issue) => html`<span class="xs muted">${issue.message ?? issue.code ?? issue}</span>`)}</div>`,
          )}
        </div>`,
    );
  }

  // Competencia
  if (!isAvailable(co)) mount(ctx.slot("competition"), html`<header class="panel-head"><h2>Competencia</h2>${sliceChip(co)}</header>${unavailable(co, "competencia")}`);
  else {
    const d = co.data;
    const idx = d.price_index;
    mount(
      ctx.slot("competition"),
      html`<header class="panel-head"><h2>Competencia</h2><span class="small muted">segmento ${d.segment ?? "—"}</span><span class="push">${sliceChip(co)}</span></header>
        ${(d.peers ?? []).map(
          (peer) => html`<div style="display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid var(--hair); font-size: 12.5px;">
            ${pip(peer.ok ? "ok" : "warning")}<span class="ellipsis">${peer.competitor}${peer.ok ? "" : html` <span class="muted">· ${peer.status === 403 ? "bloquea el snapshot" : "no responde"}</span>`}</span><span class="mono xs" style="color: ${peer.ok ? "var(--ok)" : "var(--warn)"};">${peer.status ?? "—"}</span>
          </div>`,
        )}
        <div class="well row spread">
          <span class="stack" style="gap: 2px;"><span class="lbl">Índice de precio</span><span class="strong">${idx?.index != null ? `${decimal(idx.index, 2)} · mediana ${money(idx.median)} (n = ${num(idx.n)})` : "Sin índice"}</span></span>
          <span class="xs muted" style="text-align: right; max-width: 160px;">${idx?.index != null ? "Describe el precio; no es una sugerencia." : "Hacen falta 2 pares con precio en el segmento."}</span>
        </div>
        <a class="small strong" href="#/competencia?id=${encodeURIComponent(sku)}">Comparar en Competencia →</a>`,
    );
  }

  // Oportunidades y borradores del SKU
  const [opps, drafts] = await Promise.all([attempt("/v1/growth/opportunities?status=open"), attempt("/v1/content/drafts")]);
  if (!ctx.alive()) return;
  const mine = opps.ok ? (opps.data.opportunities ?? []).filter((row) => row.parent_sku === sku) : [];
  mount(
    ctx.slot("opps"),
    html`<h2 style="font-size: 15px; font-weight: 650;">Oportunidades de este SKU</h2>
      ${!opps.ok
        ? errorState(opps.error, "las oportunidades")
        : mine.length
          ? mine.map((row) => html`<a class="rows-row" href="#/oportunidades/${encodeURIComponent(row.id)}" style="--cols: 14px minmax(0, 1fr) 40px; padding: 9px 0;">${pip(row.severity)}<span class="ellipsis">${oppTypeLabel(row.type)}</span><span class="n strong">${num(row.score)}</span></a>`)
          : empty({ status: "zero", title: "Ninguna abierta para este SKU", body: (p.insights ?? []).length ? undefined : "El motor no encontró una regla que se cumpla con los datos actuales, o el SKU queda fuera del set que evalúa." })}`,
  );
  const myDrafts = drafts.ok ? (drafts.data.drafts ?? []).filter((row) => row.parent_sku === sku) : [];
  mount(
    ctx.slot("drafts"),
    html`<h2 style="font-size: 15px; font-weight: 650;">Borradores</h2>
      ${!drafts.ok
        ? errorState(drafts.error, "los borradores")
        : myDrafts.length
          ? myDrafts.map((row) => html`<a class="rows-row" href="#/contenido/${encodeURIComponent(row.id)}" style="--cols: minmax(0, 1fr) auto; padding: 9px 0;"><span class="mono small">${row.kind}</span>${chip(row.status === "approved" ? "ok" : "zero", row.status)}</a>`)
          : html`<p class="small muted">Sin borradores para ${sku}.</p>`}
      ${ctx.can("content.generate") ? html`<a class="btn btn-sm" href="#/contenido?sku=${encodeURIComponent(sku)}" style="align-self: flex-start;">Generar borrador</a>` : ""}`,
  );
}

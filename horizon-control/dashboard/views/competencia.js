// Competencia: allowlisted URLs only, one snapshot every 12 h, robots.txt respected. Facts, no price advice.
import { html, mount } from "../core/html.js";
import { attempt } from "../core/api.js";
import { ago, dateTime, decimal, money, num } from "../core/format.js";
import { chip, empty, errorState, loading, notConfigured, pip } from "../ui/components.js";

export const crumb = () => "Competencia";

const CHANGE_LABEL = {
  new: "nuevo",
  removed: "ya no está",
  price_up: "sube precio",
  price_down: "baja precio",
  promo_change: "cambia promo",
  title_change: "cambia título",
  h1_change: "cambia H1",
};

function host(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function snapshotCard(snap, open) {
  const down = snap.error || (snap.status != null && snap.status >= 400);
  return html`<article class="panel pad stack" style="gap: 12px;">
    <header class="row">
      ${pip(down ? "warning" : "ok")}
      <h2 style="font-size: 18px; font-weight: 700;">${snap.competitor || host(snap.url)}</h2>
      <span class="mono small push" style="color: ${down ? "var(--warn)" : "var(--ok)"};">${snap.status != null ? `HTTP ${snap.status}` : "sin respuesta"}</span>
    </header>
    ${down
      ? html`<div class="empty warn"><span class="t">${snap.status === 403 ? "El sitio rechaza el snapshot." : "El sitio no respondió bien."}</span><span class="b">${snap.status === 403 ? "Es la respuesta real del servidor, no una falla de Control. Mientras siga así no aporta pares al índice de precio." : snap.error ?? ""}</span></div>`
      : ""}
    <div class="kv">
      <span>URL</span><span class="mono xs ellipsis"><a href="${snap.url}" target="_blank" rel="noopener">${snap.url}</a></span>
      <span>Segmento</span><span>${snap.segment ?? "—"}</span>
      ${down ? "" : html`<span>Title</span><span class="ellipsis">${snap.title ?? "—"}</span><span>H1</span><span class="ellipsis">${snap.h1 ?? "—"}</span>`}
      <span>Productos</span><span>${snap.product_count != null ? num(snap.product_count) : "—"}</span>
      <span>Rango de precio</span><span>${snap.price_min != null ? `${money(snap.price_min)} – ${money(snap.price_max)}` : "—"}</span>
      <span>robots.txt</span><span>${snap.robots_allowed === false ? "no permite" : snap.robots_allowed ? "permite" : "—"}</span>
      <span>Extractor</span><span class="mono xs">${snap.extractor ?? "—"}</span>
      <span>Snapshot</span><span>${snap.checked_at ? `${dateTime(snap.checked_at)} · ${ago(snap.checked_at)}` : "—"}</span>
    </div>
    ${!down && snap.product_count ? html`<a class="small strong" href="#/competencia?item=${encodeURIComponent(snap.url)}">${open ? "Ocultar productos" : "Ver productos del snapshot →"}</a>` : ""}
    ${open ? html`<div data-slot="item">${loading(4)}</div>` : ""}
  </article>`;
}

export async function render(ctx) {
  const compareId = ctx.query.id ?? "";
  const itemUrl = ctx.query.item ?? "";
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div><h1 class="disp">Competencia</h1><p>Solo las URLs de la lista permitida, una foto cada 12 h y respetando robots.txt. Lo que muestra son hechos; no sugiere precios.</p></div>
        <span class="small muted" data-slot="meta"></span>
      </section>
      <section class="grid-auto" style="--min: 420px;" data-slot="snaps">${loading(4)}</section>
      <section class="grid-auto" style="--min: 460px;">
        <article class="panel pad stack" data-slot="changes">${loading(4)}</article>
        <article class="panel pad stack" style="gap: 14px;">
          <h2 style="font-size: 15px; font-weight: 650;">Comparar un SKU con su segmento</h2>
          <form class="row" data-act="compare"><label class="sr" for="cmp-id">SKU</label><input id="cmp-id" class="field mono" data-search style="flex: 1;" placeholder="001-CAL-AZU" value="${compareId}"><button type="submit" class="btn btn-act">Comparar</button></form>
          <div data-slot="compare">${compareId ? loading(3) : html`<p class="small muted">Elegí un SKU para ver su precio contra la mediana del segmento y el surtido del competidor.</p>`}</div>
        </article>
      </section>`,
  );
  ctx.on("submit", '[data-act="compare"]', (event) => {
    event.preventDefault();
    ctx.nav.setQuery({ id: ctx.root.querySelector("#cmp-id").value.trim().toUpperCase() || undefined }, { replace: false });
  });

  const [list, changes] = await Promise.all([attempt("/v1/competition"), attempt("/v1/competition/changes")]);
  if (!ctx.alive()) return;
  if (!list.ok) mount(ctx.slot("snaps"), errorState(list.error, "la competencia"));
  else if (list.data.configured === false) mount(ctx.slot("snaps"), notConfigured(list.data.reason, "Sin URLs de competencia"));
  else {
    const snaps = list.data.snapshots ?? [];
    mount(ctx.slot("meta"), `${num(snaps.length)} de 8 URLs permitidas${list.data.fetched_at ? ` · último snapshot ${ago(list.data.fetched_at)}` : ""}`);
    mount(
      ctx.slot("snaps"),
      snaps.length ? snaps.map((snap) => snapshotCard(snap, itemUrl === snap.url)) : empty({ status: "zero", title: "Sin snapshots todavía", body: "El job competitor.snapshot corre cada 12 h." }),
    );
    if (itemUrl) {
      void ctx.fill(
        "item",
        attempt(`/v1/competition/item?url=${encodeURIComponent(itemUrl)}`).then((r) => {
          if (!r.ok) throw r.error;
          return r.data;
        }),
        (data) => {
          const products = data.products ?? [];
          return products.length
            ? html`<div class="rows flush" style="--cols: minmax(0, 1fr) 90px 90px;">
                <div class="rows-head"><span>Producto</span><span class="n">Precio</span><span class="n">Antes</span></div>
                ${products.slice(0, 40).map((row) => html`<div class="rows-row small"><span class="ellipsis">${row.product_url ? html`<a href="${row.product_url}" target="_blank" rel="noopener">${row.title}</a>` : row.title}</span><span class="n">${money(row.price)}</span><span class="n muted">${row.compare_at ? money(row.compare_at) : "—"}</span></div>`)}
              </div>`
            : html`<p class="small muted">El snapshot no trae productos.</p>`;
        },
        { what: "los productos del snapshot" },
      );
    }
  }

  if (!changes.ok) mount(ctx.slot("changes"), errorState(changes.error, "los cambios"));
  else {
    const rows = changes.data.changes ?? [];
    mount(
      ctx.slot("changes"),
      html`<header class="panel-head"><h2>Cambios desde el snapshot anterior</h2><span class="small muted push">${num(rows.length)}</span></header>
        ${rows.length
          ? html`<div class="rows flush" style="--cols: 110px minmax(0, 1fr) minmax(0, 0.8fr);">
              ${rows.slice(0, 60).map(
                (row) => html`<div class="rows-row small">
                  <span class="mono xs" style="color: ${row.type === "price_down" ? "var(--warn)" : row.type === "removed" ? "var(--ink-3)" : "var(--ink-2)"};" title="${row.type}">${CHANGE_LABEL[row.type] ?? row.type}</span>
                  <span class="ellipsis">${row.title || host(row.url)}</span>
                  <span class="n mono xs">${row.before != null || row.after != null
                    ? /^price_/.test(row.type)
                      ? `${money(row.before)} → ${money(row.after)}`
                      : `${row.before ?? "—"} → ${row.after ?? "—"}`
                    : ""}</span>
                </div>`,
              )}
            </div>`
          : empty({ status: "zero", title: "Sin cambios", body: "Hace falta un snapshot anterior para comparar, o nada cambió entre los dos últimos." })}`,
    );
  }

  if (compareId) {
    void ctx.fill(
      "compare",
      attempt(`/v1/competition/compare?id=${encodeURIComponent(compareId)}`).then((r) => {
        if (!r.ok) throw r.error;
        return r.data;
      }),
      (data) => {
        if (data.configured === false) return notConfigured(data.reason, "Sin URLs de competencia");
        if (!data.found) return empty({ status: "zero", title: `No encontré ${compareId}`, body: "No se inventa un índice." });
        const idx = data.price_index;
        const outlier = idx?.index != null && (idx.index < 0.7 || idx.index > 1.3);
        return html`
          <div class="grid-auto" style="--min: 140px; gap: 12px;">
            <div class="well stack" style="gap: 4px;"><span class="lbl">Horizon</span><span class="disp" style="font-size: 30px;">${money(data.horizon_price)}</span><span class="xs muted">${data.parent_sku}</span></div>
            <div class="well stack" style="gap: 4px;"><span class="lbl">Mediana ${data.segment ?? ""}</span><span class="disp" style="font-size: 30px;">${idx?.median != null ? money(idx.median) : "—"}</span><span class="xs muted">n = ${num(idx?.n ?? 0)} pares</span></div>
            <div class="well stack" style="gap: 4px;"><span class="lbl">Índice</span><span class="disp" style="font-size: 30px;">${idx?.index != null ? decimal(idx.index, 2) : "—"}</span><span class="xs muted">${idx?.index == null ? "hacen falta 2 pares con precio" : outlier ? "fuera de 0,7–1,3 → PRICE_OUTLIER" : "dentro de 0,7–1,3"}</span></div>
          </div>
          ${data.assortment
            ? html`<div class="stack small" style="gap: 6px;"><span class="lbl">Surtido del segmento</span><span>Horizon tiene <strong>${num(data.assortment.horizon_count)}</strong>; la competencia, <strong>${num(data.assortment.competitor_count)}</strong>.</span>
                ${(data.assortment.unmatched_titles ?? []).length ? html`<span class="muted">Sin par en Horizon: ${data.assortment.unmatched_titles.slice(0, 6).join(" · ")}</span>` : ""}</div>`
            : ""}
          ${(data.peers ?? []).length
            ? html`<div class="rows flush" style="--cols: minmax(0, 1fr) 90px;"><div class="rows-head"><span>Pares</span><span class="n">Precio</span></div>${data.peers.slice(0, 12).map((row) => html`<div class="rows-row small"><span class="ellipsis">${row.title ?? row.competitor ?? "—"}</span><span class="n">${money(row.price)}</span></div>`)}</div>`
            : ""}
          <p class="xs muted">El índice describe dónde está el precio. La decisión de precio no sale de esta pantalla.</p>`;
      },
      { what: "la comparación" },
    );
  }
}

// Catálogo: read-only search over the public Store API, joined with SEO, Merchant and Growth.
import { html, mount } from "../core/html.js";
import { attempt } from "../core/api.js";
import { money, num } from "../core/format.js";
import { chip, colorOf, empty, errorState, loading } from "../ui/components.js";

export const crumb = () => "Catálogo";

const CATEGORIES = [
  ["", "Todas"],
  ["tops", "Tops"],
  ["calzas", "Calzas"],
  ["shorts", "Shorts"],
  ["camperas", "Camperas"],
  ["faldas", "Faldas"],
];
const LIMIT = 20;

function seoFor(product, pages) {
  if (!pages) return chip("unknown", "sin auditoría");
  const slug = product.slug;
  const page = pages.find((row) => row.slug === slug || String(row.url ?? "").includes(`/producto/${slug}/`) || String(row.url ?? "").includes(`/product/${slug}/`));
  if (!page) return chip("unknown", "no auditada");
  if (page.critical) return chip("error", `${num(page.critical)} ${page.critical === 1 ? "crítico" : "críticos"}`);
  if (page.warning) return html`<span class="small warn-t strong">${num(page.warning)} warnings</span>`;
  return chip("ok", "ok");
}

function merchantFor(product, merchant) {
  if (!merchant || merchant.source === "unavailable") return chip("not_configured", "—");
  const sku = product.parent_sku || product.sku;
  const blocked = (merchant.summary?.problems ?? []).filter((row) => String(row.sku ?? "").startsWith(sku) && row.ready === false);
  return blocked.length ? chip("error", `${blocked.length} bloq.`) : chip("ok", "lista");
}

export async function render(ctx) {
  const q = ctx.query.q ?? "";
  const cat = ctx.query.cat ?? "";
  const size = ctx.query.size ?? "";
  const stock = ctx.query.stock ?? "";
  const page = Math.max(1, Number(ctx.query.page || 1));
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div><h1 class="disp">Catálogo</h1><p>Lectura del Store API público. Para editar está wp-admin; acá se busca y se entra al 360.</p></div>
        ${ctx.cfg?.wpAdminUrl ? html`<a class="btn btn-ghost" href="${ctx.cfg.wpAdminUrl}/edit.php?post_type=product" target="_blank" rel="noopener">Abrir wp-admin ↗</a>` : ""}
      </section>
      <form class="row wrap" style="gap: 12px;" data-act="search">
        <label class="sr" for="cat-q">Buscar producto</label>
        <input id="cat-q" class="field" data-search style="width: 320px;" placeholder="SKU (001-TOP-AZU), nombre o slug" value="${q}">
        <button type="submit" class="btn">Buscar</button>
        <div class="seg" role="group" aria-label="Categoría">${CATEGORIES.map(([id, text]) => html`<button type="button" data-cat="${id}" aria-pressed="${id === cat}">${text}</button>`)}</div>
        <label class="inline">Talle <select class="field" data-filter="size" style="height: 30px;">${["", "XS", "S", "M", "L", "XL"].map((v) => html`<option value="${v}" ${v === size ? "selected" : ""}>${v || "Todos"}</option>`)}</select></label>
        <label class="inline">Stock <select class="field" data-filter="stock" style="height: 30px;">${[["", "Todos"], ["instock", "Con stock"], ["outofstock", "Sin stock"], ["onbackorder", "Por encargo"]].map(([v, t]) => html`<option value="${v}" ${v === stock ? "selected" : ""}>${t}</option>`)}</select></label>
      </form>
      <article class="panel" style="overflow-x: auto;" data-slot="table">${loading(8)}</article>`,
  );

  ctx.on("submit", '[data-act="search"]', (event) => {
    event.preventDefault();
    ctx.nav.setQuery({ q: ctx.root.querySelector("#cat-q").value.trim() || undefined, page: undefined }, { replace: false });
  });
  ctx.on("click", "[data-cat]", (_, t) => ctx.nav.setQuery({ cat: t.dataset.cat || undefined, page: undefined }));
  ctx.on("change", "[data-filter]", (_, t) => ctx.nav.setQuery({ [t.dataset.filter]: t.value || undefined, page: undefined }));
  ctx.on("click", "[data-page]", (_, t) => ctx.nav.setQuery({ page: t.dataset.page === "1" ? undefined : t.dataset.page }));

  const fullSku = /^\d{3}-[a-z]{3}-[a-z]{3}$/i.test(q.trim());
  const params = new URLSearchParams({ limit: String(LIMIT), page: String(page) });
  if (q && !fullSku) params.set("q", q);
  if (cat) params.set("category", cat);
  if (size) params.set("size", size);
  if (stock) params.set("stock_status", stock);
  const [products, seo, merchant, opps] = await Promise.all([
    fullSku ? attempt(`/v1/catalog/products/${encodeURIComponent(q.trim().toUpperCase())}`) : attempt(`/v1/catalog/products?${params}`),
    attempt("/v1/seo/audits/latest"),
    attempt("/v1/merchant/diagnostics"),
    attempt("/v1/growth/opportunities?status=open"),
  ]);
  if (!ctx.alive()) return;
  if (!products.ok) {
    mount(ctx.slot("table"), html`<div class="pad">${products.error?.status === 404 ? empty({ status: "zero", title: `No hay producto con SKU ${q.toUpperCase()}` }) : errorState(products.error, "el catálogo")}</div>`);
    return;
  }
  const rows = fullSku ? [products.data] : products.data.products ?? [];
  const pages = seo.ok && seo.data.configured !== false ? seo.data.summary?.pages ?? [] : null;
  const oppBySku = new Map();
  if (opps.ok) for (const row of opps.data.opportunities ?? []) if (!oppBySku.has(row.parent_sku) || oppBySku.get(row.parent_sku).score < row.score) oppBySku.set(row.parent_sku, row);
  if (!rows.length) {
    mount(ctx.slot("table"), html`<div class="pad">${empty({ status: "zero", title: "Sin resultados", body: "Probá con otro nombre, un SKU completo o sacá filtros." })}</div>`);
    return;
  }
  const cols = "26px minmax(0, 1.4fr) 120px 110px 84px 92px 84px 116px 96px 118px";
  mount(
    ctx.slot("table"),
    html`<div class="rows" style="--cols: ${cols}; min-width: 1060px;">
      <div class="rows-head"><span></span><span>Producto</span><span>SKU</span><span>Categoría</span><span>Color</span><span class="n">Precio</span><span>Stock</span><span>SEO PDP</span><span>Merchant</span><span>Oportunidad</span></div>
      ${rows.map((product) => {
        const sku = product.parent_sku || product.sku;
        const color = colorOf(product.attributes?.Color?.[0] ?? product.attributes?.color?.[0] ?? product.name);
        const opp = oppBySku.get(sku);
        const sizes = product.attributes?.Talle ?? product.attributes?.talle ?? [];
        return html`<a class="rows-row" href="#/producto/${encodeURIComponent(sku)}">
          <span aria-hidden="true" style="width: 18px; height: 18px; border-radius: 5px; border: 1px solid var(--line); background: ${color?.hex ?? "var(--s3)"};"></span>
          <span class="ellipsis" style="font-weight: 560;">${product.name}</span>
          <span class="mono small soft">${sku}</span>
          <span class="soft ellipsis">${product.categories?.[0]?.name ?? "—"}</span>
          <span class="soft">${product.attributes?.Color?.[0] ?? color?.name ?? "—"}</span>
          <span class="n strong">${money(product.price?.amount)}</span>
          <span class="small soft">${product.stock_status === "outofstock" ? html`<span class="bad-t strong">Sin stock</span>` : product.stock_status === "onbackorder" ? "Encargo" : sizes.length ? sizes.join(" · ") : "Con stock"}</span>
          <span>${seoFor(product, pages)}</span>
          <span>${merchantFor(product, merchant.ok ? merchant.data : null)}</span>
          <span class="small ${opp ? "" : "muted"}">${opp ? `${opp.type === "PRICE_OUTLIER" ? "Precio" : "Score"} ${num(opp.score)}` : "—"}</span>
        </a>`;
      })}
      <div class="row wrap small muted" style="padding: 12px 18px; gap: 12px;">
        <span>${fullSku ? "Búsqueda por SKU exacto" : `${num(rows.length)} en esta página`}</span>
        ${merchant.ok && merchant.data.source !== "unavailable" ? html`<span>· Merchant: ${num(merchant.data.summary?.ready)} variantes listas, ${num(merchant.data.summary?.blocked ?? 0)} bloqueadas</span>` : ""}
        ${fullSku
          ? ""
          : html`<span class="row push" style="gap: 6px;">
              <button type="button" class="btn btn-sm" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>← Anterior</button>
              <span style="padding: 0 6px;">Página ${num(page)}</span>
              <button type="button" class="btn btn-sm" data-page="${page + 1}" ${rows.length < LIMIT ? "disabled" : ""}>Siguiente →</button>
            </span>`}
      </div>
    </div>`,
  );
}

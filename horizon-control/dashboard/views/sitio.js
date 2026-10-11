// Sitio: the real storefront inside a monitor frame, plus an inspector of what is on screen.
import { html, mount } from "../core/html.js";
import { attempt } from "../core/api.js";
import { money, num } from "../core/format.js";
import { chip, empty, errorState, loading } from "../ui/components.js";
import { isAvailable } from "../core/slice.js";

export const crumb = () => "Sitio · horizonfit.com.ar";

function origin(cfg) {
  try {
    return new URL(cfg?.storefrontUrl || "https://horizonfit.com.ar").origin;
  } catch {
    return "https://horizonfit.com.ar";
  }
}

/** Only storefront URLs are embedded; anything else falls back to the home. */
export function safeEmbedUrl(raw, base) {
  try {
    const url = new URL(raw || "/", base);
    if (url.origin !== base || (url.protocol !== "https:" && url.protocol !== "http:")) return `${base}/`;
    return url.toString();
  } catch {
    return `${base}/`;
  }
}

function strings(value, acc = []) {
  if (typeof value === "string") acc.push(value);
  else if (Array.isArray(value)) value.forEach((row) => strings(row, acc));
  else if (value && typeof value === "object") Object.values(value).forEach((row) => strings(row, acc));
  return acc;
}

function configRows(config) {
  const piece = (key) => config?.[key] ?? { status: "unavailable", data: null };
  const st = (p) => (p.status === "ok" ? "ok" : "unknown");
  const marquee = piece("marquee");
  const menu = piece("menu");
  const sections = piece("home_sections");
  const hero = piece("hero");
  const menuItems = Array.isArray(menu.data) ? menu.data : [];
  const sectionItems = Array.isArray(sections.data) ? sections.data : [];
  const heroText = strings(hero.data).filter((s) => !/^https?:/.test(s)).slice(0, 2).join(" · ");
  return [
    ["Marquee", st(marquee), strings(marquee.data).slice(0, 3).join(" · ") || "—"],
    ["Hero", st(hero), heroText || (hero.status === "ok" ? "sin texto configurado" : "—")],
    ["Menú", st(menu), menuItems.length ? menuItems.map((row) => row.label).filter(Boolean).join(" · ") : "—"],
    [
      "Secciones",
      st(sections),
      sectionItems.length
        ? `${num(sectionItems.filter((row) => row.visible !== false).length)} visibles de ${num(sectionItems.length)}: ${sectionItems.filter((row) => row.visible !== false).map((row) => row.type).join(", ")}`
        : "—",
    ],
  ];
}

export async function render(ctx) {
  const base = origin(ctx.cfg);
  const url = safeEmbedUrl(ctx.query.u || "/", base);
  const path = new URL(url).pathname;
  const width = ctx.query.vw === "390" ? "390" : "desktop";
  const isPdp = /^\/(producto|product)\/[^/]+\/?$/.test(path);
  mount(
    ctx.root,
    html`<div class="row wrap" style="align-items: flex-start; gap: 20px;">
      <section class="stack" style="flex: 999 1 560px; min-width: 0; gap: 10px;">
        <form class="row wrap" style="gap: 8px;" data-act="go">
          <button type="button" class="btn btn-sm" data-path="/">Home</button>
          <button type="button" class="btn btn-sm" data-path="/coleccion/">Colección</button>
          <label class="sr" for="site-url">Dirección</label>
          <div class="urlbar"><span class="pip" data-v="ok"></span><input id="site-url" data-search value="${url.replace(/^https?:\/\//, "")}"></div>
          <div class="seg" role="group" aria-label="Ancho">
            <button type="button" data-vw="desktop" aria-pressed="${width === "desktop"}">Desktop</button>
            <button type="button" data-vw="390" aria-pressed="${width === "390"}">390</button>
          </div>
          <a class="btn btn-sm" href="${url}" target="_blank" rel="noopener">Abrir ↗</a>
        </form>
        <div class="monitor" data-width="${width}">
          <div class="monitor-bar"><i></i><i></i><i></i><span style="margin-left: 10px;">${url}</span></div>
          <iframe title="Storefront de Horizon Fit" src="${url}" referrerpolicy="no-referrer" loading="eager"></iframe>
        </div>
        <p class="xs muted">El storefront real dentro de un marco. Control no lo modifica; si navegás adentro del sitio, la barra no se entera (otro origen).</p>
      </section>
      <aside class="stack" style="flex: 1 1 320px; max-width: 400px; gap: 14px;">
        <article class="panel pad stack" data-slot="product">${isPdp ? loading(3) : ""}</article>
        <article class="panel pad stack" style="gap: 4px;" data-slot="config">${loading(4)}</article>
      </aside>
    </div>`,
  );

  const go = (next, extra = {}) => ctx.nav.setQuery({ u: next === "/" ? undefined : next, ...extra }, { replace: false });
  ctx.on("click", "[data-path]", (_, t) => go(t.dataset.path));
  ctx.on("click", "[data-vw]", (_, t) => ctx.nav.setQuery({ vw: t.dataset.vw === "390" ? "390" : undefined }));
  ctx.on("submit", '[data-act="go"]', (event) => {
    event.preventDefault();
    const value = ctx.root.querySelector("#site-url").value.trim();
    const next = safeEmbedUrl(/^https?:\/\//.test(value) ? value : `https://${value.replace(/^\/+/, "")}`, base);
    go(new URL(next).pathname + new URL(next).search);
  });

  if (!isPdp) {
    mount(ctx.slot("product"), html`<span class="lbl">En pantalla</span><p class="small muted">Navegá a una PDP (/producto/…) para ver su precio, stock, SEO y Merchant acá.</p>`);
  } else {
    void ctx.fill(
      "product",
      attempt(`/v1/insights/products?id=${encodeURIComponent(url)}`).then((r) => {
        if (!r.ok) throw r.error;
        return r.data;
      }),
      (p) => {
        const cat = p.catalog?.data ?? {};
        const sku = p.keys?.parent_sku;
        return html`<span class="lbl">En pantalla</span>
          <div style="display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 12px; align-items: center;">
            ${cat.images?.[0] ? html`<img src="${cat.images[0]}" alt="${cat.name ?? sku}" style="width: 64px; height: 84px; object-fit: cover; object-position: 50% 20%; border-radius: 6px;">` : html`<span class="p-img ph" style="width: 64px; height: 84px;"></span>`}
            <div class="stack" style="gap: 3px;"><span class="mono xs muted">${sku}</span><span style="font-size: 15px; font-weight: 650;">${cat.name ?? "—"}</span><span class="small">${money(cat.price?.amount)} · ${(cat.variants ?? []).map((v) => v.size).filter(Boolean).join(" ") || cat.stock_status}</span></div>
          </div>
          <div class="row wrap" style="gap: 6px;">
            ${isAvailable(p.seo) ? (p.seo.data.critical ? chip("error", `SEO ${num(p.seo.data.critical)} críticos`) : chip("ok", "SEO ok")) : chip(p.seo?.status ?? "unknown", "SEO")}
            ${isAvailable(p.merchant) ? (p.merchant.data.blocked ? chip("error", `Merchant ${num(p.merchant.data.blocked)} bloq.`) : chip("zero", "Merchant 0 bloq.")) : chip(p.merchant?.status ?? "unknown", "Merchant")}
            ${isAvailable(p.sales) ? chip(p.sales.status, `${num(p.sales.data.d30?.units ?? 0)} u. 30 d`) : chip(p.sales?.status ?? "unknown", "Ventas")}
          </div>
          <div class="row" style="gap: 8px;"><a class="btn btn-act btn-sm" href="#/producto/${encodeURIComponent(sku)}">Product 360</a><button type="button" class="btn btn-sm" data-ask="${`¿Cómo viene ${sku}?`}">Preguntar</button></div>`;
      },
      { what: "este producto" },
    );
    ctx.on("click", "[data-ask]", (_, t) => ctx.consulta.ask(t.dataset.ask));
  }

  const config = await attempt("/v1/storefront/config");
  if (!ctx.alive()) return;
  if (!config.ok) return mount(ctx.slot("config"), errorState(config.error, "la config del storefront"));
  const rows = configRows(config.data);
  mount(
    ctx.slot("config"),
    html`<div class="row spread" style="padding-bottom: 6px;"><span class="lbl">Config viva del storefront</span><span class="mono xs muted">storefront.get_config</span></div>
      ${rows.every(([, st]) => st !== "ok")
        ? empty({ status: "unknown", title: "No se pudo leer la config", body: "Ni el cache local ni el cache público del API respondieron." })
        : rows.map(
            ([name, st, text]) => html`<div style="display: grid; grid-template-columns: 80px minmax(0, 1fr) auto; gap: 10px; align-items: start; padding: 9px 0; border-top: 1px solid var(--hair); font-size: 12.5px;">
              <span class="muted">${name}</span><span>${text}</span>${chip(st)}
            </div>`,
          )}`,
  );
}

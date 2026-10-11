// Local fixtures for QA (HORIZON_DASHBOARD_FIXTURES=1, never in production). Same shapes as /v1.
// Catalog, storefront config and today's headline numbers are real; per-SKU analytics, scores,
// daily series and breakdowns are illustrative so every state can be exercised without Auth0.
// Scenarios: ?scenario=hoy (default) · cold (nothing configured) · errors (failures and 403s).
import { ApiError } from "../core/api.js";

const CATALOG = `001-TOP-AZU|Top Dynamic blue|top-liso-azul|67000
001-TOP-VER|Top Dynamic green|top-liso-verde|67000
001-TOP-CEL|Top Dynamic sky blue|top-liso-celeste|67000
001-CAL-NEG|Calza Dynamic black|calza-dynamic-negra|86700
001-TOP-BLA|Top Dynamic white|top-liso-blanco|67000
001-CAL-VER|Calza Dynamic green|calza-dynamic-verde|86700
001-CAL-BLA|Calza Dynamic white|calza-dynamic-blanca|86700
001-CAL-CEL|Calza Dynamic sky blue|calza-dynamic-celeste|86700
001-SHO-NEG|Short Dynamic black|short-liso-negro|70100
001-CAL-AZU|Calza Dynamic blue|calza-dynamic-azul|86700
001-SHO-VER|Short Dynamic green|short-liso-verde|70100
001-SHO-CEL|Short Dynamic sky blue|short-liso-celeste|70100
001-SHO-AZU|Short Dynamic blue|short-liso-azul|70100
001-CAM-BLA|Campera Dynamic white|campera-lisa-blanca|110000
001-CAM-VER|Campera Dynamic green|campera-lisa-verde|110000
001-CAM-AZU|Campera Dynamic blue|campera-lisa-azul|110000
001-CAM-NEG|Campera Dynamic black|campera-lisa-negra|110000
003-TOP-BLA|Top Vanguard white|top-rustico-blanco|74000
003-TOP-ROJ|Top Vanguard red|top-rustico-rojo|74000
003-TOP-AZU|Top Vanguard blue|top-rustico-azul|74000
003-TOP-NEG|Top Vanguard black|top-rustico-negro|74000
003-SHO-BLA|Short Vanguard white|short-rustico-blanco|72000
003-SHO-ROJ|Short Vanguard red|short-rustico-rojo|72000
003-SHO-NEG|Short Vanguard black|short-rustico-negro|72000
003-SHO-AZU|Short Vanguard blue|short-rustico-azul|72000
003-CAM-AZU|Campera Vanguard blue|campera-rustico-azul|120000
003-CAM-NEG|Campera Vanguard black|campera-rustico-negro|120000
003-CAM-BLA|Campera Vanguard white|campera-rustico-blanco|120000
003-CAM-ROJ|Campera Vanguard red|campera-rustico-rojo|120000
002-TOP-ROS|Top Heaven pink|top-tiras-blancas-rosa|71000
002-TOP-CEL|Top Heaven sky blue|top-tiras-blancas-celeste|71000
002-TOP-NEG|Top Heaven black|top-tiras-blancas-negro|71000
002-SHO-ROS|Short Heaven pink|short-tiras-blancas-rosa|76000
002-SHO-CEL|Short Heaven sky blue|short-tiras-blancas-celeste|76000
002-SHO-NEG|Short Heaven black|short-tiras-blancas-negro|76000
002-CAL-CEL|Calza Heaven sky blue|calza-heaven-celeste|87000
002-CAL-NEG|Calza Heaven black|calza-heaven-negra|87000
005-TOP-NEG|Top Destiny black|top-rejilla-negro|73000
002-CAL-ROS|Calza Heaven pink|calza-heaven-rosa|87000
001-SHO-BLA|Short Dynamic white|short-liso-blanco|70100
005-CAL-NEG|Calza Destiny black|calza-destiny-negra|88000
005-TOP-BLA|Top Destiny white|top-rejilla-blanco|73000
005-SHO-BLA|Short Destiny white|short-rejilla-blanco|71000
005-CAL-BLA|Calza Destiny white|calza-destiny-blanca|88000
004-TOP-BOR|Top Zenith wine|top-falda-bordo|70000
004-TOP-AZU|Top Zenith blue|top-falda-azul|78000
004-TOP-NEG|Top Zenith black|top-falda-negro|78000
004-FAL-BOR|Falda Zenith wine|falda-conjunto-falda-bordo|100000
004-FAL-NEG|Falda Zenith black|falda-conjunto-falda-negro|100000
004-FAL-AZU|Falda Zenith blue|falda-conjunto-falda-azul|100000
001-TOP-NEG|Top Dynamic black|top-liso-negro|67000`;

const CATEGORY = { Top: ["Tops", "tops"], Calza: ["Calzas", "calzas"], Short: ["Shorts", "shorts"], Campera: ["Camperas", "camperas"], Falda: ["Faldas", "faldas"] };
const COLOR = { blue: "Azul", green: "Verde", "sky blue": "Celeste", black: "Negro", white: "Blanco", red: "Rojo", pink: "Rosa", wine: "Bordó" };
const IMAGES = { "004-TOP-BOR": ["https://api.horizonfit.com.ar/wp-content/uploads/2026/06/DSC02407-1-683x1024.jpg"] };

const PRODUCTS = CATALOG.split("\n").map((line, i) => {
  const [sku, name, slug, price] = line.split("|");
  const [kind] = name.split(" ");
  const colorKey = Object.keys(COLOR).sort((a, b) => b.length - a.length).find((c) => name.endsWith(c));
  const [catName, catSlug] = CATEGORY[kind];
  return {
    id: 200 + i,
    parent_sku: sku,
    sku,
    slug,
    name,
    status: "publish",
    categories: [{ name: catName, slug: catSlug }],
    description: "",
    short_description: "",
    images: IMAGES[sku] ?? [],
    attributes: { Talle: ["S", "M", "L"], Color: [COLOR[colorKey] ?? colorKey] },
    variations: ["S", "M", "L"].map((size, v) => ({ id: 1000 + i * 3 + v, sku: `${sku}-${size}`, attributes: [{ name: "Talle", value: size }] })),
    price: { amount: `${price}.00`, currency: "ARS", raw: price },
    stock_status: "instock",
  };
});

const NOW = Date.now();
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const isoDay = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString().slice(0, 10);

const ok = (data, source, extra = {}) => ({ status: "ok", available: true, configured: true, source, fetched_at: iso(12 * MIN), data, ...extra });
const zero = (data, source, reason) => ({ status: "zero", available: true, configured: true, source, reason, fetched_at: iso(2 * MIN), data });
const notConfigured = (source, reason) => ({ status: "not_configured", available: false, configured: false, source, reason, fetched_at: null, data: null });

const WEIGHTS = { revenue_importance: 0.22, demand: 0.16, traffic: 0.16, conversion_gap: 0.18, stock_exposure: 0.1, merchant_exposure: 0.08, seo_opportunity: 0.05, competitive_pressure: 0.05 };
function scored(components) {
  const keys = Object.keys(components);
  const sum = keys.reduce((s, k) => s + WEIGHTS[k], 0);
  const weights_used = Object.fromEntries(keys.map((k) => [k, WEIGHTS[k] / sum]));
  const score = Math.round(keys.reduce((s, k) => s + components[k] * weights_used[k], 0) * 10) / 10;
  return { components, weights_used, score, score_caption: `score uses ${keys.join("+")}; missing components dropped and weights renormalized` };
}

const OPP_ROWS = [
  ["001-TOP-AZU", "H", 60, 90, 28],
  ["001-CAL-NEG", "H", 55, 82, 26],
  ["001-TOP-BLA", "H", 52, 78, 24],
  ["001-CAL-AZU", "P", 50, 75, 22, 36],
  ["001-SHO-NEG", "H", 48, 74, 24],
  ["001-CAL-BLA", "P", 46, 70, 22, 32],
  ["003-TOP-ROJ", "H", 44, 68, 22],
  ["001-TOP-VER", "H", 42, 65, 22],
  ["001-CAL-CEL", "P", 40, 62, 21, 30],
  ["001-TOP-CEL", "H", 40, 60, 21],
  ["001-SHO-AZU", "H", 38, 58, 21],
  ["003-TOP-BLA", "H", 36, 55, 21],
  ["001-CAL-VER", "H", 35, 54, 20],
  ["001-SHO-VER", "H", 34, 53, 20],
  ["001-CAM-NEG", "H", 33, 52, 20],
  ["003-TOP-AZU", "H", 28, 46, 20],
  ["001-SHO-CEL", "H", 25, 42, 20],
];

function buildOpportunities() {
  return OPP_ROWS.map(([sku, kind, demand, traffic, seoOpp, pressure], i) => {
    const product = PRODUCTS.find((p) => p.sku === sku);
    const components = { demand, traffic, seo_opportunity: seoOpp, ...(pressure ? { competitive_pressure: pressure } : {}) };
    const s = scored(components);
    const views = Math.max(7, Math.round(traffic / 10));
    const base = { id: `opp_${String(i + 1).padStart(2, "0")}`, store_id: "horizon-fit", status: "open", detected_at: iso(18 * MIN), updated_at: iso(18 * MIN), snoozed_until: null, parent_sku: sku, product: product.name, ...s, severity: s.score >= 40 ? "warning" : "info" };
    if (kind === "P") {
      const index = 1.3 + pressure / 100;
      return { ...base, type: "PRICE_OUTLIER", metrics: { horizon: Number(product.price.raw), median: Math.round(Number(product.price.raw) / index), index: Math.round(index * 100) / 100, n: 6, peers: 6 }, evidence: [`Precio Horizon ${product.price.raw} vs mediana de segmento ${Math.round(Number(product.price.raw) / index)} (n=6)`], source: "competitors", reason: "price_outlier", recommended_action: "Hecho solamente — no se recomienda bajar el precio", period: "snapshot" };
    }
    return { ...base, type: "HIGH_TRAFFIC_LOW_CONVERSION", metrics: { pdp_views: views, cvr: 0, views_p75: 7, cvr_median: 0 }, evidence: [`PDP views ${views} ≥ P75 7`, "CVR 0 ≤ 50% de mediana 0"], source: "ga4", reason: "high_traffic_low_conversion", recommended_action: "Revisar PDP, precio y oferta", period: "28d" };
  });
}

const SEO_PAGES = [
  ["https://horizonfit.com.ar/", "", "Horizon Fit | Ropa deportiva", 114],
  ["https://horizonfit.com.ar/coleccion/", "", "Horizon Fit | Ropa deportiva y conjuntos", 105],
  ["https://horizonfit.com.ar/producto/top-falda-bordo/", "top-falda-bordo", "Top Zenith wine | Horizon Fit", 146],
  ["https://horizonfit.com.ar/producto/top-liso-azul/", "top-liso-azul", "Top Dynamic blue | Horizon Fit", 146],
  ["https://horizonfit.com.ar/producto/calza-dynamic-negra/", "calza-dynamic-negra", "Calza Dynamic black | Horizon Fit", 146],
  ["https://horizonfit.com.ar/producto/top-liso-blanco/", "top-liso-blanco", "Top Dynamic white | Horizon Fit", 146],
  ["https://horizonfit.com.ar/producto/short-liso-negro/", "short-liso-negro", "Short Dynamic black | Horizon Fit", 146],
  ["https://horizonfit.com.ar/producto/calza-dynamic-azul/", "calza-dynamic-azul", "Calza Dynamic blue | Horizon Fit", 146],
].map(([url, slug, title, desc]) => ({
  url,
  slug,
  title,
  description: "x".repeat(desc),
  critical: 2,
  warning: 0,
  issues: { critical: [{ message: "El HTML inicial no tiene H1." }, { message: "El HTML inicial no incluye imágenes renderizadas." }], warning: [] },
}));

const STOREFRONT = {
  menu: { status: "ok", source: "cache", data: [["Colección completa", "index.html?view=collection", "item"], ["Productos destacados", "#productGrid1", "item"], ["Conjuntos destacados", "#fullSlider", "item"], ["Tops", "/coleccion/tops/", "category"], ["Calzas", "/coleccion/calzas/", "category"], ["Shorts", "/coleccion/shorts/", "category"], ["Camperas", "/coleccion/camperas/", "category"], ["REDES SOCIALES", "#homeSocialStrip", "item"], ["Contacto", "#footerContact", "item"]].map(([label, url, type], i) => ({ label, url, order: (i + 1) * 10, type })) },
  home_sections: { status: "ok", source: "cache", data: [["design-system", true], ["featured-products", true], ["featured-products", true], ["categorias", true], ["marquee", true], ["hero", false], ["instagram", true], ["footer", true], ["trust-bar", true], ["style-edit", true], ["social-strip", true]].map(([type, visible], i) => ({ id: `s${i}`, type, order: i, visible, settings: {} })) },
  hero: { status: "ok", source: "rest", data: [] },
  marquee: { status: "ok", source: "cache", data: { messages: ["3 y 6 cuotas sin interés", "Envío gratis en compras +$40.000", "Cambios y devoluciones sin cargo"] } },
};

function days(range) {
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  if (range === "ytd") return Math.ceil((NOW - new Date(new Date().getFullYear(), 0, 1).getTime()) / DAY);
  return 28;
}

function wave(i, seed, base, amp) {
  return Math.max(0, Math.round(base + amp * Math.sin((i + seed) * 1.7) + amp * 0.6 * Math.cos((i + seed) * 0.9)));
}

function metricValue(metric, daysAgo, seed) {
  if (["revenue", "units", "orders"].includes(metric)) {
    if (daysAgo < 31 || daysAgo % 23 !== 7) return 0;
    return { revenue: 89000, units: 1, orders: 1 }[metric];
  }
  if (metric === "sessions") return wave(daysAgo, seed, 2.2, 1.6);
  if (metric === "users") return wave(daysAgo, seed, 0.5, 0.6);
  if (metric === "purchases") return 0;
  if (metric === "impressions") return wave(daysAgo, seed, 42 - daysAgo * 0.25, 9);
  if (metric === "clicks") return wave(daysAgo, seed, 1.1, 0.9);
  if (metric === "ctr") return Math.round((0.02 + 0.01 * Math.sin(daysAgo + seed)) * 1000) / 1000;
  if (metric === "position") return Math.round((14 + 3 * Math.sin(daysAgo / 3 + seed)) * 10) / 10;
  return 0;
}

const SOURCE_OF = { revenue: "woo_rest_orders", units: "woo_rest_orders", orders: "woo_rest_orders", sessions: "ga4", users: "ga4", purchases: "ga4", clicks: "gsc", impressions: "gsc", ctr: "gsc", position: "gsc" };
const SYNC_AGO = { woo_rest_orders: 2 * MIN, ga4: 12 * MIN, gsc: 5 * HOUR };

function series(params, scenario) {
  const metric = params.get("metric");
  const range = params.get("range") || "28d";
  const compare = params.get("compare") !== "none";
  const sku = params.get("sku") || params.get("entity");
  const source = SOURCE_OF[metric] ?? "ga4";
  const n = days(range);
  if (scenario === "cold") {
    return { store_id: "horizon-fit", entity: "store", parent_sku: null, source, metric, range: { label: range, start: isoDay(n - 1), end: isoDay(0) }, compare: null, current: { points: [], total: 0, status: "unknown" }, previous: null, delta: null, delta_pct: null, note: "", sync: { last_success_at: null, covered_from: null, covered_to: null, last_status: null } };
  }
  const point = (daysAgo, seed) => {
    if (daysAgo === n - 4 && !sku) return { day: isoDay(daysAgo), value: null, status: "unknown", reason: "no_observation" };
    const value = sku ? 0 : metricValue(metric, daysAgo, seed);
    return { day: isoDay(daysAgo), value, status: value ? "ok" : "zero" };
  };
  const current = Array.from({ length: n }, (_, i) => point(n - 1 - i, 1));
  const previous = compare ? Array.from({ length: n }, (_, i) => point(2 * n - 1 - i, 4)) : null;
  const sum = (pts) => pts.reduce((s, p) => s + (p.value ?? 0), 0);
  const total = sum(current);
  const prevTotal = previous ? sum(previous) : null;
  let delta = prevTotal == null ? null : Math.round((total - prevTotal) * 100) / 100;
  if (metric === "impressions" && prevTotal != null) delta = Math.abs(delta) || 120;
  if (metric === "clicks" && prevTotal != null) delta = -Math.max(1, Math.abs(delta || 2));
  return {
    store_id: "horizon-fit",
    entity: sku ? "product" : "store",
    parent_sku: sku || null,
    source,
    metric,
    range: { label: range, start: isoDay(n - 1), end: isoDay(0) },
    compare: compare ? { start: isoDay(2 * n - 1), end: isoDay(n), label: "previous" } : null,
    current: { points: current, total, status: total || current.some((p) => p.status === "zero") ? (total ? "ok" : "zero") : "unknown" },
    previous: previous ? { points: previous, total: prevTotal, status: "ok" } : null,
    delta,
    delta_pct: prevTotal ? Math.round((delta / prevTotal) * 1000) / 1000 : null,
    note: "comparison is the previous window of equal length; not seasonally adjusted",
    sync: { last_success_at: iso(SYNC_AGO[source] ?? HOUR), covered_from: isoDay(89), covered_to: isoDay(0), last_status: "ok", last_reason: null },
  };
}

function insight(product, scenario) {
  const sku = product.sku;
  const opp = state.opportunities.filter((row) => row.parent_sku === sku && row.status === "open");
  const inSet = OPP_ROWS.some(([s]) => s === sku);
  const segment = product.categories[0].slug === "calzas" ? "calzas" : product.categories[0].slug === "tops" ? "tops" : "training-mujer";
  const seoPage = SEO_PAGES.find((row) => row.slug === product.slug);
  const views = inSet ? Math.max(7, 12 - OPP_ROWS.findIndex(([s]) => s === sku) / 2) : 5;
  const d = (n) => ({ orders: 0, units: 0, revenue: 0, aov: null, avg_unit_price: null, units_per_order: null });
  return {
    found: true,
    store_id: "horizon-fit",
    keys: { input: sku, kind: "parent_sku", parent_sku: sku, variant_sku: null, product_id: product.id, variation_id: null, slug: product.slug, canonical_url: `https://horizonfit.com.ar/producto/${product.slug}/` },
    catalog: ok({ name: product.name, price: { amount: product.price.amount, currency: "ARS" }, stock_status: "instock", variants: product.variations.map((v) => ({ sku: v.sku, size: v.attributes[0].value, in_stock: true })), categories: ["Diseño", product.categories[0].name], images: product.images }, "woo_store_api", { fetched_at: iso(0) }),
    sales: scenario === "cold" ? notConfigured("woo_rest_orders", "missing_woo_rest_credentials") : zero({ currency: "ARS", d7: d(7), d30: d(30), d90: sku === "001-TOP-AZU" ? { orders: 1, units: 1, revenue: 67000, aov: 67000, avg_unit_price: 67000, units_per_order: 1 } : d(90), last_sale_at: sku === "001-TOP-AZU" ? iso(47 * DAY) : null, velocity_30d: 0, orders: 0, units: 0, revenue: 0, aov: null }, "woo_rest_orders", "no_paid_orders_in_window"),
    analytics:
      scenario === "cold"
        ? notConfigured("ga4", "missing_google_credentials")
        : sku === "002-CAL-ROS"
          ? { status: "unknown", available: false, configured: true, source: "ga4", reason: "ga4_join_unavailable", fetched_at: iso(12 * MIN), join_confidence: "none", data: null }
          : ok({ period: "28d", join: { item_id: null, page_path: `/producto/${product.slug}/` }, pdp_views: Math.round(views), view_item: Math.round(views), add_to_cart: 1, begin_checkout: 0, purchase: 0, purchase_revenue: 0, atc_rate: Math.round((1 / views) * 1000) / 1000, checkout_rate: 0, cvr: 0 }, "ga4", { join_confidence: "inferred", period: { start: isoDay(27), end: isoDay(0), label: "28d" } }),
    search:
      scenario === "cold"
        ? notConfigured("gsc", "missing_google_credentials")
        : ok({ page: `https://horizonfit.com.ar/producto/${product.slug}/`, clicks: 1, impressions: 38, ctr: 0.026, position: 14.2, queries: [["top bordo deportivo", 1, 9, 11.4], ["top un hombro mujer", 0, 8, 16], [`${product.name.split(" ")[1].toLowerCase()} horizon`, 0, 6, 6.2], ["horizon fit", 0, 5, 4.8]].map(([query, clicks, impressions, position]) => ({ query, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position })) }, "gsc", { fetched_at: iso(5 * HOUR) }),
    seo: seoPage
      ? ok({ title: seoPage.title, description: `Descubrí ${product.name} de Horizon Fit: una prenda de activewear cómoda y funcional para entrenar, combinar con tu set y acompañarte todos los días.`, h1: [], canonical: `https://horizonfit.com.ar/producto/${product.slug}/`, indexable: true, schema: ["ProductGroup"], in_sitemap: true, critical: 2, warning: 0, issues: seoPage.issues, last_audit: iso(7 * HOUR) }, "seo_audit", { fetched_at: iso(7 * HOUR) })
      : { status: "unknown", available: false, configured: true, source: "seo_audit", reason: "seo_page_not_in_audit", fetched_at: iso(7 * HOUR), data: null },
    merchant: zero({ included: true, ready: 3, blocked: 0, variants: product.variations.map((v) => ({ sku: v.sku, parent_sku: sku, ready: true, title: product.name, issues: [] })), generated_path: "merchant-products.json" }, "merchant_feed", "none_blocked"),
    competition: ok({ segment, peers: [{ competitor: "Touche", url: "https://touche.example/", status: 200, title: "Touche", ok: true }, { competitor: "Adidas", url: "https://adidas.example/", status: 403, title: "", ok: false }], price_index: segment === "calzas" ? { horizon: Number(product.price.raw), median: 59800, index: Math.round((Number(product.price.raw) / 59800) * 100) / 100, n: 6 } : null }, "competitors", { join_confidence: "inferred", fetched_at: iso(9 * HOUR) }),
    insights: opp.map((row) => ({ type: row.type, severity: row.severity, entity: sku, metrics: { ...row.metrics, score: row.score }, reason: row.reason, source: row.source, period: row.period })),
  };
}

function draftBody(kind, product) {
  const name = product?.name ?? "producto";
  const bodies = {
    seo_title: `${name} | Horizon Fit`,
    seo_meta: `${name}. Búsqueda observada: top bordo deportivo, top un hombro mujer, horizon fit.`,
    product_description: `${name} · ${product?.categories?.[0]?.name ?? ""}. Texto anclado al catálogo. Sales zero.`,
    collection_copy: `Colección ${product?.categories?.[0]?.name ?? ""}.`,
    ad_copy: `${name} · top bordo deportivo. No se afirma performance sin slice ok.`,
    email_subject: name,
    email_body: `Hola,\n\n${name} está en el catálogo Horizon Fit.\n\nNo se publican cambios a la tienda desde este draft.`,
    instagram_caption: `${name} · top bordo deportivo`,
    creative_brief: `SKU ${product?.sku ?? "—"}\nNombre ${name}\nQueries GSC: top bordo deportivo, top un hombro mujer\nOportunidad: ninguna abierta`,
    image_prompt: `Producto de entrenamiento ${name}, fotografía de catálogo, fondo limpio. Sin texto inventado de precio.`,
  };
  return bodies[kind] ?? name;
}

const state = {
  opportunities: buildOpportunities(),
  drafts: [
    { id: "dr_01", kind: "seo_meta", parent_sku: "001-TOP-AZU", opportunity_id: "opp_01", status: "draft", body: "Top Dynamic blue. Búsqueda observada: top azul deportivo, top dynamic, top deportivo mujer.", notes: "catalog:ok · search:ok · seo:ok · sales:zero · no_publish_to_horizon_fit", model: null, prompt_version: "content.v1", source_context: { parent_sku: "001-TOP-AZU", catalog_status: "ok", search_status: "ok", seo_status: "ok", queries: ["top azul deportivo", "top dynamic", "top deportivo mujer"], opportunity: { type: "HIGH_TRAFFIC_LOW_CONVERSION", reason: "high_traffic_low_conversion" } }, author: "fixtures", created_at: iso(3 * HOUR), updated_at: iso(3 * HOUR) },
    { id: "dr_02", kind: "email_subject", parent_sku: "001-CAL-NEG", opportunity_id: null, status: "approved", body: "Calza Dynamic black", notes: "catalog:ok · search:ok · seo:ok · sales:zero · no_publish_to_horizon_fit", model: null, prompt_version: "content.v1", source_context: { parent_sku: "001-CAL-NEG", catalog_status: "ok", search_status: "ok", seo_status: "ok", queries: [], opportunity: null }, author: "fixtures", created_at: iso(2 * DAY), updated_at: iso(DAY) },
  ],
  alerts: [
    { id: "al_1", store_id: "horizon-fit", rule_id: "seo_critical", severity: "critical", status: "open", title: "Críticos de SEO en el sitio", payload: { critical: 16, source: "seo_audit" }, opened_at: iso(9 * HOUR), updated_at: iso(MIN) },
    { id: "al_2", store_id: "horizon-fit", rule_id: "competitor_down", severity: "warning", status: "open", title: "Competidor caído o bloqueado · adidas", payload: { hosts: ["adidas.example"], status: 403 }, opened_at: iso(9 * HOUR), updated_at: iso(MIN) },
    { id: "al_3", store_id: "horizon-fit", rule_id: "seo_stale", severity: "warning", status: "resolved", title: "Auditoría SEO vieja", payload: { age_h: 31 }, opened_at: iso(3 * DAY), updated_at: iso(2 * DAY) },
  ],
  seoJob: { id: "job_seo_1", type: "seo.audit", status: "succeeded", createdAt: iso(7 * HOUR + 4 * MIN), finishedAt: iso(7 * HOUR), error: null },
  sessionSeq: 0,
};

const CUSTOMERS = [
  { customer_key: "a3f19c07e2b84d55", first_purchase: iso(47 * DAY), last_purchase: iso(47 * DAY), orders: 1, revenue: 67000, aov: 67000, frequency: 1, recency_days: 47, r: 3, f: 1, m: 2, segment: "one_time", categories: ["001-TOP-AZU"], repeat: false, discount_used: true },
  { customer_key: "7c2e0d9b41aa6f13", first_purchase: iso(63 * DAY), last_purchase: iso(63 * DAY), orders: 1, revenue: 86700, aov: 86700, frequency: 1, recency_days: 63, r: 2, f: 1, m: 4, segment: "one_time", categories: ["001-CAL-NEG"], repeat: false, discount_used: false },
  { customer_key: "e81b5f2c9d0374aa", first_purchase: iso(81 * DAY), last_purchase: iso(81 * DAY), orders: 1, revenue: 114000, aov: 114000, frequency: 1, recency_days: 81, r: 1, f: 1, m: 5, segment: "one_time", categories: ["001-CAM-NEG"], repeat: false, discount_used: true },
];

const DASHBOARD_TOOLS = ["ops.health", "catalog.search_products", "catalog.get_product", "storefront.get_config", "seo.get_latest_audit", "seo.audit", "merchant.get_diagnostics", "commerce.sales", "commerce.settings", "insights.get_product", "insights.overview", "metrics.snapshots", "metrics.series", "alerts.list", "alerts.evaluate", "assistant.ask", "analytics.search_console", "analytics.ga4", "analytics.competitors", "competition.list", "competition.get", "competition.changes", "competition.compare_product", "growth.list_opportunities", "growth.get_opportunity", "growth.update_opportunity", "ai.models", "ai.usage", "ai.tools", "ai.chat", "ai.get_session", "content.list_drafts", "content.get_draft", "content.generate", "content.update_draft", "customers.list", "customers.get", "campaigns.list", "ads.status"];

function findProduct(ref) {
  const key = decodeURIComponent(ref).trim();
  const upper = key.toUpperCase();
  const slug = key.match(/\/(?:producto|product)\/([^/?#]+)/)?.[1];
  return PRODUCTS.find((p) => p.sku === upper || p.sku === upper.replace(/-(XS|S|M|L|XL|XXL)$/, "") || p.slug === key || p.slug === slug || String(p.id) === key) ?? null;
}

function scoped(tool) {
  throw new ApiError(403, "insufficient_scope", `missing scope for ${tool}`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createFixtures(scenario = "hoy") {
  const cold = scenario === "cold";
  const errors = scenario === "errors";
  async function respond(rawPath, method = "GET", body = {}) {
    await wait(120 + Math.random() * 260);
    const url = new URL(rawPath, "http://fixtures.local");
    const path = url.pathname;
    const q = url.searchParams;
    const seg = path.split("/").filter(Boolean);

    if (path === "/healthz") return { ok: true, service: "horizon-control", bind: "127.0.0.1", worker: { last_tick_at: iso(800), stopped: false }, integrations: { woo: !cold, google: !cold, ga4: !cold, competitors: !cold, ai: false }, gateway: { configured: false, reason: "missing_ai_provider_keys" } };
    if (path === "/v1/tools") return { tools: DASHBOARD_TOOLS, catalog: [...DASHBOARD_TOOLS, "repo.status", "jobs.get", "audit.history", "merchant.audit", "tests.run"] };
    if (path === "/v1/health") return { status: "healthy", storefront: { url: "https://horizonfit.com.ar", status: 200, latency_ms: 214, ok: true }, api: { url: "https://api.horizonfit.com.ar", status: 200, latency_ms: 187, ok: true }, repo: { head: "0396deae5c1f", branch: "main" }, control_plane: { uptime_s: 9 * 3600, worker: { healthy: true, last_tick_at: iso(800) } }, db: { healthy: true } };

    if (path === "/v1/insights/overview") {
      if (errors) throw new ApiError(500, "server_error", "insights_overview_failed");
      const opps = state.opportunities.filter((r) => r.status === "open");
      return {
        store_id: "horizon-fit",
        fetched_at: iso(2 * MIN),
        revenue: cold ? notConfigured("woo_rest_orders", "missing_woo_rest_credentials") : zero({ currency: "ARS", orders: 0, units: 0, revenue: null, aov: null }, "woo_rest_orders", "no_paid_orders_in_window"),
        demand: cold ? notConfigured("ga4+gsc", "missing_google_credentials") : ok({ sessions: 62, users: 13, clicks: 21, impressions: 1180 }, "ga4+gsc"),
        conversion: cold ? { status: "unknown", available: false, configured: false, source: "ga4", reason: "conversion_needs_ga4_sessions_and_purchases", fetched_at: null, data: null } : ok({ sessions: 62, purchases: 0, cvr: 0 }, "ga4"),
        opportunities: opps.length ? ok({ items: opps.slice(0, 5).map((r) => ({ type: r.type, severity: r.severity, entity: r.parent_sku, metrics: r.metrics, reason: r.reason, source: r.source, period: r.period })) }, "growth_engine") : zero({ items: [] }, "growth_engine", "no_open_opportunities"),
        problems: ok({ items: [{ type: "seo_critical", severity: "critical", title: "16 críticos de SEO" }] }, "warehouse"),
      };
    }
    if (path === "/v1/commerce/sales") {
      if (cold) return { configured: false, reason: "missing_woo_rest_credentials", store_id: "horizon-fit", currency: "ARS", fetched_at: null, incomplete: false, source: "orders", today: { orders: 0, units: 0, revenue: null, aov: null }, week: { orders: 0, units: 0, revenue: null, aov: null }, month: { orders: 0, units: 0, revenue: null, aov: null }, ninety: { orders: 0, units: 0, revenue: null, aov: null }, recent_orders: [], products: [] };
      const empty = { orders: 0, units: 0, revenue: 0, aov: null, currency: "ARS" };
      const rollup = (sku, name, revenue, at) => ({ parent_sku: sku, name, product_id: findProduct(sku).id, slug: findProduct(sku).slug, last_sale_at: at, velocity_30d: 0, d7: { orders: 0, units: 0, revenue: 0, aov: null }, d30: { orders: 0, units: 0, revenue: 0, aov: null }, d90: { orders: 1, units: 1, revenue, aov: revenue }, variants: [{ sku: `${sku}-M`, units_30d: 0, revenue_30d: 0 }] });
      return {
        configured: true, store_id: "horizon-fit", currency: "ARS", fetched_at: iso(2 * MIN), incomplete: false, source: "orders",
        today: empty, week: empty, month: empty, ninety: { orders: 3, units: 3, revenue: 267700, aov: 89233, currency: "ARS" },
        recent_orders: [[1187, 47, "001-TOP-AZU", 67000, "BIENVENIDA10"], [1172, 63, "001-CAL-NEG", 86700, null], [1160, 81, "001-CAM-NEG", 114000, "OTOÑO15"]].map(([id, ago, sku, total, coupon]) => ({ id, status: "completed", total: `${total}.00`, revenue: total, date: iso(ago * DAY), items: [{ sku: `${sku}-M`, parent_sku: sku, quantity: 1 }], customer_key: null, coupon })),
        products: [rollup("001-CAL-NEG", "Calza Dynamic black", 86700, iso(63 * DAY)), rollup("001-CAM-NEG", "Campera Dynamic black", 114000, iso(81 * DAY)), rollup("001-TOP-AZU", "Top Dynamic blue", 67000, iso(47 * DAY))],
      };
    }
    if (path === "/v1/commerce/settings") return cold ? { configured: false, reason: "missing_woo_rest_credentials", payments: [], wp_admin_url: "https://api.horizonfit.com.ar/wp-admin" } : { configured: true, store_id: "horizon-fit", storefront_url: "https://horizonfit.com.ar", api_url: "https://api.horizonfit.com.ar", wp_admin_url: "https://api.horizonfit.com.ar/wp-admin", environment: { wc_version: "9.x (fixture)", wp_version: "6.x (fixture)", currency: "ARS", currency_symbol: "$", language: "es_AR" }, general: [], payments: [{ id: "woo-mercado-pago-basic", title: "Mercado Pago", enabled: true }] };

    if (path === "/v1/growth/opportunities" && method === "GET") {
      if (cold) return { opportunities: [] };
      const status = q.get("status");
      return { opportunities: state.opportunities.filter((r) => (status ? r.status === status : r.status === "open" || r.status === "snoozed")) };
    }
    if (seg[1] === "growth" && seg[3]) {
      const row = state.opportunities.find((r) => r.id === seg[3]);
      if (!row) throw new ApiError(404, "error", "not_found");
      if (method === "POST") {
        if (body.action === "snooze") Object.assign(row, { status: "snoozed", snoozed_until: iso(-(body.snooze_days ?? 7) * DAY) });
        if (body.action === "dismiss") row.status = "dismissed";
        if (body.action === "done") row.status = "done";
        row.updated_at = iso(0);
      }
      return row;
    }

    if (path === "/v1/alerts") return { alerts: cold ? [] : state.alerts };
    if (path === "/v1/alerts/evaluate") return { alerts: state.alerts, evaluated_at: iso(0) };

    if (path === "/v1/seo/audits/latest") {
      if (cold) return { configured: false, reason: "missing_seo_report", job: null, summary: null };
      if (state.seoJob.status === "queued" && Date.now() - Date.parse(state.seoJob.createdAt) > 6000) Object.assign(state.seoJob, { status: "succeeded", finishedAt: iso(0) });
      return { configured: true, job: state.seoJob, summary: { generatedAt: state.seoJob.finishedAt ?? iso(7 * HOUR), auditedCount: 8, totals: { critical: 16, warning: 0 }, pages: SEO_PAGES, reportPath: "reports/seo-audit/latest.json", age_h: state.seoJob.finishedAt ? (Date.now() - Date.parse(state.seoJob.finishedAt)) / HOUR : 7 } };
    }
    if (path === "/v1/seo/audit") {
      state.seoJob = { id: `job_seo_${Date.now()}`, type: "seo.audit", status: "queued", createdAt: iso(0), finishedAt: null, error: null };
      return state.seoJob;
    }
    if (path === "/v1/metrics/snapshots") return { snapshots: [18, 18, 16, 16, 16, 16].map((value, i) => ({ id: i, store_id: "horizon-fit", period: "audit", kpi: q.get("kpi") ?? "seo_critical", value, unit: "count", at: iso(i * 12 * HOUR) })) };
    if (path === "/v1/metrics/series") return series(q, scenario);

    if (path === "/v1/merchant/diagnostics") {
      if (errors) scoped("merchant.get_diagnostics");
      if (cold) return { diagnosticsTxt: "", productsJson: null, path: null, source: "unavailable", summary: { ready: 0, blocked: 0, problems: [] }, error: "diagnostics_unavailable" };
      return { diagnosticsTxt: "Merchant feed diagnostics (fixture)\nItems: 153\nReady: 153\nBlocked: 0\n", productsJson: PRODUCTS.flatMap((p) => p.variations.map((v) => ({ sku: v.sku, title: p.name }))), path: "/var/www/uploads/horizon-fit-merchant", source: "local", summary: { ready: 153, blocked: 0, problems: [] } };
    }
    if (path === "/v1/merchant/audit") scoped("merchant.audit");

    const snaps = [
      { id: 1, competitor: "Touche", segment: "training-mujer", url: "https://touche.example/", checked_at: iso(9 * HOUR), status: 200, title: "Touche · Activewear (fixture)", description: "", h1: "Nueva colección", product_count: 48, price_min: 38900, price_max: 129000, robots_allowed: true, extractor: "shopify_json", error: null },
      { id: 2, competitor: "Adidas", segment: "training-mujer", url: "https://adidas.example/", checked_at: iso(9 * HOUR), status: 403, title: null, description: null, h1: null, product_count: null, price_min: null, price_max: null, robots_allowed: true, extractor: null, error: "http_403" },
    ];
    if (path === "/v1/competition") return cold ? { configured: false, reason: "missing_competitor_urls", snapshots: [] } : { configured: true, store_id: "horizon-fit", fetched_at: iso(9 * HOUR), snapshots: snaps };
    if (path === "/v1/competition/changes") return cold ? { configured: false, reason: "missing_competitor_urls", changes: [] } : { configured: true, changes: [{ type: "price_down", url: snaps[0].url, title: "Calza Seamless (fixture)", before: 52900, after: 47900 }, { type: "new", url: snaps[0].url, title: "Top Cruzado (fixture)" }, { type: "promo_change", url: snaps[0].url, title: "Home", before: "20% OFF", after: "3 cuotas" }] };
    if (path === "/v1/competition/item") return { configured: true, snapshot: snaps[0], products: [["Calza Seamless (fixture)", 47900, 52900], ["Top Cruzado (fixture)", 39900, null], ["Short Biker (fixture)", 42900, null]].map(([title, price, compare_at], i) => ({ product_key: `p${i}`, product_id: String(i), product_url: snaps[0].url, title, price, compare_at, currency: "ARS" })) };
    if (path === "/v1/competition/compare") {
      const product = findProduct(q.get("id") ?? "");
      if (!product) return { configured: true, found: false };
      const segment = product.categories[0].slug === "calzas" ? "calzas" : "tops";
      const idx = segment === "calzas" ? { segment, horizon: Number(product.price.raw), median: 59800, index: Math.round((Number(product.price.raw) / 59800) * 100) / 100, n: 6 } : { segment, horizon: Number(product.price.raw), median: null, index: null, n: 1 };
      return { configured: true, found: true, parent_sku: product.sku, segment, horizon_price: Number(product.price.raw), price_index: idx, peers: segment === "calzas" ? [["Calza Seamless (fixture)", 47900], ["Calza Tiro Alto (fixture)", 59800], ["Calza Básica (fixture)", 38900]].map(([title, price]) => ({ title, price })) : [], assortment: { segment, horizon_count: PRODUCTS.filter((p) => p.categories[0].slug === segment).length, competitor_count: segment === "calzas" ? 14 : 1, unmatched_titles: ["Calza Seamless (fixture)"] } };
    }

    if (path === "/v1/catalog/products") {
      let rows = PRODUCTS;
      const term = (q.get("q") ?? "").toLowerCase();
      if (term) rows = rows.filter((p) => p.name.toLowerCase().includes(term) || p.slug.includes(term) || p.sku.toLowerCase().includes(term));
      if (q.get("category")) rows = rows.filter((p) => p.categories[0].slug === q.get("category"));
      if (q.get("stock_status") === "outofstock") rows = [];
      const limit = Number(q.get("limit") || 20);
      const page = Number(q.get("page") || 1);
      return { products: rows.slice((page - 1) * limit, page * limit), page, limit };
    }
    if (seg[1] === "catalog" && seg[3]) {
      const product = findProduct(seg[3]);
      if (!product) throw new ApiError(404, "error", "not_found");
      return product;
    }
    if (path === "/v1/insights/products" || (seg[1] === "insights" && seg[2] === "products")) {
      const product = findProduct(seg[3] ?? q.get("id") ?? q.get("sku") ?? "");
      if (!product) throw new ApiError(404, "error", "not_found");
      return insight(product, scenario);
    }
    if (path === "/v1/storefront/config") return STOREFRONT;

    if (path === "/v1/analytics/ga4") {
      if (errors) return { configured: true, ok: false, reason: "ga4_request_failed", store_id: "horizon-fit" };
      if (cold) return { configured: false, ok: false, reason: "missing_google_credentials", store_id: "horizon-fit" };
      return { configured: true, ok: true, store_id: "horizon-fit", property_id: "fixture", sessions: 62, users: 13, purchases: 0, channels: [["Direct", 24], ["Organic Social", 17], ["Organic Search", 11], ["Referral", 6], ["Unassigned", 4]].map(([channel, sessions]) => ({ channel, sessions })) };
    }
    if (path === "/v1/analytics/search-console") {
      if (cold) return { configured: false, ok: false, reason: "missing_google_credentials" };
      return { configured: true, ok: true, store_id: "horizon-fit", site_url: "https://horizonfit.com.ar/", start_date: isoDay(30), end_date: isoDay(3), clicks: 21, impressions: 1180, ctr: 0.0178, position: 18.4, queries: [["horizon fit", 9, 61, 2.1], ["horizonfit", 5, 22, 1.4], ["ropa deportiva mujer", 0, 48, 38.5], ["calza deportiva mujer", 0, 37, 41.2], ["top deportivo", 1, 29, 22.8], ["conjunto deportivo mujer", 0, 21, 35], ["top bordo deportivo", 1, 9, 11.4]].map(([query, clicks, impressions, position]) => ({ query, clicks, impressions, ctr: clicks / impressions, position })) };
    }

    if (path === "/v1/customers") {
      if (cold) return { configured: false, reason: "missing_woo_rest_credentials", customers: [], segments: {} };
      const segment = q.get("segment");
      const rows = segment ? CUSTOMERS.filter((c) => c.segment === segment) : CUSTOMERS;
      return { configured: true, store_id: "horizon-fit", fetched_at: iso(18 * MIN), customers: rows, segments: { one_time: 3 } };
    }
    if (seg[1] === "customers" && seg[2]) {
      const row = CUSTOMERS.find((c) => c.customer_key === seg[2]);
      if (!row) throw new ApiError(404, "error", "not_found");
      return row;
    }
    if (path === "/v1/campaigns") {
      const ads = { google: { configured: false, reason: "ads_adapter_not_configured", source: "google_ads" }, meta: { configured: false, reason: "ads_adapter_not_configured", source: "meta_ads" } };
      if (cold) return { configured: false, reason: "missing_woo_rest_credentials", campaigns: [], ads };
      return { configured: true, campaigns: [{ id: "c1", channel: "internal_promo", objective: "conversion", status: "observed", name: "BIENVENIDA10", orders: 1, revenue: 67000 }, { id: "c2", channel: "internal_promo", objective: "conversion", status: "observed", name: "OTOÑO15", orders: 1, revenue: 114000 }], ads };
    }
    if (path === "/v1/ads") return { google: { configured: false, reason: "ads_adapter_not_configured", source: "google_ads" }, meta: { configured: false, reason: "ads_adapter_not_configured", source: "meta_ads" } };

    if (path === "/v1/content/drafts" && method === "GET") {
      const status = q.get("status");
      return { drafts: state.drafts.filter((d) => !status || d.status === status) };
    }
    if (path === "/v1/content/generate") {
      const product = body.parent_sku ? findProduct(body.parent_sku) : null;
      const opp = state.opportunities.find((r) => r.id === body.opportunity_id);
      const draft = { id: `dr_${Date.now()}`, kind: body.kind, parent_sku: product?.sku ?? null, opportunity_id: opp?.id ?? null, status: "draft", body: draftBody(body.kind, product), notes: "catalog:ok · search:ok · seo:ok · sales:zero · no_publish_to_horizon_fit", model: null, prompt_version: "content.v1", source_context: { parent_sku: product?.sku ?? null, catalog_status: "ok", search_status: "ok", seo_status: "ok", queries: ["top bordo deportivo"], opportunity: opp ? { type: opp.type, reason: opp.reason } : null }, author: "fixtures", created_at: iso(0), updated_at: iso(0) };
      state.drafts.unshift(draft);
      return draft;
    }
    if (seg[1] === "content" && seg[2] === "drafts" && seg[3]) {
      const draft = state.drafts.find((d) => d.id === seg[3]);
      if (!draft) throw new ApiError(404, "error", "not_found");
      if (method === "POST") {
        if (body.action === "approve") {
          if (draft.status !== "draft") throw new ApiError(400, "invalid_transition", "invalid_transition");
          draft.status = "approved";
        }
        if (body.action === "published-externally") {
          if (draft.status !== "approved") throw new ApiError(400, "invalid_transition", "invalid_transition");
          draft.status = "published-externally";
        }
        if (body.action === "note") draft.notes = `${draft.notes}\nfixtures: ${body.note}`;
        draft.updated_at = iso(0);
      }
      return draft;
    }

    if (path === "/v1/ai/chat") return { configured: false, reason: "missing_ai_provider_keys", session_id: `s_${++state.sessionSeq}` };
    if (path === "/v1/ai/usage") return { day: isoDay(0), configured: false, calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0, by_provider: [], budget: { daily_usd: 5, user_tokens: 100000, remaining_usd: 5 } };
    if (path === "/v1/ai/models") return { configured: false, reason: "missing_ai_provider_keys", models: ["openai:gpt-4o-mini", "anthropic:claude-sonnet-4-5", "gemini:gemini-2.0-flash", "ollama:llama3.2"].map((id) => ({ id, provider: id.split(":")[0], alias: id, configured: false, reason: "missing_key" })) };
    if (path === "/v1/assistant/ask") {
      const question = String(body.question ?? "").toLowerCase();
      const skuMatch = question.match(/\d{3}-[a-z]{3}-[a-z]{3}/);
      if (skuMatch) return { mode: "deterministic", intent: "product", question, data: findProduct(skuMatch[0]) ?? {}, note: "" };
      if (/seo/.test(question)) return { mode: "deterministic", intent: "seo", question, data: await respond("/v1/seo/audits/latest"), note: "" };
      if (/tr[aá]fico|sesion/.test(question) && !/gr[aá]fico/.test(question)) return { mode: "deterministic", intent: "ga4", question, data: await respond("/v1/analytics/ga4"), note: "" };
      if (/competen/.test(question)) return { mode: "deterministic", intent: "competitors", question, data: { configured: true, pages: [{ url: "https://touche.example/", host: "touche.example", status: 200, ok: true }, { url: "https://adidas.example/", host: "adidas.example", status: 403, ok: false }] }, note: "" };
      if (/gr[aá]fico/.test(question)) return { mode: "deterministic", intent: "chart", question, data: { chart: { type: "line", kpi: "ga4_sessions", period: "28d", title: "Sesiones GA4 · últimas lecturas" }, series: [48, 51, 55, 58, 60, 62].map((value, i) => ({ at: iso((6 - i) * DAY), value })) }, note: "" };
      return { mode: "deterministic", intent: "alerts", question, data: { alerts: state.alerts }, note: "" };
    }
    if (["/v1/repo/status", "/v1/audit/history"].includes(path) || seg[1] === "jobs") scoped(path);
    throw new ApiError(404, "error", `fixture_missing ${path}`);
  }
  return { respond };
}

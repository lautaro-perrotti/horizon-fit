const TOKEN_KEY = "horizon_dashboard_token";
const DEFAULT_STOREFRONT = "https://horizonfit.com.ar";
const COLLECTION_PATH = "/coleccion/";
const HINTS = [
  "¿Cuál es el precio del SKU 001-TOP-AZU?",
  "¿Cómo está el SEO?",
  "¿Cómo está el tráfico?",
  "¿Cómo está la competencia?",
  "Generá un gráfico de sesiones GA4",
  "¿Hay alertas abiertas?",
];

function $(id) {
  return document.getElementById(id);
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value, currency = "ARS") {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return `${value} ${currency}`;
  return `$${Math.round(n).toLocaleString("es-AR")} ${currency}`;
}

async function sha256(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomString() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function loadConfig() {
  const response = await fetch("/app/config.json");
  return response.json();
}

function token() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setToken(value) {
  if (value) sessionStorage.setItem(TOKEN_KEY, value);
  else sessionStorage.removeItem(TOKEN_KEY);
  renderAuth();
}

function renderAuth() {
  const logged = Boolean(token());
  $("authState").textContent = logged ? "sesión activa" : "sin sesión";
  $("sessionDot").classList.toggle("on", logged);
  $("loginBtn").hidden = logged;
  $("logoutBtn").hidden = !logged;
}

async function api(path, options = {}) {
  const headers = { accept: "application/json", ...(options.headers ?? {}) };
  const jwt = token();
  if (jwt) headers.authorization = `Bearer ${jwt}`;
  const payload =
    options.body === undefined ? undefined : typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  if (payload !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(path, { method: options.method ?? "GET", headers, body: payload });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error_description || body.error || `http_${response.status}`);
  }
  return body;
}

function storefrontOrigin(cfg) {
  try {
    return new URL(cfg.storefrontUrl || DEFAULT_STOREFRONT).origin;
  } catch {
    return DEFAULT_STOREFRONT;
  }
}

function safeEmbedUrl(raw, origin) {
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin || (url.protocol !== "https:" && url.protocol !== "http:")) return `${origin}/`;
    return url.toString();
  } catch {
    return `${origin}/`;
  }
}

function setEmbed(cfg, pathOrUrl) {
  const origin = storefrontOrigin(cfg);
  const url = safeEmbedUrl(pathOrUrl || "/", origin);
  $("siteFrame").src = url;
  $("siteUrl").value = url;
  $("siteOpen").href = url;
}

function renderTabs(active) {
  $("tabNav").querySelectorAll("[data-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === active);
  });
}

function setDrawer(open) {
  $("drawer").classList.toggle("open", open);
  $("drawer").setAttribute("aria-hidden", open ? "false" : "true");
  $("drawerBtn").classList.toggle("open", open);
}

function notice(text) {
  return `<div class="notice">${text}</div>`;
}

function pip(severity) {
  const cls = severity === "critical" ? "bad" : severity === "warning" ? "warn" : "ok";
  return `<span class="pip ${cls}"></span>`;
}

let selectedProduct = null;
let cfgRef = null;
let seoSummary = null;

function seoChip(slug) {
  const page = slug && seoSummary?.pages?.find((row) => row.slug === slug || String(row.url || "").includes(`/product/${slug}`));
  if (!page) return { label: "—", cls: "scope" };
  if (page.critical) return { label: "Error", cls: "bad" };
  if (page.warning) return { label: "Warning", cls: "warn" };
  return { label: "—", cls: "scope" };
}

function productRow(product) {
  const sku = product.sku || product.parent_sku || "";
  const category = product.categories?.[0]?.name || "—";
  const color = product.attributes?.Color?.[0] || product.attributes?.color?.[0] || "—";
  const seo = seoChip(product.slug);
  return `<button type="button" class="table-row${selectedProduct?.sku === sku ? " active" : ""}" data-sku="${esc(sku)}">
    <span style="font-weight:600">${esc(product.name)}</span>
    <span class="mono">${esc(sku)}</span>
    <span>${esc(category)}</span>
    <span>${esc(color)}</span>
    <span class="mono">${esc(product.price?.amount ?? "—")}</span>
    <span class="${product.stock_status === "outofstock" ? "bad" : "ok"}">${product.stock_status === "outofstock" ? "Sin stock" : "Disponible"}</span>
    <span class="${seo.cls}">${esc(seo.label)}</span>
    <span class="scope">—</span>
  </button>`;
}

function productMeta(product) {
  const sku = product.sku || product.parent_sku;
  const sizes = product.attributes?.Talle || product.attributes?.talle || [];
  return {
    sku,
    category: product.categories?.[0]?.name || "—",
    color: product.attributes?.Color?.[0] || product.attributes?.color?.[0] || "—",
    sizes: sizes.join(" / ") || "—",
    slug: product.slug || "",
  };
}

function openAsk(question, context) {
  setDrawer(true);
  if (context) {
    $("drawerContext").hidden = false;
    $("drawerContext").textContent = `viendo: ${context}`;
  }
  $("askForm").querySelector("input").value = question;
}

function renderInspector(product) {
  if (!product) {
    $("siteInspector").innerHTML =
      `<p class="muted">Elegí un producto en Catálogo para ver su inspector acá, o navegá el sitio con la barra de arriba.</p>`;
    $("catalogDetail").innerHTML = "";
    return;
  }
  const meta = productMeta(product);
  const seo = seoChip(meta.slug);
  $("siteInspector").innerHTML = `<div>
    <div style="font-size:16px;font-weight:800;margin-bottom:2px">${esc(product.name)}</div>
    <div class="mono" style="margin-bottom:16px">${esc(meta.sku)}</div>
    <div class="item"><span class="muted">Precio</span><span class="mono">${esc(product.price?.amount ?? "—")} ${esc(product.price?.currency ?? "")}</span></div>
    <div class="item"><span class="muted">Stock</span><span class="${product.stock_status === "outofstock" ? "bad" : "ok"}">${product.stock_status === "outofstock" ? "Sin stock" : "Disponible"}</span></div>
    <div class="item"><span class="muted">SEO</span><span class="${seo.cls}">${esc(seo.label)}</span></div>
    <div class="item"><span class="muted">Merchant</span><span class="scope">requiere scope</span></div>
    <button type="button" class="ask-selected" style="margin-top:18px;width:100%;background:var(--violet);color:#fff">Preguntar a Horizon</button>
  </div>`;
  $("catalogDetail").innerHTML = `<article class="card detail">
    <div class="card-head">
      <div><span class="title">${esc(product.name)}</span> <span class="mono">${esc(meta.sku)}</span></div>
      <span class="mono" style="font-size:21px;font-weight:700">${esc(product.price?.amount ?? "—")} ${esc(product.price?.currency ?? "")}</span>
    </div>
    <div class="detail-grid">
      <div><div class="muted">Categoría</div><div style="font-weight:600">${esc(meta.category)}</div></div>
      <div><div class="muted">Color</div><div style="font-weight:600">${esc(meta.color)}</div></div>
      <div><div class="muted">Talles</div><div style="font-weight:600">${esc(meta.sizes)}</div></div>
      <div><div class="muted">Stock</div><span class="${product.stock_status === "outofstock" ? "bad" : "ok"}">${product.stock_status === "outofstock" ? "Sin stock" : "Disponible"}</span></div>
    </div>
    <div class="detail-actions">
      <button type="button" id="viewPdp" style="background:var(--violet);color:#fff">Ver PDP</button>
      <button type="button" id="askSeo">Analizar SEO</button>
      <button type="button" id="askMerchant">Ver Merchant</button>
      <button type="button" class="ask-selected">Preguntar a Horizon</button>
    </div>
  </article>`;
  document.querySelectorAll(".ask-selected").forEach((btn) => {
    btn.addEventListener("click", () => openAsk(`¿Cómo está ${product.name}?`, product.name));
  });
  $("askSeo")?.addEventListener("click", () => openAsk("¿Cómo está el SEO de este producto?", product.name));
  $("askMerchant")?.addEventListener("click", () => openAsk("¿Tiene problemas de Merchant este producto?", product.name));
  $("viewPdp")?.addEventListener("click", () => {
    if (!cfgRef) return;
    showTab("sitio", cfgRef);
    setEmbed(cfgRef, meta.slug ? `/product/${meta.slug}/` : "/");
  });
}

async function loadHealthStrip() {
  const data = await api("/v1/health");
  const host = (() => {
    try {
      return new URL(data.storefront.url || DEFAULT_STOREFRONT).host;
    } catch {
      return "horizonfit.com.ar";
    }
  })();
  const ok = (node, label, part) => {
    const color = part.ok ? "var(--ok)" : "var(--bad)";
    $(node).innerHTML = `${label} <span style="color:${color}">· ${part.status ?? "—"} · ${part.latency_ms ?? "—"}ms</span>`;
  };
  ok("announceSite", host, data.storefront);
  ok("announceApi", "API", data.api);
  const cpOk = data.status === "healthy";
  $("announceCp").innerHTML = `Control Plane <span style="color:${cpOk ? "var(--ok)" : "var(--warn)"}">· ${esc(data.status)}</span>`;
  return data;
}

async function loadOverview() {
  const health = await loadHealthStrip();
  const parts = [health.storefront.ok, health.api.ok, health.db?.healthy].filter((v) => v != null);
  const score = parts.length ? Math.round((parts.filter(Boolean).length / parts.length) * 100) : 0;
  $("overviewHealth").innerHTML = `<svg width="120" height="70" viewBox="0 0 120 70" aria-hidden="true">
      <path d="M10,65 A50,50 0 0 1 110,65" fill="none" stroke="oklch(0.3 0.02 75 / 0.12)" stroke-width="10" stroke-linecap="round" />
      <path d="M10,65 A50,50 0 0 1 110,65" fill="none" stroke="oklch(0.6 0.13 150)" stroke-width="10" stroke-linecap="round" pathLength="100" stroke-dasharray="${score} 100" />
    </svg>
    <div class="gauge-val">${score}%</div>
    <div class="sub">${esc(health.status)} · storefront + API + DB</div>`;
  $("healthGrid").innerHTML = [
    ["Storefront", health.storefront.status, `${health.storefront.latency_ms ?? "—"}ms`, health.storefront.ok],
    ["API", health.api.status, `${health.api.latency_ms ?? "—"}ms`, health.api.ok],
    ["Control Plane", health.status, health.db?.healthy ? "DB ok" : "DB down", health.status === "healthy"],
  ]
    .map(
      ([label, value, sub, good]) =>
        `<div><div class="sub">${esc(label)}</div><div class="n ${good ? "ok" : "bad"}">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`,
    )
    .join("");

  try {
    const sales = await api("/v1/commerce/sales");
    const html = !sales.configured
      ? `<div class="empty-row"><span>Woo REST no configurado — faltan credenciales.</span><button type="button" disabled>Conectar fuente</button></div>`
      : `<div class="metrics">
          <div><div class="n">${esc(money(sales.today.revenue, sales.currency))}</div><div class="l">hoy · ${esc(sales.today.orders)} pedidos · ${esc(sales.today.units ?? 0)} u</div></div>
          <div><div class="n">${esc(money(sales.week.revenue, sales.currency))}</div><div class="l">7d · ${esc(sales.week.orders)} · AOV ${esc(money(sales.week.aov, sales.currency))}</div></div>
          <div><div class="n">${esc(money(sales.month.revenue, sales.currency))}</div><div class="l">30d · ${esc(sales.month.orders)} · ${esc(sales.month.units ?? 0)} u</div></div>
          <div><div class="n">${esc(money(sales.ninety?.revenue, sales.currency))}</div><div class="l">90d · ${esc(sales.ninety?.orders ?? 0)}</div></div>
        </div>`;
    $("overviewSales").innerHTML = html;
    const fetched = sales.fetched_at ? `<div class="src" style="margin:8px 0 0">Woo orders · ${esc(sales.fetched_at)}${sales.incomplete ? " · incomplete (page cap)" : ""}</div>` : "";
    const products = (sales.products ?? [])
      .slice(0, 20)
      .map(
        (row) =>
          `<div class="item"><span class="mono">${esc(row.parent_sku)}</span><span>${esc(row.d30.units)} u / 30d · AOV ${esc(money(row.d30.aov, sales.currency))}</span><span class="mono">${esc(money(row.d30.revenue, sales.currency))}</span></div>`,
      )
      .join("");
    $("salesOut").innerHTML = !sales.configured
      ? `<div class="notice">Acceso a pedidos no habilitado — faltan <code>HORIZON_WOO_KEY</code> / <code>HORIZON_WOO_SECRET</code> en el Control Plane.</div>`
      : html +
        fetched +
        (products ? `<h3 class="sub" style="margin:22px 0 8px">Por SKU (30d, line items)</h3>${products}` : "") +
        `<h3 class="sub" style="margin:22px 0 8px">Pedidos recientes</h3>${(sales.recent_orders ?? [])
          .map((order) => {
            const skus = (order.items ?? []).map((item) => item.parent_sku || item.sku).join(" · ");
            return `<div class="item"><span class="mono">#${esc(order.id)}</span><span class="muted">${esc(order.status)}${skus ? ` · ${esc(skus)}` : ""}</span><span class="mono">${esc(order.total)}</span></div>`;
          })
          .join("")}`;
  } catch (error) {
    $("overviewSales").innerHTML = notice(esc(error.message));
    $("salesOut").innerHTML = notice(esc(error.message));
  }

  try {
    const [all, out] = await Promise.all([
      api("/v1/catalog/products?limit=10"),
      api("/v1/catalog/products?stock_status=outofstock&limit=10"),
    ]);
    const n = all.products?.length ?? 0;
    const o = out.products?.length ?? 0;
    $("overviewCatalog").innerHTML = `<div><span class="n">${n}</span><span class="sub"> SKUs (muestra)</span></div>
      <div><span class="n" style="color:var(--warn)">${o}</span><span class="sub"> sin stock (muestra)</span></div>
      <button type="button" data-tab="catalogo">Ver sin stock →</button>`;
    $("overviewCatalog").querySelector("[data-tab]")?.addEventListener("click", () => showTab("catalogo", cfgRef));
  } catch (error) {
    $("overviewCatalog").innerHTML = notice(esc(error.message));
  }

  try {
    const alerts = await api("/v1/alerts");
    const rows = alerts.alerts ?? [];
    const open = rows.filter((row) => row.status === "open");
    $("announceAlerts").textContent = open.length ? `${open.length} alertas abiertas` : "";
    const list = (target, items) => {
      $(target).innerHTML = items.length
        ? items
            .map(
              (alert) =>
                `<button type="button" class="alert-row" data-q="${esc(`¿Qué pasa con ${alert.rule_id}?`)}">${pip(alert.severity)}<span style="flex:1">${esc(alert.title)}</span><span class="src">${esc(alert.rule_id)}</span></button>`,
            )
            .join("")
        : `<p class="muted">Sin alertas</p>`;
      $(target).querySelectorAll("[data-q]").forEach((btn) => {
        btn.addEventListener("click", () => {
          setDrawer(true);
          $("askForm").querySelector("input").value = btn.dataset.q;
        });
      });
    };
    list("overviewAlerts", open.slice(0, 5));
    list("alertsOut", rows);
  } catch (error) {
    $("overviewAlerts").innerHTML = notice(esc(error.message));
    $("alertsOut").innerHTML = notice(esc(error.message));
  }

  await loadAnalytics().catch(() => undefined);
  await loadSeo().catch(() => undefined);
}

function sparkline(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (nums.length < 2) return `<p class="muted">Sin serie todavía. Corre una auditoría o esperá el próximo evaluate.</p>`;
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums, 0);
  const span = max - min || 1;
  const points = nums
    .map((value, i) => {
      const x = (i / (nums.length - 1)) * 120;
      const y = 36 - ((value - min) / span) * 28;
      return `${x},${y}`;
    })
    .join(" ");
  return `<svg class="chart-svg spark" viewBox="0 0 120 40" aria-hidden="true"><polyline points="${points}" fill="none" stroke="oklch(0.32 0.15 300)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
}

function renderSeoPanel(data, snaps) {
  seoSummary = data.summary;
  const job = data.job;
  const busy = job && (job.status === "queued" || job.status === "running");
  if ($("seoAuditBtn")) $("seoAuditBtn").disabled = Boolean(busy);
  if ($("overviewSeo")) {
    $("overviewSeo").innerHTML = !data.configured
      ? `SEO — sin auditoría <span class="src">(${esc(data.reason || "missing_seo_report")})</span>`
      : `SEO — ${esc(data.summary.totals.critical)} críticos · ${esc(data.summary.totals.warning)} warnings <span class="src">${esc(data.summary.age_h != null ? `${Math.round(data.summary.age_h)}h` : "")}</span>`;
  }
  if (!$("seoCards")) return;
  if (!data.configured) {
    $("seoStatus").textContent = job ? `Job ${job.status}` : "Sin reporte SEO.";
    $("seoCards").innerHTML = `<div class="empty-row"><span>Sin auditoría SEO. No se inventan issues.</span></div>`;
    $("seoSpark").innerHTML = "";
    $("seoPages").innerHTML = `<p class="muted">Corré Auditar ahora o esperá el job programado (12h).</p>`;
    return;
  }
  const s = data.summary;
  $("seoStatus").textContent = [job ? `Job ${job.status}` : null, s.generatedAt ? `audit ${s.generatedAt}` : null].filter(Boolean).join(" · ");
  $("seoCards").innerHTML = `<div><span class="n">${esc(s.auditedCount)}</span><span class="sub"> páginas</span></div>
    <div><span class="n bad">${esc(s.totals.critical)}</span><span class="sub"> críticos</span></div>
    <div><span class="n" style="color:var(--warn)">${esc(s.totals.warning)}</span><span class="sub"> warnings</span></div>
    <div><span class="n">${s.age_h == null ? "—" : `${Math.round(s.age_h)}h`}</span><span class="sub"> antigüedad</span></div>`;
  $("seoSpark").innerHTML = sparkline((snaps ?? []).map((row) => Number(row.value)).filter((value) => Number.isFinite(value)).reverse());
  $("seoPages").innerHTML = (s.pages ?? []).length
    ? s.pages
        .map((page) => {
          const title = page.title || page.url;
          const desc = page.description || "";
          return `<div class="seo-page">
            <div style="font-weight:700">${esc(title)}</div>
            <div class="mono">${esc(page.url)}</div>
            ${desc ? `<div class="muted">${esc(desc)}</div>` : ""}
            <div><span class="${page.critical ? "bad" : "ok"}">${esc(page.critical)} críticos</span> · <span class="${page.warning ? "warn" : "muted"}">${esc(page.warning)} warnings</span></div>
          </div>`;
        })
        .join("")
    : `<p class="muted">Sin páginas con issues en el summary.</p>`;
}

async function loadSeo() {
  const [data, snaps] = await Promise.all([
    api("/v1/seo/audits/latest"),
    api("/v1/metrics/snapshots?kpi=seo_warning&limit=20").catch(() => ({ snapshots: [] })),
  ]);
  renderSeoPanel(data, snaps.snapshots ?? []);
  return data;
}

function emptySource(reason, hint) {
  return `<div class="empty-row"><span>${esc(hint)} <span class="src">(${esc(reason)})</span></span></div>`;
}

function renderGa4(data) {
  const metrics = !data.configured
    ? emptySource(data.reason || "missing_google_credentials", "GA4 no conectado. No se inventan sesiones.")
    : `<div class="metrics">
        <div><div class="n">${esc(data.sessions ?? "—")}</div><div class="l">sesiones · 28d</div></div>
        <div><div class="n">${esc(data.users ?? "—")}</div><div class="l">usuarios</div></div>
        <div><div class="n">${esc(data.purchases ?? "—")}</div><div class="l">compras</div></div>
      </div>`;
  if ($("overviewTraffic")) $("overviewTraffic").innerHTML = metrics;
  if ($("ga4Out")) {
    $("ga4Out").innerHTML =
      metrics +
      (data.configured
        ? (data.channels ?? [])
            .map((row) => `<div class="item"><span>${esc(row.channel)}</span><span class="mono">${esc(row.sessions)}</span></div>`)
            .join("")
        : "");
  }
}

function renderGsc(data) {
  if (!$("gscOut")) return;
  if (!data.configured) {
    $("gscOut").innerHTML = emptySource(data.reason || "missing_google_credentials", "Search Console no conectado. No se inventan clicks.");
    return;
  }
  $("gscOut").innerHTML = `<div class="metrics">
      <div><div class="n">${esc(data.clicks ?? "—")}</div><div class="l">clicks · 28d</div></div>
      <div><div class="n">${esc(data.impressions ?? "—")}</div><div class="l">impresiones</div></div>
      <div><div class="n">${data.ctr == null ? "—" : `${Math.round(Number(data.ctr) * 1000) / 10}%`}</div><div class="l">CTR</div></div>
      <div><div class="n">${data.position == null ? "—" : Number(data.position).toFixed(1)}</div><div class="l">posición</div></div>
    </div>
    ${(data.queries ?? [])
      .map(
        (row) =>
          `<div class="item"><span>${esc(row.query)}</span><span class="mono">${esc(row.clicks)} / ${esc(row.impressions)}</span></div>`,
      )
      .join("")}`;
}

async function loadAnalytics() {
  const [ga4, gsc] = await Promise.all([
    api("/v1/analytics/ga4"),
    api("/v1/analytics/search-console"),
  ]);
  renderGa4(ga4);
  renderGsc(gsc);
  return { ga4, gsc };
}

function renderCompetitors(data) {
  if (!$("competitorsOut")) return;
  if (!data.configured) {
    $("competitorsOut").innerHTML = emptySource(
      data.reason || "missing_competitor_urls",
      "Sin URLs en HORIZON_COMPETITOR_URLS. No se inventan competidores.",
    );
    return;
  }
  $("competitorsOut").innerHTML = (data.pages ?? []).length
    ? data.pages
        .map((page) => {
          const status = page.status ?? "—";
          const cls = page.ok ? "ok" : "bad";
          return `<div class="seo-page">
            <div style="font-weight:700">${esc(page.title || page.host)}</div>
            <div class="mono">${esc(page.url)}</div>
            <div><span class="${cls}">${esc(status)}</span> · ${esc(page.latency_ms ?? "—")}ms${page.error ? ` · ${esc(page.error)}` : ""}</div>
            ${page.h1 ? `<div class="muted">H1 ${esc(page.h1)}</div>` : ""}
            ${page.description ? `<div class="muted">${esc(page.description)}</div>` : ""}
          </div>`;
        })
        .join("")
    : `<p class="muted">Sin páginas.</p>`;
}

async function loadCompetitors() {
  const data = await api("/v1/analytics/competitors");
  renderCompetitors(data);
  return data;
}

async function searchCatalog(query) {
  const sku = /^\d{3}-[A-Z]{3}-[A-Z]{3}/i.test((query || "").trim()) ? query.trim() : "";
  const path = sku
    ? `/v1/catalog/products/${encodeURIComponent(sku)}`
    : `/v1/catalog/products?q=${encodeURIComponent(query || "")}&limit=10`;
  const data = await api(path);
  const products = data.products ?? (data.sku ? [data] : []);
  $("catalogOut").innerHTML = products.length ? products.map(productRow).join("") : `<p class="muted" style="padding:16px 20px">Sin resultados</p>`;
  $("catalogOut").querySelectorAll("[data-sku]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const product = await api(`/v1/catalog/products/${encodeURIComponent(btn.dataset.sku)}`);
      selectedProduct = product;
      renderInspector(product);
      searchCatalog(query).catch(() => undefined);
    });
  });
}

function replyText(data) {
  if (data.intent === "product" && data.data?.name) {
    return `${data.data.name} · ${data.data.price?.amount ?? "—"} ${data.data.price?.currency ?? ""}`.trim();
  }
  if (data.intent === "health" && data.data?.status) return `Storefront ${data.data.storefront?.status ?? "—"} · API ${data.data.api?.status ?? "—"} · ${data.data.status}`;
  if (data.intent === "sales" && data.data) {
    if (data.data.configured === false) return data.data.reason || "Falta HORIZON_WOO_KEY";
    if (data.data.product) {
      const p = data.data.product;
      return `${data.data.parent_sku} · ${p.d30?.units ?? 0} u / 30d · ${money(p.d30?.revenue, "ARS")}`;
    }
    if (data.data.parent_sku && !data.data.product) return `${data.data.parent_sku} · sin ventas en la ventana`;
    return `Hoy ${data.data.today?.orders ?? 0} pedidos · ${money(data.data.today?.revenue, data.data.currency)}`;
  }
  if (data.intent === "alerts") {
    const rows = data.data?.alerts ?? [];
    return rows.length ? rows.map((row) => row.title).slice(0, 3).join(" · ") : "Sin alertas";
  }
  if (data.intent === "seo") {
    if (data.data?.configured === false) return data.data.reason || "Sin auditoría SEO";
    const totals = data.data?.summary?.totals;
    return `SEO · ${totals?.critical ?? 0} críticos · ${totals?.warning ?? 0} warnings · ${data.data?.summary?.auditedCount ?? 0} páginas`;
  }
  if (data.intent === "ga4") {
    if (data.data?.configured === false) return data.data.reason || "GA4 no conectado";
    return `GA4 · ${data.data?.sessions ?? 0} sesiones · ${data.data?.users ?? 0} usuarios`;
  }
  if (data.intent === "gsc") {
    if (data.data?.configured === false) return data.data.reason || "Search Console no conectado";
    return `GSC · ${data.data?.clicks ?? 0} clicks · ${data.data?.impressions ?? 0} impresiones`;
  }
  if (data.intent === "competitors") {
    if (data.data?.configured === false) return data.data.reason || "Sin URLs de competencia";
    const pages = data.data?.pages ?? [];
    const down = pages.filter((row) => !row.ok).length;
    return `Competencia · ${pages.length} sitios · ${down} caídos`;
  }
  if (data.intent === "chart") {
    if (!data.data?.chart) {
      const names = (data.data?.available ?? []).map((row) => row.title || row.kpi).join(", ");
      return names ? `KPIs allowlisteados: ${names}` : "No hay gráfico para esa pregunta.";
    }
    return data.data.chart.title;
  }
  return JSON.stringify(data.data ?? data, null, 2).slice(0, 600);
}

function appendChart(chart, series) {
  const wrap = document.createElement("div");
  wrap.className = "bubble bubble--a";
  wrap.innerHTML = `<div style="font-weight:700;margin-bottom:8px">${esc(chart.title)}</div>${sparkline((series ?? []).map((row) => Number(row.value)))}`;
  $("askLog").appendChild(wrap);
  $("askLog").scrollTop = $("askLog").scrollHeight;
}

function appendBubble(role, text) {
  $("askHints").hidden = true;
  const bubble = document.createElement("div");
  bubble.className = `bubble bubble--${role}`;
  bubble.textContent = text;
  $("askLog").appendChild(bubble);
  $("askLog").scrollTop = $("askLog").scrollHeight;
}

async function login(cfg) {
  if (!cfg.clientId) {
    $("banner").hidden = false;
    $("banner").textContent = "Falta HORIZON_DASHBOARD_CLIENT_ID en el env del Control Plane.";
    return;
  }
  const verifier = randomString();
  const challenge = await sha256(new TextEncoder().encode(verifier));
  sessionStorage.setItem("pkce_verifier", verifier);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes,
    audience: cfg.audience,
    resource: cfg.resource,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "consent",
  });
  location.href = `${cfg.issuer}authorize?${params}`;
}

async function exchange(cfg) {
  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  if (!code) return;
  const verifier = sessionStorage.getItem("pkce_verifier");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: verifier ?? "",
  });
  const response = await fetch(`${cfg.issuer}oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error_description || json.error || "token_error");
  setToken(json.access_token);
  history.replaceState({}, "", "/app/");
}

function showTab(name, cfg) {
  renderTabs(name);
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.hidden = panel.id !== `panel-${name}`;
  });
  if (name === "sitio") setEmbed(cfg, $("siteUrl").value || "/");
  if (!token()) return;
  if (name === "overview" || name === "operaciones" || name === "ventas" || name === "alertas") {
    void loadOverview().catch((error) => {
      $("banner").hidden = false;
      $("banner").textContent = error.message;
    });
  }
  if (name === "analytics") {
    void loadAnalytics().catch((error) => {
      if ($("ga4Out")) $("ga4Out").innerHTML = notice(esc(error.message));
    });
  }
  if (name === "competencia") {
    void loadCompetitors().catch((error) => {
      if ($("competitorsOut")) $("competitorsOut").innerHTML = notice(esc(error.message));
    });
  }
  if (name === "seo") {
    void loadSeo().catch((error) => {
      $("seoPages").innerHTML = notice(esc(error.message));
    });
  }
  if (name === "catalogo") void searchCatalog("").catch((error) => {
    $("catalogOut").innerHTML = notice(esc(error.message));
  });
}

async function boot() {
  renderAuth();
  renderTabs("overview");
  $("askHints").innerHTML = `<span class="src" style="text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Probá</span>${HINTS.map((text) => `<button type="button" data-hint="${esc(text)}">${esc(text)}</button>`).join("")}`;
  const cfg = await loadConfig();
  cfgRef = cfg;
  setEmbed(cfg, "/");
  try {
    await exchange(cfg);
  } catch (error) {
    $("banner").hidden = false;
    $("banner").textContent = String(error.message || error);
  }
  $("loginBtn").addEventListener("click", () => login(cfg));
  $("logoutBtn").addEventListener("click", () => {
    setToken("");
    location.href = "/app/";
  });
  $("tabNav").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tab]");
    if (btn) showTab(btn.dataset.tab, cfg);
  });
  $("drawerBtn").addEventListener("click", () => setDrawer(!$("drawer").classList.contains("open")));
  $("drawerClose").addEventListener("click", () => setDrawer(false));
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setDrawer(true);
      $("askForm").querySelector("input").focus();
    }
  });
  $("siteGo").addEventListener("click", () => setEmbed(cfg, $("siteUrl").value));
  $("siteUrl").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setEmbed(cfg, $("siteUrl").value);
    }
  });
  $("siteHome").addEventListener("click", () => setEmbed(cfg, "/"));
  $("sitePdp").addEventListener("click", () => setEmbed(cfg, COLLECTION_PATH));
  $("catalogForm").addEventListener("submit", (event) => {
    event.preventDefault();
    void searchCatalog(String(new FormData(event.target).get("q") || "")).catch((error) => {
      $("catalogOut").innerHTML = notice(esc(error.message));
    });
  });
  $("evalAlerts").addEventListener("click", () => {
    void api("/v1/alerts/evaluate", { method: "POST", body: {} })
      .then(() => loadOverview())
      .catch((error) => {
        $("alertsOut").innerHTML = notice(esc(error.message));
      });
  });
  $("seoAuditBtn").addEventListener("click", () => {
    $("seoAuditBtn").disabled = true;
    void api("/v1/seo/audit", { method: "POST", body: {} })
      .then((job) => {
        $("seoStatus").textContent = `Job ${job.status || "queued"}`;
        return loadSeo();
      })
      .catch((error) => {
        $("seoAuditBtn").disabled = false;
        $("seoPages").innerHTML = notice(esc(error.message));
      });
  });
  $("askHints").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-hint]");
    if (!btn) return;
    $("askForm").querySelector("input").value = btn.dataset.hint;
    $("askForm").requestSubmit();
  });
  $("askForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const question = String(new FormData(event.target).get("question") || "");
    if (!question.trim()) return;
    appendBubble("q", question);
    void api("/v1/assistant/ask", { method: "POST", body: { question } })
      .then((data) => {
        appendBubble("a", replyText(data));
        if (data.intent === "chart" && data.data?.chart) appendChart(data.data.chart, data.data.series);
      })
      .catch((error) => appendBubble("a", error.message));
    event.target.reset();
  });
  const poll = () => {
    if (!token() || document.visibilityState !== "visible") return;
    void Promise.all([
      api("/v1/alerts").then((alerts) => {
        const open = (alerts.alerts ?? []).filter((row) => row.status === "open");
        $("announceAlerts").textContent = open.length ? `${open.length} alertas abiertas` : "";
      }),
      loadSeo(),
      loadAnalytics(),
    ]).catch(() => undefined);
  };
  setInterval(poll, 15_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") poll();
  });
  if (token()) {
    void loadOverview().catch((error) => {
      $("banner").hidden = false;
      $("banner").textContent = error.message;
    });
  }
}

void boot();

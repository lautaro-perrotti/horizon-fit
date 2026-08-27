const TOKEN_KEY = "horizon_dashboard_token";
const DEFAULT_STOREFRONT = "https://horizonfit.com.ar";
const PDP_PATH = "/product/top-liso-azul/";

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
  $("authState").textContent = logged ? "Sesión activa" : "Sin sesión";
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

function card(title, value, cls = "") {
  return `<article class="card"><h2>${esc(title)}</h2><p class="${esc(cls)}">${esc(value)}</p></article>`;
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
    if (url.origin !== origin || (url.protocol !== "https:" && url.protocol !== "http:")) return origin + "/";
    return url.toString();
  } catch {
    return origin + "/";
  }
}

function setEmbed(cfg, pathOrUrl) {
  const origin = storefrontOrigin(cfg);
  const url = safeEmbedUrl(pathOrUrl || "/", origin);
  $("siteFrame").src = url;
  $("siteUrl").value = url;
  $("siteOpen").href = url;
}

async function loadHealth() {
  const data = await api("/v1/health");
  $("healthGrid").innerHTML = [
    card("Estado", data.status, data.status === "healthy" ? "ok" : "warn"),
    card("Storefront", `${data.storefront.status ?? "—"} · ${data.storefront.latency_ms ?? "—"}ms`, data.storefront.ok ? "ok" : "bad"),
    card("API", `${data.api.status ?? "—"} · ${data.api.latency_ms ?? "—"}ms`, data.api.ok ? "ok" : "warn"),
    card("DB", data.db.healthy ? "ok" : "down", data.db.healthy ? "ok" : "bad"),
    card("Worker", data.control_plane.worker.healthy ? "ok" : "down", data.control_plane.worker.healthy ? "ok" : "bad"),
    card("Uptime", `${data.control_plane.uptime_s}s`),
    card("Repo", data.repo.branch ?? "—"),
  ].join("");
}

async function searchCatalog(query) {
  const sku = /^\d{3}-[A-Z]{3}-[A-Z]{3}/i.test(query.trim()) ? query.trim() : "";
  const path = sku
    ? `/v1/catalog/products/${encodeURIComponent(sku)}`
    : `/v1/catalog/products?q=${encodeURIComponent(query)}&limit=10`;
  const data = await api(path);
  const products = data.products ?? (data.sku ? [data] : []);
  $("catalogOut").innerHTML = products.length
    ? products
        .map(
          (product) =>
            `<div class="item"><div><strong>${esc(product.name)}</strong><div class="muted">${esc(product.sku || product.parent_sku)} · ${esc(product.stock_status)}</div></div><div>${esc(product.price?.amount ?? "—")} ${esc(product.price?.currency ?? "")}</div></div>`,
        )
        .join("")
    : `<p class="muted">Sin resultados</p>`;
}

async function loadSales() {
  const data = await api("/v1/commerce/sales");
  if (!data.configured) {
    $("salesOut").innerHTML = card("Ventas", data.reason || "Falta HORIZON_WOO_KEY", "warn");
    return;
  }
  const fmt = (bucket) => `${bucket.orders} pedidos · ${bucket.revenue ?? "—"} ${data.currency}`;
  $("salesOut").innerHTML = [
    card("Hoy", fmt(data.today)),
    card("Semana", fmt(data.week)),
    card("Mes", fmt(data.month)),
    ...(data.recent_orders ?? []).slice(0, 6).map((order) => card(`#${order.id}`, `${order.total} · ${order.status}`)),
  ].join("");
}

async function loadWoo() {
  const data = await api("/v1/commerce/settings");
  const links = [
    card("Storefront", data.storefront_url || "—"),
    card("API", data.api_url || "—"),
    `<article class="card"><h2>wp-admin</h2><p><a href="${esc(data.wp_admin_url)}" target="_blank" rel="noopener">${esc(data.wp_admin_url)}</a></p></article>`,
  ];
  if (!data.configured) {
    $("wooOut").innerHTML = links.join("") + card("Config Woo", data.reason || "Falta HORIZON_WOO_KEY", "warn");
    return;
  }
  const env = data.environment ?? {};
  const payments = (data.payments ?? [])
    .map(
      (gateway) =>
        `<div class="item"><div><strong>${esc(gateway.title)}</strong><div class="muted">${esc(gateway.id)}</div></div><div class="${gateway.enabled ? "ok" : "muted"}">${gateway.enabled ? "on" : "off"}</div></div>`,
    )
    .join("");
  const general = (data.general ?? [])
    .map((row) => `<div class="item"><div>${esc(row.label)}</div><div>${esc(row.value)}</div></div>`)
    .join("");
  $("wooOut").innerHTML = [
    ...links,
    card("Woo", env.wc_version || "—"),
    card("WordPress", env.wp_version || "—"),
    card("Moneda", `${env.currency || "—"} ${env.currency_symbol || ""}`),
    card("Idioma", env.language || "—"),
    general ? `<h2 class="muted">General</h2>${general}` : "",
    payments ? `<h2 class="muted">Pagos</h2>${payments}` : "",
  ].join("");
}

async function loadAlerts() {
  const data = await api("/v1/alerts");
  const rows = data.alerts ?? [];
  $("alertsOut").innerHTML = rows.length
    ? rows
        .map(
          (alert) =>
            `<div class="item"><div><strong>${esc(alert.title)}</strong><div class="muted">${esc(alert.rule_id)} · ${esc(alert.status)}</div></div><div class="${alert.severity === "critical" ? "bad" : "warn"}">${esc(alert.severity)}</div></div>`,
        )
        .join("")
    : `<p class="muted">Sin alertas</p>`;
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
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.hidden = panel.id !== `panel-${name}`;
  });
  if (name === "site") setEmbed(cfg, $("siteUrl").value || "/");
  if (!token()) return;
  if (name === "health") void loadHealth();
  if (name === "sales") void loadSales();
  if (name === "woo") void loadWoo();
  if (name === "alerts") void loadAlerts();
}

async function boot() {
  renderAuth();
  const cfg = await loadConfig();
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
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.tab, cfg));
  });
  $("siteGo").addEventListener("click", () => setEmbed(cfg, $("siteUrl").value));
  $("siteUrl").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setEmbed(cfg, $("siteUrl").value);
    }
  });
  $("siteHome").addEventListener("click", () => setEmbed(cfg, "/"));
  $("sitePdp").addEventListener("click", () => setEmbed(cfg, PDP_PATH));
  $("catalogForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const q = new FormData(event.target).get("q");
    void searchCatalog(String(q || "")).catch((error) => {
      $("catalogOut").innerHTML = `<p class="bad">${esc(error.message)}</p>`;
    });
  });
  $("evalAlerts").addEventListener("click", () => {
    void api("/v1/alerts/evaluate", { method: "POST", body: {} })
      .then(loadAlerts)
      .catch((error) => {
        $("alertsOut").innerHTML = `<p class="bad">${esc(error.message)}</p>`;
      });
  });
  $("askForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const question = String(new FormData(event.target).get("question") || "");
    if (!question.trim()) return;
    const log = $("askLog");
    log.textContent += (log.textContent ? "\n\n" : "") + `> ${question}`;
    void api("/v1/assistant/ask", { method: "POST", body: { question } })
      .then((data) => {
        log.textContent += `\n${JSON.stringify(data, null, 2)}`;
        log.scrollTop = log.scrollHeight;
      })
      .catch((error) => {
        log.textContent += `\n${error.message}`;
      });
    event.target.reset();
  });
}

void boot();

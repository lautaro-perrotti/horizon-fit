// Horizon Control SPA entry. Hash routes, one module per view (core/views.js), persistent chrome.
import { api, attempt, clearCache, configureApi } from "./core/api.js";
import * as auth from "./core/auth.js";
import { html, mount } from "./core/html.js";
import { createViewContext, toast } from "./core/kit.js";
import * as prefs from "./core/prefs.js";
import { matchRoute, navigate, parseHash, setQuery } from "./core/router.js";
import { VIEWS, hrefFor } from "./core/views.js";
import { renderRail, renderTopbar, updatePulse } from "./ui/shell.js";
import { ask, focusConsulta, initConsulta, refreshConsulta } from "./ui/consulta.js";
import { closePalette, initPalette, isPaletteOpen, openPalette } from "./ui/palette.js";
import { empty } from "./ui/components.js";
import { renderLogin } from "./views/login.js";

const $ = (id) => document.getElementById(id);
const app = {
  cfg: null,
  fixtures: false,
  allowed: null,
  current: null,
  pulse: null,
  badges: {},
  consultaOpen: false,
  user: null,
  routeSeq: 0,
};

function can(tool) {
  return app.allowed ? app.allowed.has(tool) : true;
}

function shell() {
  return $("app");
}

function setConsulta(open) {
  app.consultaOpen = open;
  shell().dataset.consulta = open ? "open" : "closed";
  try {
    localStorage.setItem("hc_consulta", open ? "1" : "0");
  } catch {
    /* ignore */
  }
  drawChrome();
  if (open) {
    refreshConsulta();
    setTimeout(() => focusConsulta(), 0);
  }
}

function consultaContext() {
  const cur = app.current;
  const sku = cur?.view.id === "producto" && cur.params.ref ? String(cur.params.ref).toUpperCase() : null;
  return { sku, w: cur?.win?.w };
}

const consultaApi = {
  open(question, context) {
    setConsulta(true);
    if (question) setTimeout(() => focusConsulta(context ? `${question}` : question), 0);
  },
  ask(question) {
    setConsulta(true);
    void ask(question);
  },
};

function drawChrome() {
  const cur = app.current;
  renderRail($("rail"), {
    active: cur?.view.id,
    activeParam: cur?.view.id === "producto" ? String(cur?.params.ref ?? "").toUpperCase() : null,
    badges: app.badges,
    recent: prefs.recentSkus(),
    theme: prefs.theme(),
    user: app.user,
    fixtures: app.fixtures,
  });
  renderTopbar($("topbar"), {
    crumb: cur?.crumb ?? "Hoy",
    win: cur?.win ?? prefs.windowFrom({}),
    pulse: app.pulse,
    consultaOpen: app.consultaOpen,
    fixtures: app.fixtures,
  });
}

async function route() {
  const seq = ++app.routeSeq;
  const parsed = parseHash();
  const match = matchRoute(VIEWS, parsed.segments);
  if (!match) {
    navigate("/", parsed.query, { replace: true });
    return;
  }
  const win = prefs.windowFrom(parsed.query);
  prefs.rememberWindow(win);
  app.current?.ctx?.destroy();
  const { view, params } = match;
  const root = $("view");
  app.current = { view, params, win, crumb: view.label, ctx: null };
  drawChrome();
  let mod;
  try {
    mod = await view.load();
  } catch (error) {
    mount(root, empty({ status: "error", title: "No se pudo cargar la vista", reason: String(error?.message ?? error) }));
    return;
  }
  if (seq !== app.routeSeq) return;
  const crumb = mod.crumb ? mod.crumb(params) : view.label;
  app.current.crumb = crumb;
  document.title = `${crumb} — Horizon Control`;
  drawChrome();
  mount(root, "");
  window.scrollTo(0, 0);
  const ctx = createViewContext({
    root,
    params,
    query: parsed.query,
    win,
    cfg: app.cfg,
    can,
    nav: { go: (path, query) => navigate(path, { ...query, w: win.w, cmp: win.cmp ? undefined : "0" }), setQuery, hrefFor },
    consulta: consultaApi,
    setCrumb: (text) => {
      if (!app.current || app.current.ctx !== ctx) return;
      app.current.crumb = text;
      document.title = `${text} — Horizon Control`;
      drawChrome();
    },
    refreshBadges: () => void refreshBadges(),
  });
  app.current.ctx = ctx;
  try {
    await mod.render(ctx);
  } catch (error) {
    if (ctx.alive()) mount(root, empty({ status: "error", title: "La vista falló al dibujarse", reason: String(error?.message ?? error) }));
  }
  if (view.id === "producto" || app.consultaOpen) refreshConsulta();
}

async function refreshPulse() {
  const [healthz, health, alerts] = await Promise.all([
    api("/healthz", { fresh: true }).catch(() => null),
    attempt("/v1/health", { fresh: true }),
    attempt("/v1/alerts", { fresh: true }),
  ]);
  const open = alerts.ok ? (alerts.data.alerts ?? []).filter((row) => row.status === "open") : null;
  app.pulse = {
    site: health.ok ? health.data.storefront : null,
    api: health.ok ? health.data.api : null,
    control: health.ok ? health.data.status : healthz?.ok ? "healthy" : null,
    workerAt: healthz?.worker?.last_tick_at ?? health.data?.control_plane?.worker?.last_tick_at ?? null,
    alerts: open ? open.length : null,
    critical: open ? open.some((row) => row.severity === "critical") : false,
  };
  if (open) app.badges.alerts = { count: open.length, tone: app.pulse.critical ? "bad" : "warn" };
  updatePulse($("topbar"), app.pulse);
}

async function refreshBadges() {
  const [opps, seo, comp] = await Promise.all([
    can("growth.list_opportunities") ? attempt("/v1/growth/opportunities?status=open") : null,
    can("seo.get_latest_audit") ? attempt("/v1/seo/audits/latest") : null,
    can("competition.list") ? attempt("/v1/competition") : null,
  ]);
  if (opps?.ok) app.badges.opportunities = { count: (opps.data.opportunities ?? []).length };
  if (seo?.ok) {
    const critical = seo.data.summary?.totals?.critical ?? 0;
    app.badges.seo = { count: critical, tone: critical ? "bad" : "" };
  }
  if (comp?.ok) {
    const down = (comp.data.snapshots ?? []).filter((row) => row.error || (row.status != null && row.status >= 400)).length;
    app.badges.competitors = { count: down, tone: "warn" };
  }
  drawChrome();
}

function paletteActions() {
  const sku = consultaContext().sku;
  return [
    {
      label: "Auditar SEO ahora",
      tool: "seo.audit",
      run: async () => {
        try {
          const job = await api("/v1/seo/audit", { method: "POST", body: {} });
          toast(`Auditoría SEO ${job.status === "queued" ? "en cola" : job.status}.`);
          location.hash = hrefFor("seo");
        } catch (error) {
          toast(`No se pudo auditar: ${error.message}`);
        }
      },
    },
    {
      label: "Evaluar alertas ahora",
      tool: "alerts.evaluate",
      run: async () => {
        try {
          await api("/v1/alerts/evaluate", { method: "POST", body: {} });
          toast("Alertas evaluadas.");
          void refreshPulse();
        } catch (error) {
          toast(`No se pudo evaluar: ${error.message}`);
        }
      },
    },
    ...(sku
      ? [
          {
            label: `Generar meta description para ${sku}`,
            tool: "content.generate",
            run: async () => {
              try {
                const draft = await api("/v1/content/generate", { method: "POST", body: { kind: "seo_meta", parent_sku: sku } });
                location.hash = hrefFor("contenido", draft.id);
              } catch (error) {
                toast(`No se pudo generar: ${error.message}`);
              }
            },
          },
        ]
      : []),
    { label: prefs.theme() === "dawn" ? "Cambiar a tema Dusk" : "Cambiar a tema Dawn", run: () => toggleTheme() },
    { label: "Colapsar o abrir el rail", run: () => toggleRail() },
  ];
}

function toggleTheme(value) {
  prefs.setTheme(value ?? (prefs.theme() === "dawn" ? "dusk" : "dawn"));
  void route();
}

function toggleRail() {
  const next = !prefs.railCollapsed();
  prefs.setRailCollapsed(next);
  shell().dataset.rail = next ? "collapsed" : "open";
}

let pendingG = 0;
function onKey(event) {
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();
  if (mod && key === "k") {
    event.preventDefault();
    if (isPaletteOpen()) closePalette();
    else openPalette();
    return;
  }
  if (mod && key === "j") {
    event.preventDefault();
    setConsulta(!app.consultaOpen);
    return;
  }
  const typing = /^(input|textarea|select)$/i.test(event.target.tagName) || event.target.isContentEditable;
  if (typing || mod || event.altKey || isPaletteOpen()) return;
  if (key === "[") {
    toggleRail();
  } else if (key === "/") {
    const search = $("view").querySelector("[data-search]");
    if (search) {
      event.preventDefault();
      search.focus();
    }
  } else if (key === "g") {
    pendingG = Date.now();
  } else if (pendingG && Date.now() - pendingG < 1200) {
    pendingG = 0;
    const view = VIEWS.find((row) => row.keys === key);
    if (view) location.hash = hrefFor(view.id);
  }
}

function onChromeClick(event) {
  const target = event.target.closest("[data-act]");
  if (!target) return;
  const act = target.dataset.act;
  if (act === "theme") toggleTheme(target.dataset.v);
  if (act === "rail-toggle") toggleRail();
  if (act === "logout") auth.logout();
  if (act === "palette") openPalette();
  if (act === "consulta") setConsulta(!app.consultaOpen);
  if (act === "window") {
    const win = { ...prefs.windowFrom(parseHash().query), w: target.dataset.v };
    prefs.rememberWindow(win);
    setQuery({ w: win.w });
  }
  if (act === "relogin") void auth.login(app.cfg).catch((error) => toast(error.message));
}

function onChromeChange(event) {
  if (event.target.dataset?.act !== "compare") return;
  const cmp = event.target.checked;
  prefs.rememberWindow({ ...prefs.windowFrom(parseHash().query), cmp });
  setQuery({ cmp: cmp ? "1" : "0" });
}

function sessionExpired() {
  mount(
    $("banner"),
    html`<div class="banner" style="margin: 16px 32px 0;">
      <span class="chip" data-s="session">sesión vencida</span>
      <span>Tu sesión de Auth0 venció. Entrá de nuevo y volvés a esta misma vista.</span>
      <button type="button" class="btn btn-act btn-sm push" data-act="relogin">Entrar de nuevo</button>
    </div>`,
  );
}

function userFromClaims() {
  if (app.fixtures) return { name: "Fixtures locales", initial: "F" };
  const claims = auth.claims() ?? {};
  const name = claims.name || claims.nickname || claims.email || "Operador";
  const scopes = String(claims.scope ?? "").split(" ").filter((s) => s && s !== "openid").length || (claims.permissions ?? []).length || null;
  return { name, initial: name.slice(0, 1), scopes };
}

async function showApp() {
  $("login").hidden = true;
  shell().hidden = false;
  shell().dataset.rail = prefs.railCollapsed() ? "collapsed" : "open";
  app.user = userFromClaims();
  drawChrome();
  mount($("view"), html`<div class="loading-block"><span class="sk" style="height: 52px; width: 50%;"></span><span class="sk" style="height: 14px; width: 70%;"></span></div>`);
  const tools = await attempt("/v1/tools");
  if (tools.ok && Array.isArray(tools.data.tools)) app.allowed = new Set(tools.data.tools);
  initConsulta($("consulta"), { can, getContext: consultaContext, close: () => setConsulta(false) });
  initPalette($("palette-root"), { can, actions: paletteActions, ask: (q) => consultaApi.ask(q) });
  let open = false;
  try {
    open = localStorage.getItem("hc_consulta") === "1";
  } catch {
    open = false;
  }
  shell().dataset.consulta = open ? "open" : "closed";
  app.consultaOpen = open;
  document.addEventListener("click", onChromeClick);
  document.addEventListener("change", onChromeChange);
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", () => void route());
  await route();
  void refreshPulse();
  void refreshBadges();
  setInterval(() => {
    if (document.visibilityState === "visible") void refreshPulse();
  }, 60_000);
  setInterval(() => {
    if (document.visibilityState === "visible") {
      clearCache("/v1/growth");
      void refreshBadges();
    }
  }, 300_000);
}

async function boot() {
  prefs.setTheme(prefs.theme());
  const cfg = await fetch("/app/config.json").then((res) => res.json());
  app.cfg = cfg;
  if (cfg.fixtures) {
    const mod = await import("./dev/fixtures.js");
    const scenario = new URLSearchParams(location.search).get("scenario") || "hoy";
    configureApi({ fixtures: mod.createFixtures(scenario) });
    app.fixtures = true;
    await showApp();
    return;
  }
  configureApi({ getToken: auth.getToken, onSessionExpired: sessionExpired });
  let loginError = null;
  try {
    await auth.completeLogin(cfg);
  } catch (error) {
    loginError = String(error?.message ?? error);
  }
  if (!auth.getToken()) {
    shell().hidden = true;
    $("login").hidden = false;
    renderLogin($("login"), { cfg, expired: auth.hadSession(), error: loginError });
    return;
  }
  await showApp();
}

void boot();

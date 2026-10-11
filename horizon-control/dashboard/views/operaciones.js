// Operaciones: health of the storefront and of Control. Scope-gated blocks render their 403 state.
import { html, mount } from "../core/html.js";
import { api, attempt } from "../core/api.js";
import { ago, dateTime, money, num } from "../core/format.js";
import { chip, empty, errorState, loading, pip } from "../ui/components.js";

export const crumb = () => "Operaciones";

function uptime(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s)) return "—";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 172800) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}

function gated(ctx, slot, tool, title, what, load, render) {
  if (!ctx.can(tool)) {
    mount(
      ctx.slot(slot),
      html`<header class="panel-head"><h2>${title}</h2><span class="push">${chip("scope", "403 · falta scope")}</span></header>
        ${empty({ status: "", title: "Vista previa", body: `${what} El cliente del dashboard no pide este permiso; se habilita en Auth0, no desde acá.`, reason: tool, tone: "solid" })}`,
    );
    return;
  }
  void ctx.fill(slot, load, (data) => html`<header class="panel-head"><h2>${title}</h2><span class="push">${chip("ok")}</span></header>${render(data)}`, { what: title.toLowerCase() });
}

export async function render(ctx) {
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div><h1 class="disp">Operaciones</h1><p>Salud de la tienda y de Control: un proceso en el VPS, solo por Tailscale, con worker y SQLite propios.</p></div>
        <span class="row strong" data-slot="status"></span>
      </section>
      <section class="strip" style="--min: 170px;" data-slot="health">${loading(1)}</section>
      <section class="grid-auto" style="--min: 440px;">
        <article class="panel pad stack" style="gap: 0;" data-slot="syncs">${loading(6)}</article>
        <div class="stack" style="gap: 16px;">
          <article class="panel pad stack" data-slot="ai">${loading(3)}</article>
          <article class="panel pad stack" data-slot="woo">${loading(3)}</article>
        </div>
      </section>
      <section class="grid-auto" style="--min: 320px;">
        <article class="panel pad stack" data-slot="repo">${loading(3)}</article>
        <article class="panel pad stack" data-slot="audit">${loading(3)}</article>
      </section>`,
  );

  const [health, healthz] = await Promise.all([attempt("/v1/health", { fresh: true }), api("/healthz", { fresh: true }).catch(() => null)]);
  if (!ctx.alive()) return;
  if (!health.ok) mount(ctx.slot("health"), errorState(health.error, "la salud"));
  else {
    const h = health.data;
    const cell = (name, ok, value, sub) => html`<div><span class="row" style="gap: 8px;">${pip(ok ? "ok" : "critical")}<span class="lbl" style="color: var(--ink-2);">${name}</span></span><span style="font-size: 18px; font-weight: 700;">${value}</span><span class="mono xs muted ellipsis">${sub}</span></div>`;
    mount(ctx.slot("status"), html`${pip(h.status === "healthy" ? "ok" : h.status === "degraded" ? "warning" : "critical")}${h.status}`);
    mount(
      ctx.slot("health"),
      html`
        ${cell("Storefront", h.storefront?.ok, `${h.storefront?.status ?? "—"} · ${num(h.storefront?.latency_ms)} ms`, h.storefront?.url ?? "")}
        ${cell("API Woo", h.api?.ok, `${h.api?.status ?? "—"} · ${num(h.api?.latency_ms)} ms`, h.api?.url ?? "")}
        ${cell("Repo de Fit", Boolean(h.repo?.head), `${h.repo?.branch ?? "—"} · ${String(h.repo?.head ?? "—").slice(0, 8)}`, "HEAD del checkout de la tienda")}
        ${cell("Control", h.status === "healthy", `uptime ${uptime(h.control_plane?.uptime_s)}`, healthz?.bind ? `bind ${healthz.bind}` : "")}
        ${cell("Worker", h.control_plane?.worker?.healthy !== false, `tick ${h.control_plane?.worker?.last_tick_at ? ago(h.control_plane.worker.last_tick_at) : "—"}`, "cola SQLite")}
        ${cell("Base", h.db?.healthy, h.db?.healthy ? "SQLite ok" : "SQLite caída", "backup cada 6 h")}`,
    );
  }

  // Syncs: real last-success timestamps from each source.
  const series = (metric) => attempt(`/v1/metrics/series?metric=${metric}&range=7d&compare=none`).then((r) => (r.ok ? r.data.sync : null));
  const [salesSync, ga4Sync, gscSync, competition, opps, seo, customers] = await Promise.all([
    series("revenue"),
    series("sessions"),
    series("clicks"),
    attempt("/v1/competition"),
    attempt("/v1/growth/opportunities"),
    attempt("/v1/seo/audits/latest"),
    attempt("/v1/customers"),
  ]);
  if (!ctx.alive()) return;
  const latest = (rows, key) => rows.map((row) => row[key]).filter(Boolean).sort().at(-1) ?? null;
  const syncRow = (id, every, at, status, reason) => ({ id, every, at, status, reason });
  const rows = [
    syncRow("sales.sync", "2 min", salesSync?.last_success_at, salesSync?.last_status ?? (salesSync ? "ok" : "unknown"), salesSync?.last_reason),
    syncRow("ga4.sync", "30 min", ga4Sync?.last_success_at, ga4Sync?.last_status ?? (ga4Sync ? "ok" : "unknown"), ga4Sync?.last_reason),
    syncRow("gsc.sync", "12 h", gscSync?.last_success_at, gscSync?.last_status ?? (gscSync ? "ok" : "unknown"), gscSync?.last_reason),
    syncRow("competitor.snapshot", "12 h", competition.ok ? competition.data.fetched_at : null, competition.ok ? (competition.data.configured === false ? "not_configured" : "ok") : "error"),
    syncRow("growth.evaluate", "30 min", opps.ok ? latest(opps.data.opportunities ?? [], "detected_at") : null, opps.ok ? "ok" : "error"),
    syncRow("customers.aggregate", "30 min", customers.ok ? customers.data.fetched_at : null, customers.ok ? (customers.data.configured === false ? "not_configured" : "ok") : "error"),
    syncRow("seo.audit", "12 h", seo.ok ? seo.data.job?.finishedAt ?? seo.data.summary?.generatedAt : null, seo.ok ? (seo.data.job?.status === "failed" ? "error" : seo.data.configured === false ? "not_configured" : "ok") : "error"),
  ];
  mount(
    ctx.slot("syncs"),
    html`<header class="panel-head" style="padding-bottom: 10px;"><h2>Syncs y jobs programados</h2><span class="small muted">los encola la evaluación de cada 60 s</span></header>
      <div class="rows flush" style="--cols: minmax(0, 1fr) 64px 110px 104px;">
        <div class="rows-head"><span>Job</span><span>Cada</span><span>Último ok</span><span>Estado</span></div>
        ${rows.map(
          (row) => html`<div class="rows-row small"><span class="mono">${row.id}</span><span class="soft">${row.every}</span><span class="soft" title="${row.at ?? ""}">${row.at ? ago(row.at) : "—"}</span><span>${chip(["ok", "zero", "error", "not_configured", "stale", "unknown"].includes(row.status) ? row.status : "unknown", undefined, row.reason ?? row.status)}</span></div>`,
        )}
      </div>
      <p class="xs muted" style="padding-top: 10px;">Sin reintentos: un job que falla abre <span class="mono">job_failed</span> y espera la próxima ventana. merchant.audit corre solo a pedido.</p>`,
  );

  // Gateway de IA
  if (ctx.can("ai.usage") || ctx.can("ai.models")) {
    const [usage, models] = await Promise.all([attempt("/v1/ai/usage"), attempt("/v1/ai/models")]);
    if (!ctx.alive()) return;
    const u = usage.ok ? usage.data : null;
    const m = models.ok ? models.data : null;
    mount(
      ctx.slot("ai"),
      html`<header class="panel-head"><h2>Gateway de IA</h2><span class="push">${chip(m?.configured ? "ok" : "not_configured", m?.configured ? "con keys" : "sin keys")}</span></header>
        ${usage.ok || models.ok
          ? html`<div class="grid-auto" style="--min: 110px; gap: 10px;">
                <div class="well stack" style="gap: 4px;"><span class="lbl">Llamadas hoy</span><span style="font-size: 20px; font-weight: 700;">${num(u?.calls ?? 0)}</span></div>
                <div class="well stack" style="gap: 4px;"><span class="lbl">Gasto hoy</span><span style="font-size: 20px; font-weight: 700;">USD ${num(u?.cost_usd ?? 0, 2)}</span></div>
                <div class="well stack" style="gap: 4px;"><span class="lbl">Tope diario</span><span style="font-size: 20px; font-weight: 700;">USD ${num(u?.budget?.daily_usd, 0)}</span></div>
                <div class="well stack" style="gap: 4px;"><span class="lbl">Tokens por usuario</span><span style="font-size: 20px; font-weight: 700;">${num(u?.budget?.user_tokens)}</span></div>
              </div>
              <span class="xs muted">${(m?.models ?? []).map((row) => `${row.alias ?? row.id}${row.configured ? "" : " (sin key)"}`).join(" · ") || "Sin modelos declarados"}. ${m?.configured ? "" : "Consulta usa el modo determinístico."}</span>`
          : errorState(usage.error, "el gateway de IA")}`,
    );
  } else {
    mount(ctx.slot("ai"), html`<header class="panel-head"><h2>Gateway de IA</h2></header>${empty({ status: "scope", title: "Vista previa", body: "Falta el scope ai.read." })}`);
  }

  // Woo settings
  void ctx.fill(
    "woo",
    () => api("/v1/commerce/settings"),
    (s) =>
      s.configured === false
        ? html`<header class="panel-head"><h2>Woo</h2></header>${empty({ status: "not_configured", title: "Sin credenciales de Woo REST", body: "Cargá HORIZON_WOO_KEY y HORIZON_WOO_SECRET.", reason: s.reason })}`
        : html`<header class="panel-head"><h2>Woo</h2><span class="push">${chip("ok", "commerce.settings")}</span></header>
            <div class="kv">
              <span>Moneda</span><span>${s.environment?.currency ?? "—"}</span>
              <span>WooCommerce</span><span>${s.environment?.wc_version ?? "—"}</span>
              <span>WordPress</span><span>${s.environment?.wp_version ?? "—"}</span>
              <span>Idioma</span><span>${s.environment?.language ?? "—"}</span>
              <span>Pagos activos</span><span>${(s.payments ?? []).filter((p) => p.enabled).map((p) => p.title).join(" · ") || "ninguno"}</span>
            </div>
            ${s.wp_admin_url ? html`<a class="small strong" href="${s.wp_admin_url}" target="_blank" rel="noopener">Abrir wp-admin ↗</a>` : ""}`,
    { what: "la configuración de Woo" },
  );

  gated(ctx, "repo", "repo.status", "Repo de Fit", "Rama, HEAD, archivos sucios y ahead/behind del checkout de la tienda en el VPS.", () => api("/v1/repo/status"), (r) =>
    r.error
      ? empty({ status: "not_configured", title: "Repo sin configurar", reason: r.error })
      : html`<div class="kv"><span>Rama</span><span class="mono">${r.branch}</span><span>HEAD</span><span class="mono">${String(r.head ?? "").slice(0, 12)}</span><span>Sucio</span><span>${r.dirty ? `${num(r.dirty_summary?.changed ?? r.dirty_files?.length ?? 0)} archivos` : "limpio"}</span><span>Ahead / behind</span><span>${num(r.ahead)} / ${num(r.behind)}</span><span>Remoto</span><span class="mono xs">${r.remote ?? "—"}</span></div>`,
  );
  gated(ctx, "audit", "audit.history", "Auditoría de llamadas", "Quién llamó qué herramienta, con qué scope y con qué resultado.", () => api("/v1/audit/history?limit=20"), (d) =>
    (d.events ?? []).length
      ? html`<div class="rows flush" style="--cols: 96px minmax(0, 1fr) 70px 60px;">${d.events.map(
          (e) => html`<div class="rows-row xs"><span class="muted">${dateTime(e.at ?? e.timestamp)}</span><span class="mono ellipsis">${e.tool}</span><span class="${e.outcome === "ok" || e.status === "ok" ? "ok-t" : "bad-t"}">${e.outcome ?? e.status}</span><span class="n muted">${num(e.durationMs)} ms</span></div>`,
        )}</div>`
      : html`<p class="small muted">Sin eventos.</p>`,
  );
}

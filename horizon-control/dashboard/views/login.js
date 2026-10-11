// Logged-out screen. The pulse comes from /healthz, which needs no session.
import { html, mount } from "../core/html.js";
import { ISOTIPO, pip } from "../ui/components.js";
import * as auth from "../core/auth.js";

function pulseRow(health) {
  if (!health) return html`<span class="muted">Control no respondió a /healthz.</span>`;
  const integrations = health.integrations ?? {};
  return html`
    <span>${pip("ok")}Control ${health.ok ? "healthy" : "con problemas"}</span>
    <span>${pip(health.worker?.stopped ? "warning" : "ok")}worker ${health.worker?.stopped ? "detenido" : "activo"}</span>
    <span>${pip(integrations.woo ? "ok" : "off")}Woo ${integrations.woo ? "conectado" : "sin keys"}</span>
    <span>${pip(integrations.ga4 ? "ok" : "off")}GA4 ${integrations.ga4 ? "conectado" : "sin configurar"}</span>
    <span>${pip(integrations.competitors ? "ok" : "off")}Competencia</span>
    <span>${pip(integrations.ai ? "ok" : "off")}IA ${integrations.ai ? "con keys" : "sin keys"}</span>`;
}

export function renderLogin(node, { cfg, expired, error: initialError }) {
  let health;
  let error = initialError;
  const draw = () =>
    mount(
      node,
      html`<div class="login">
        <header>
          <span class="row" style="gap: 12px;">${ISOTIPO}<span class="disp" style="font-size: 18px; letter-spacing: 0.02em;">Horizon Control</span></span>
          <span class="row small muted">${pip("ok")}Solo por Tailscale · ${location.host}</span>
        </header>
        <main>
          <div class="stack" style="gap: 18px; max-width: 760px;">
            <span class="lbl" style="color: var(--ink-2);">Sala de control · Horizon Fit</span>
            <h1 class="disp">Cómo vamos,<br>qué hacer hoy.</h1>
            <p style="font-size: 17px; line-height: 1.5; color: var(--ink-2); max-width: 560px;">Ventas, demanda, SEO, Merchant y competencia de horizonfit.com.ar en una sola lectura. Control solo lee: nunca escribe en la tienda.</p>
          </div>
          ${expired ? html`<div class="banner" style="max-width: 640px;"><span class="chip" data-s="session">sesión vencida</span>Tu sesión anterior venció. Entrá de nuevo.</div>` : ""}
          ${error ? html`<div class="banner bad" style="max-width: 640px;"><span class="chip" data-s="error">error</span>${error}</div>` : ""}
          ${cfg.clientId
            ? ""
            : html`<div class="banner bad" style="max-width: 640px;"><span class="chip" data-s="not_configured">sin configurar</span>Falta HORIZON_DASHBOARD_CLIENT_ID en el env del Control Plane.</div>`}
          <div class="row wrap" style="gap: 16px;">
            <button type="button" class="btn btn-act btn-lg" data-login ${cfg.clientId ? "" : "disabled"}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path></svg>
              Entrar
            </button>
            <span class="small muted" style="max-width: 460px;">Auth0 con PKCE. El token vive en esta pestaña; las claves de Woo y Google nunca llegan al navegador.</span>
          </div>
        </main>
        <div class="horizon" aria-hidden="true"></div>
        <footer><span class="lbl">Pulso sin sesión</span>${pulseRow(health)}</footer>
      </div>`,
    );
  draw();
  node.addEventListener("click", (event) => {
    if (!event.target.closest("[data-login]")) return;
    auth.login(cfg).catch((err) => {
      error = String(err?.message ?? err);
      draw();
    });
  });
  fetch("/healthz")
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
    .then((data) => {
      health = data;
      draw();
    });
}

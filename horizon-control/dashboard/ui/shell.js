// Persistent chrome: rail (generated from the view registry), topbar with global window and pulse.
import { html, mount } from "../core/html.js";
import { GROUPS, VIEWS, hrefFor } from "../core/views.js";
import { WINDOWS } from "../core/prefs.js";
import { ISOTIPO, icon, pip } from "./components.js";
import { ago, num } from "../core/format.js";

export const MOD = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl ";

export function renderRail(node, { active, activeParam, badges = {}, recent = [], theme, user, fixtures }) {
  mount(
    node,
    html`
      <a class="rail-brand" href="#/" title="Horizon Control">${ISOTIPO}<span>Horizon Control</span></a>
      <div class="rail-nav">
        ${GROUPS.map(
          (group) => html`<div class="rail-group">
            <div class="lbl">${group.label}</div>
            ${VIEWS.filter((view) => view.group === group.id).map((view) => {
              const badge = view.badge ? badges[view.badge] : null;
              return html`
                <a class="nav-i" href="${hrefFor(view.id)}" aria-current="${view.id === active && !(view.recent && activeParam) ? "page" : "false"}" title="${view.label}">
                  ${icon(view.icon)}<span>${view.label}</span>
                  ${badge && badge.count ? html`<span class="badge" data-v="${badge.tone ?? ""}">${num(badge.count)}</span>` : ""}
                </a>
                ${view.recent
                  ? recent.map(
                      (sku) => html`<a class="nav-i nav-sub" href="${hrefFor("producto", sku)}" aria-current="${active === "producto" && activeParam === sku ? "page" : "false"}">${sku}</a>`,
                    )
                  : ""}`;
            })}
          </div>`,
        )}
      </div>
      <div class="rail-foot">
        <div class="seg" role="group" aria-label="Tema">
          <button type="button" data-act="theme" data-v="dusk" aria-pressed="${theme !== "dawn"}">Dusk</button>
          <button type="button" data-act="theme" data-v="dawn" aria-pressed="${theme === "dawn"}">Dawn</button>
        </div>
        <div class="rail-user">
          <span class="avatar" aria-hidden="true">${(user?.initial ?? "·").toUpperCase()}</span>
          <div class="stack" style="gap: 0; min-width: 0;">
            <span class="small strong ellipsis">${user?.name ?? "Sesión"}</span>
            <span class="xs muted ellipsis">${fixtures ? "fixtures locales" : user?.scopes ? `Auth0 · ${user.scopes} scopes` : "Auth0"}</span>
          </div>
          <button type="button" class="btn btn-ghost btn-sm push" data-act="logout">Salir</button>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-act="rail-toggle" style="justify-content: space-between;" title="Colapsar o abrir el rail ([)">
          <span class="hide-collapsed">Colapsar rail</span><span class="kbd">[</span>
        </button>
      </div>`,
  );
}

function pulseItems(pulse) {
  if (!pulse) return html`<span class="muted">pulso…</span>`;
  const site = pulse.site;
  const api = pulse.api;
  const worker = pulse.workerAt ? ago(pulse.workerAt).replace("hace ", "") : "—";
  return html`
    <span title="Storefront ${site?.status ?? "—"}">${pip(site?.ok ? "ok" : site ? "critical" : "off")}<span class="pl">sitio ${site?.status ?? "—"}</span></span>
    <span title="API Woo ${api?.status ?? "—"}">${pip(api?.ok ? "ok" : api ? "critical" : "off")}<span class="pl">API</span></span>
    <span title="Control Plane ${pulse.control ?? "—"}">${pip(pulse.control === "healthy" ? "ok" : pulse.control ? "warning" : "off")}<span class="pl">Control</span></span>
    <span title="Último tick del worker: ${worker}">${pip(pulse.workerAt ? "ok" : "off")}<span class="pl">worker ${worker}</span></span>
    ${pulse.alerts != null
      ? html`<a href="#/alertas" style="display: inline-flex; align-items: center; gap: 5px; color: ${pulse.alerts ? "var(--bad)" : "var(--ink-2)"};">${pip(pulse.critical ? "critical" : pulse.alerts ? "warning" : "ok")}${pulse.alerts === 1 ? "1 alerta" : `${num(pulse.alerts)} alertas`}</a>`
      : ""}`;
}

export function renderTopbar(node, { crumb, win, pulse, consultaOpen, fixtures }) {
  mount(
    node,
    html`
      <div class="crumb">
        <span class="store-chip">${pip(pulse?.site?.ok === false ? "critical" : "ok")}Horizon Fit</span>
        <span aria-hidden="true" class="muted">/</span>
        <span class="ellipsis strong" style="font-size: 13px;">${crumb}</span>
        ${fixtures ? html`<span class="fixture-flag" title="Datos de prueba locales">fixtures</span>` : ""}
      </div>
      <div class="row">
        <div class="seg" role="group" aria-label="Ventana de tiempo">
          ${WINDOWS.map((row) => html`<button type="button" data-act="window" data-v="${row.id}" aria-pressed="${win.w === row.id}">${row.label}</button>`)}
        </div>
        <label class="inline"><input type="checkbox" data-act="compare" ${win.cmp ? "checked" : ""}> vs anterior</label>
      </div>
      <div class="pulse" role="status" aria-label="Pulso de fuentes" data-slot="pulse">${pulseItems(pulse)}</div>
      <div class="row">
        <button type="button" class="btn search-btn" data-act="palette" style="justify-content: space-between; color: var(--ink-3) !important; font-weight: 500;">Buscar SKU o acción <span class="kbd">${MOD}K</span></button>
        <button type="button" class="btn" data-act="consulta" aria-pressed="${consultaOpen}" style="${consultaOpen ? "background: var(--sel);" : ""}">Consulta <span class="kbd">${MOD}J</span></button>
      </div>`,
  );
}

export function updatePulse(node, pulse) {
  const slot = node?.querySelector('[data-slot="pulse"]');
  if (slot) mount(slot, pulseItems(pulse));
}

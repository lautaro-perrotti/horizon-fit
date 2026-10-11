// View context. Every block loads on its own: a failing source renders its own state, the page stays up.
import { mount } from "./html.js";
import { errorState, loading } from "../ui/components.js";

export function createViewContext({ root, params, query, win, cfg, can, nav, consulta, setCrumb, refreshBadges }) {
  let alive = true;
  const cleanups = [];
  const ctx = {
    root,
    params,
    query,
    win,
    cfg,
    can,
    nav,
    consulta,
    setCrumb,
    refreshBadges,
    alive: () => alive,
    slot(name) {
      return root.querySelector(`[data-slot="${name}"]`);
    },
    /** Renders `render(data)` into a slot once `load()` resolves; loading and error states included. */
    async fill(name, load, render, { what, lines = 3 } = {}) {
      const node = ctx.slot(name);
      if (!node) return undefined;
      mount(node, loading(lines));
      try {
        const data = await (typeof load === "function" ? load() : load);
        if (!alive) return undefined;
        mount(node, render(data));
        return data;
      } catch (error) {
        if (!alive) return undefined;
        mount(node, errorState(error, what ?? "este bloque"));
        return undefined;
      }
    },
    put(name, template) {
      mount(ctx.slot(name), template);
    },
    on(type, selector, handler) {
      const listener = (event) => {
        const target = event.target.closest(selector);
        if (target && root.contains(target)) handler(event, target);
      };
      root.addEventListener(type, listener);
      cleanups.push(() => root.removeEventListener(type, listener));
    },
    cleanup(fn) {
      cleanups.push(fn);
    },
    destroy() {
      alive = false;
      while (cleanups.length) {
        try {
          cleanups.pop()();
        } catch {
          /* ignore */
        }
      }
    },
  };
  return ctx;
}

export function toast(text, ms = 3200) {
  const node = document.createElement("div");
  node.className = "toast";
  node.setAttribute("role", "status");
  node.textContent = text;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), ms);
}

/** Clipboard that also works on plain-http Tailscale, where navigator.clipboard is unavailable. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

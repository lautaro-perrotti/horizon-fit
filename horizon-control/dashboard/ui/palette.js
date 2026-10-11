// Ctrl/⌘K palette: views, SKUs and actions from the same registry. Last row always asks Consulta.
import { html, mount } from "../core/html.js";
import { VIEWS, hrefFor } from "../core/views.js";
import { api } from "../core/api.js";
import { money } from "../core/format.js";
import { MOD } from "./shell.js";

const state = { root: null, open: false, query: "", items: [], index: 0, skus: [], timer: null, deps: null, seq: 0 };

function norm(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function buildItems() {
  const q = norm(state.query.trim());
  const { can, actions } = state.deps;
  const views = VIEWS.filter((view) => !q || norm(view.label).includes(q) || norm(view.id).includes(q)).map((view) => ({
    group: "Ir a",
    label: view.label,
    hint: `g ${view.keys}`,
    run: () => (location.hash = hrefFor(view.id)),
  }));
  const skus = state.skus.map((product) => ({
    group: "SKU",
    label: `${product.sku || product.parent_sku}`,
    detail: `${product.name} · ${money(product.price?.amount)}`,
    hint: "Product 360",
    mono: true,
    run: () => (location.hash = hrefFor("producto", product.sku || product.parent_sku)),
  }));
  const acts = actions()
    .filter((row) => !row.tool || can(row.tool))
    .filter((row) => !q || norm(row.label).includes(q))
    .map((row) => ({ group: "Acciones", label: row.label, hint: row.tool, run: row.run }));
  const askRow = state.query.trim()
    ? [{ group: "Preguntar", label: `Preguntar a Consulta: “${state.query.trim()}”`, hint: `${MOD}J`, run: () => state.deps.ask(state.query.trim()) }]
    : [];
  return [...skus, ...views.slice(0, q ? 8 : 15), ...acts, ...askRow];
}

function render() {
  if (!state.root) return;
  if (!state.open) {
    mount(state.root, "");
    return;
  }
  state.items = buildItems();
  state.index = Math.min(state.index, Math.max(0, state.items.length - 1));
  let lastGroup = "";
  mount(
    state.root,
    html`<div class="palette-scrim" data-act="palette-scrim">
      <div class="palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <div class="palette-input">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color: var(--ink-3);"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>
          <label class="sr" for="palette-input">Buscar</label>
          <input id="palette-input" autocomplete="off" spellcheck="false" placeholder="SKU (001-TOP-AZU), vista o acción" value="${state.query}" aria-controls="palette-list">
          <span class="kbd">esc</span>
        </div>
        <div class="palette-list" id="palette-list" role="listbox">
          ${state.items.length ? "" : html`<p class="small muted" style="padding: 10px;">Nada coincide.</p>`}
          ${state.items.map((item, i) => {
            const head = item.group !== lastGroup ? html`<span class="lbl">${item.group}</span>` : "";
            lastGroup = item.group;
            return html`${head}<button type="button" class="pal-item" role="option" data-i="${i}" aria-selected="${i === state.index}">
              <span class="ellipsis">${item.mono ? html`<span class="mono">${item.label}</span>` : item.label}${item.detail ? html` <span class="muted">· ${item.detail}</span>` : ""}</span>
              <span class="xs muted mono">${item.hint ?? ""}</span>
            </button>`;
          })}
        </div>
        <div class="palette-foot"><span><span class="kbd">↑</span> <span class="kbd">↓</span> mover</span><span><span class="kbd">↵</span> abrir</span><span><span class="kbd">${MOD}J</span> Consulta</span><span class="push">vistas, SKUs y acciones salen del mismo registro</span></div>
      </div>
    </div>`,
  );
  const input = state.root.querySelector("#palette-input");
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
  state.root.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
}

function searchSkus() {
  clearTimeout(state.timer);
  const q = state.query.trim();
  if (q.length < 3) {
    state.skus = [];
    render();
    return;
  }
  const seq = ++state.seq;
  state.timer = setTimeout(async () => {
    try {
      const data = /^\d{3}-[a-z]{3}-[a-z]{3}$/i.test(q)
        ? { products: [await api(`/v1/catalog/products/${encodeURIComponent(q.toUpperCase())}`)] }
        : await api(`/v1/catalog/products?q=${encodeURIComponent(q)}&limit=6`);
      if (seq !== state.seq) return;
      state.skus = (data.products ?? []).slice(0, 6);
    } catch {
      state.skus = [];
    }
    if (state.open) render();
  }, 180);
}

export function openPalette() {
  state.open = true;
  state.query = "";
  state.index = 0;
  state.skus = [];
  render();
}

export function closePalette() {
  state.open = false;
  render();
}

export function isPaletteOpen() {
  return state.open;
}

function run(index) {
  const item = state.items[index];
  closePalette();
  item?.run?.();
}

export function initPalette(root, deps) {
  state.root = root;
  state.deps = deps;
  root.addEventListener("click", (event) => {
    const option = event.target.closest("[data-i]");
    if (option) return run(Number(option.dataset.i));
    if (event.target.dataset?.act === "palette-scrim") closePalette();
  });
  root.addEventListener("input", (event) => {
    if (event.target.id !== "palette-input") return;
    state.query = event.target.value;
    state.index = 0;
    render();
    searchSkus();
  });
  root.addEventListener("keydown", (event) => {
    if (!state.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const n = state.items.length;
      if (!n) return;
      state.index = (state.index + (event.key === "ArrowDown" ? 1 : n - 1)) % n;
      render();
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(state.index);
    }
  });
}

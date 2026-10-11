// Per-viewer conveniences in localStorage: theme, rail, last window, recent SKUs. Never data.

const KEYS = { theme: "hc_theme", rail: "hc_rail", window: "hc_window", compare: "hc_compare", recent: "hc_recent_skus" };
export const WINDOWS = [
  { id: "7d", label: "7 d" },
  { id: "28d", label: "28 d" },
  { id: "90d", label: "90 d" },
  { id: "ytd", label: "Año" },
];

function read(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

export function theme() {
  return read(KEYS.theme, "dusk") === "dawn" ? "dawn" : "dusk";
}

export function setTheme(value) {
  write(KEYS.theme, value);
  document.documentElement.dataset.theme = value;
}

export function railCollapsed() {
  return read(KEYS.rail, "") === "collapsed";
}

export function setRailCollapsed(value) {
  write(KEYS.rail, value ? "collapsed" : "");
}

/** Global window from the hash query, falling back to the last one used. */
export function windowFrom(query = {}) {
  const w = WINDOWS.some((row) => row.id === query.w) ? query.w : read(KEYS.window, "28d");
  const cmp = query.cmp != null ? query.cmp !== "0" : read(KEYS.compare, "1") !== "0";
  return { w: WINDOWS.some((row) => row.id === w) ? w : "28d", cmp };
}

export function rememberWindow({ w, cmp }) {
  write(KEYS.window, w);
  write(KEYS.compare, cmp ? "1" : "0");
}

export function recentSkus() {
  try {
    const list = JSON.parse(read(KEYS.recent, "[]"));
    return Array.isArray(list) ? list.filter((row) => typeof row === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}

export function rememberSku(sku) {
  if (!sku) return;
  const next = [sku, ...recentSkus().filter((row) => row !== sku)].slice(0, 3);
  write(KEYS.recent, JSON.stringify(next));
}

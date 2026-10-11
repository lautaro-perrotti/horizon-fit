// es-AR formatting. Null stays "—"; zero orders read "Sin pedidos", never "$0".

const LOCALE = "es-AR";
const cache = new Map();

function nf(min, max) {
  const key = `${min}:${max}`;
  if (!cache.has(key)) {
    cache.set(key, new Intl.NumberFormat(LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max }));
  }
  return cache.get(key);
}

export function toNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function num(value, digits = 0) {
  const n = toNumber(value);
  return n == null ? "—" : nf(digits, digits).format(n);
}

export function compact(value) {
  const n = toNumber(value);
  if (n == null) return "—";
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Money in ARS. With `orders === 0` the honest answer is "Sin pedidos", not $0. */
export function money(value, { orders, currency = "ARS" } = {}) {
  if (orders === 0) return "Sin pedidos";
  const n = toNumber(value);
  if (n == null) return "—";
  const text = `$${nf(0, 0).format(Math.round(n))}`;
  return currency && currency !== "ARS" ? `${text} ${currency}` : text;
}

/** Ratio 0..1 → "12,3 %". */
export function pct(ratio, digits = 1) {
  const n = toNumber(ratio);
  return n == null ? "—" : `${nf(digits, digits).format(n * 100)} %`;
}

export function decimal(value, digits = 1) {
  return num(value, digits);
}

export function delta(value, ratio) {
  const n = toNumber(value);
  if (n == null) return { text: "—", dir: "flat" };
  const dir = n > 0 ? "up" : n < 0 ? "down" : "flat";
  const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "=";
  const r = toNumber(ratio);
  return { text: r == null ? arrow : `${arrow} ${nf(0, 0).format(Math.abs(r * 100))} %`, dir };
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function day(value) {
  const d = asDate(value);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : "—";
}

export function dateTime(value) {
  const d = asDate(value);
  if (!d) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}:${mm}`;
}

export function longToday(now = new Date()) {
  return `${WEEKDAYS[now.getDay()]} ${now.getDate()} de ${["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][now.getMonth()]}`;
}

export function ago(value, now = Date.now()) {
  const d = asDate(value);
  if (!d) return "—";
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function hoursAgo(hours) {
  const n = toNumber(hours);
  if (n == null) return "—";
  if (n < 1) return `hace ${Math.max(1, Math.round(n * 60))} min`;
  if (n < 48) return `hace ${Math.round(n)} h`;
  return `hace ${Math.round(n / 24)} d`;
}

export function plural(n, one, many) {
  return `${num(n)} ${Number(n) === 1 ? one : many}`;
}

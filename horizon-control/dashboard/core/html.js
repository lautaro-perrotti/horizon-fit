// Tiny escaped templates: html`...` escapes every value unless it is another html`` result or raw().

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

class Safe {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export function raw(value) {
  return new Safe(String(value ?? ""));
}

function part(value) {
  if (value == null) return "";
  // Booleans print as "true"/"false" so aria-pressed="${a === b}" works; use ternaries for optional markup.
  if (typeof value === "boolean") return String(value);
  if (value instanceof Safe) return value.value;
  if (Array.isArray(value)) return value.map(part).join("");
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += part(values[i]) + strings[i + 1];
  return new Safe(out);
}

export function mount(node, template) {
  if (node) node.innerHTML = part(template);
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

// Hash router: #/ruta/param?w=28d&cmp=1. The query carries the global window so links are shareable.

export function parseHash(hash = location.hash) {
  const value = hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart = ""] = value.split("?");
  const path = `/${pathPart.replace(/^\/+|\/+$/g, "")}`;
  const segments = path === "/" ? [] : path.slice(1).split("/").map((part) => decodeURIComponent(part));
  return { path, segments, query: Object.fromEntries(new URLSearchParams(queryPart)) };
}

export function buildHash(path, query = {}) {
  const clean = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const qs = new URLSearchParams(clean).toString();
  return `#${path}${qs ? `?${qs}` : ""}`;
}

/** Matches "/oportunidades/:id" style patterns against parsed segments. */
export function matchRoute(views, segments) {
  for (const view of views) {
    const pattern = view.route === "/" ? [] : view.route.slice(1).split("/");
    const required = pattern.filter((part) => !part.endsWith("?")).length;
    if (segments.length < required || segments.length > pattern.length) continue;
    const params = {};
    let ok = true;
    pattern.forEach((part, index) => {
      if (!ok) return;
      const value = segments[index];
      if (part.startsWith(":")) {
        if (value !== undefined) params[part.slice(1).replace(/\?$/, "")] = value;
      } else if (part !== value) {
        ok = false;
      }
    });
    if (ok) return { view, params };
  }
  return null;
}

export function navigate(path, query, { replace = false } = {}) {
  const next = buildHash(path, query);
  if (replace) history.replaceState({}, "", `${location.pathname}${location.search}${next}`);
  else location.hash = next;
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/** Same path, merged query. */
export function setQuery(patch, { replace = true } = {}) {
  const current = parseHash();
  navigate(current.path, { ...current.query, ...patch }, { replace });
}

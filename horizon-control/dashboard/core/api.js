// /v1 client. Bearer from auth.js; 401 ends the session, 403 becomes a "falta scope" state.
// GETs are cached briefly so moving between views does not re-hit Woo or Google.

export class ApiError extends Error {
  constructor(status, code, description) {
    super(description || code || `http_${status}`);
    this.status = status;
    this.code = code;
  }
}

const state = {
  getToken: () => null,
  onSessionExpired: () => undefined,
  fixtures: null,
};
const cache = new Map();

/** TTL per path prefix. Live Google calls get the longest cache. */
const TTL = [
  ["/v1/analytics/", 300_000],
  ["/v1/insights/", 60_000],
  ["/v1/commerce/", 60_000],
  ["/v1/competition", 120_000],
  ["/v1/merchant/", 120_000],
  ["/v1/storefront/", 300_000],
  ["/v1/seo/", 30_000],
  ["/v1/metrics/", 120_000],
  ["/v1/catalog/", 120_000],
  ["/v1/customers", 60_000],
  ["/v1/campaigns", 60_000],
  ["/v1/ai/usage", 30_000],
  ["/v1/ai/models", 300_000],
  ["/v1/tools", 600_000],
];

function ttlFor(path) {
  const hit = TTL.find(([prefix]) => path.startsWith(prefix));
  return hit ? hit[1] : 0;
}

export function configureApi(options) {
  Object.assign(state, options);
}

export function clearCache(prefix = "") {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

async function send(path, { method = "GET", body } = {}) {
  if (state.fixtures) return state.fixtures.respond(path, method, body);
  const headers = { accept: "application/json" };
  const token = state.getToken();
  if (path.startsWith("/v1/")) {
    if (!token) throw new ApiError(401, "invalid_token", "missing_token");
    headers.authorization = `Bearer ${token}`;
  }
  let payload;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(path, { method, headers, body: payload });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new ApiError(response.status, data.error, data.error_description);
    if (response.status === 401) state.onSessionExpired(error);
    throw error;
  }
  return data;
}

export async function api(path, options = {}) {
  const method = options.method ?? "GET";
  if (method !== "GET") {
    const result = await send(path, options);
    clearCache(options.invalidate ?? "/v1/");
    return result;
  }
  const ttl = options.fresh ? 0 : ttlFor(path);
  const hit = cache.get(path);
  if (ttl && hit && Date.now() - hit.at < ttl) return hit.promise;
  const promise = send(path, options);
  cache.set(path, { at: Date.now(), promise });
  promise.catch(() => cache.delete(path));
  return promise;
}

/** Never throws: `{ ok: true, data }` or `{ ok: false, error }`. */
export async function attempt(path, options) {
  try {
    return { ok: true, data: await api(path, options) };
  } catch (error) {
    return { ok: false, error };
  }
}

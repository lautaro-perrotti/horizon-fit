// Auth0 Authorization Code + PKCE. The SPA is served over plain http on Tailscale, where
// crypto.subtle is unavailable, so SHA-256 is computed in JS. Tokens live in sessionStorage only.

const TOKEN_KEY = "horizon_dashboard_token";
const VERIFIER_KEY = "pkce_verifier";
const STATE_KEY = "pkce_state";
const RETURN_KEY = "hc_return_hash";

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function sha256bytes(msg) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
    0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
    0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotr = (n, x) => (x >>> n) | (x << (32 - n));
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const l = msg.length;
  const pad = (64 - ((l + 1 + 8) % 64)) % 64;
  const total = l + 1 + pad + 8;
  const bytes = new Uint8Array(total);
  bytes.set(msg);
  bytes[l] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(total - 8, Math.floor(l / 0x20000000), false);
  view.setUint32(total - 4, l << 3, false);
  const w = new Uint32Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + ((S0 + maj) >>> 0)) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i], false);
  return out;
}

function randomString() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

function decodeJwt(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")));
  } catch {
    return null;
  }
}

export function getToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const claims = decodeJwt(token);
  if (claims?.exp && claims.exp * 1000 < Date.now() + 15_000) return null;
  return token;
}

export function hadSession() {
  return Boolean(sessionStorage.getItem(TOKEN_KEY));
}

export function claims() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  return token ? decodeJwt(token) : null;
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function login(cfg) {
  if (!cfg.clientId) throw new Error("Falta HORIZON_DASHBOARD_CLIENT_ID en el env del Control Plane.");
  const verifier = randomString();
  const state = randomString();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_KEY, location.hash || "#/");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes,
    audience: cfg.audience,
    resource: cfg.resource,
    code_challenge: b64url(sha256bytes(new TextEncoder().encode(verifier))),
    code_challenge_method: "S256",
    state,
    prompt: "consent",
  });
  location.href = `${cfg.issuer}authorize?${params}`;
}

/** Completes the redirect from Auth0. Returns the hash to land on, or null when there was no code. */
export async function completeLogin(cfg) {
  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) {
    history.replaceState({}, "", "/app/");
    throw new Error(url.searchParams.get("error_description") || error);
  }
  if (!code) return null;
  const expected = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  if (!expected || url.searchParams.get("state") !== expected) {
    history.replaceState({}, "", "/app/");
    throw new Error("El login volvió con un state distinto. Entrá de nuevo.");
  }
  const response = await fetch(`${cfg.issuer}oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cfg.clientId,
      code,
      redirect_uri: cfg.redirectUri,
      code_verifier: verifier ?? "",
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) throw new Error(json.error_description || json.error || "token_error");
  sessionStorage.setItem(TOKEN_KEY, json.access_token);
  const back = sessionStorage.getItem(RETURN_KEY) || "#/";
  sessionStorage.removeItem(RETURN_KEY);
  history.replaceState({}, "", `/app/${back}`);
  return back;
}

export function logout() {
  clearToken();
  location.href = "/app/";
}

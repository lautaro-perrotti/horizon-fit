export type ClientConfig = { development: boolean; issuer: string; clientId: string; audience: string; resource: string };
let config: ClientConfig;
const tokenKey = 'horizon-platform-token';
export async function initAuth() {
  const response = await fetch('/platform-config.json'); config = await response.json();
  if (config.development) { sessionStorage.setItem(tokenKey, 'local-development'); return true; }
  const query = new URLSearchParams(location.search);
  if (query.has('error')) throw new Error(query.get('error_description') || 'No se pudo iniciar sesión');
  if (query.has('code')) {
    if (!query.get('state') || query.get('state') !== sessionStorage.getItem('horizon-state')) throw new Error('La sesión de ingreso venció');
    const response = await fetch(`${config.issuer.replace(/\/$/, '')}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', client_id: config.clientId, code: query.get('code'), code_verifier: sessionStorage.getItem('horizon-verifier'), redirect_uri: location.origin + '/' }) });
    if (!response.ok) throw new Error('No se pudo completar el ingreso');
    const result = await response.json(); if (!result.access_token) throw new Error('No se recibió una sesión válida');
    sessionStorage.setItem(tokenKey, result.access_token); sessionStorage.removeItem('horizon-verifier'); sessionStorage.removeItem('horizon-state'); history.replaceState({}, '', '/');
  }
  return !!sessionStorage.getItem(tokenKey);
}
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function login() {
  const verifier = base64(crypto.getRandomValues(new Uint8Array(32))), state = base64(crypto.getRandomValues(new Uint8Array(24)));
  sessionStorage.setItem('horizon-verifier', verifier); sessionStorage.setItem('horizon-state', state);
  const challenge = base64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const params = new URLSearchParams({ client_id: config.clientId, response_type: 'code', redirect_uri: location.origin + '/', audience: config.audience, scope: 'openid profile email', state, code_challenge: challenge, code_challenge_method: 'S256' });
  location.assign(`${config.issuer.replace(/\/$/, '')}/authorize?${params}`);
}
export function logout() { sessionStorage.removeItem(tokenKey); location.reload(); }
export async function command<T = any>(name: string, args: unknown = {}): Promise<T> {
  const response = await fetch(`/v1/commands/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${sessionStorage.getItem(tokenKey) || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const body = await response.json();
  if (!response.ok) { if (response.status === 401) sessionStorage.removeItem(tokenKey); throw new Error(body.error || 'No se pudo completar la operación'); }
  return body;
}

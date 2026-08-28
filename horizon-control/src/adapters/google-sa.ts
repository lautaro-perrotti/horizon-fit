import fs from "node:fs";
import { importPKCS8, SignJWT } from "jose";
import { allowlistedFetch } from "../http/allowlist.js";

export const GOOGLE_API_HOSTS = ["oauth2.googleapis.com", "www.googleapis.com", "searchconsole.googleapis.com", "analyticsdata.googleapis.com"];

export const GSC_READONLY = "https://www.googleapis.com/auth/webmasters.readonly";
export const GA4_READONLY = "https://www.googleapis.com/auth/analytics.readonly";

export type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

const cache = new Map<string, { token: string; exp: number }>();

export function loadGoogleServiceAccount(pathValue: string, jsonValue: string): GoogleServiceAccount | null {
  const raw = jsonValue.trim() || (pathValue.trim() && fs.existsSync(pathValue) ? fs.readFileSync(pathValue, "utf8") : "");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GoogleServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: String(parsed.client_email),
      private_key: String(parsed.private_key).replace(/\\n/g, "\n"),
      token_uri: parsed.token_uri,
    };
  } catch {
    return null;
  }
}

export async function googleAccessToken(options: {
  sa: GoogleServiceAccount;
  scopes: string[];
  extraHosts: string[];
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const key = `${options.sa.client_email}:${options.scopes.join(" ")}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;

  const tokenUri = options.sa.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const pk = await importPKCS8(options.sa.private_key, "RS256");
  const assertion = await new SignJWT({
    iss: options.sa.client_email,
    sub: options.sa.client_email,
    scope: options.scopes.join(" "),
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setAudience(tokenUri)
    .sign(pk);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const response = await allowlistedFetch(
    tokenUri,
    options.extraHosts,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      timeoutMs: 12_000,
    },
    options.fetchImpl,
  );
  const json = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!response.ok || !json.access_token) {
    throw new Error(`google_token_http_${response.status}`);
  }
  const exp = Date.now() + Math.max(60, Number(json.expires_in) || 3600) * 1000;
  cache.set(key, { token: json.access_token, exp });
  return json.access_token;
}

import { exportJWK, generateKeyPair, SignJWT, type GenerateKeyPairResult, type JWK } from "jose";
import { loadConfig } from "../src/config.js";
import { createServices, type CreateServicesOptions } from "../src/create-services.js";
import { createHttpApp } from "../src/api/app.js";
import { CLIENT_SCOPES } from "../src/config.js";
import type { AppServices } from "../src/app-context.js";
import type { WooAdapter } from "../src/adapters/woo.js";
import type { CacheAdapter } from "../src/adapters/wp-cli.js";
import type { VpsAdapter } from "../src/adapters/vps.js";
import type { GitAdapter } from "../src/adapters/git.js";

export const ISSUER = "https://horizon-fit.test.auth0.com/";
export const AUDIENCE = "https://horizon-control.tailnet/mcp";

export async function createTestKeys() {
  const pair: GenerateKeyPairResult = await generateKeyPair("RS256", { extractable: true });
  const jwk = (await exportJWK(pair.publicKey)) as JWK;
  jwk.kid = "test-1";
  jwk.alg = "RS256";
  jwk.use = "sig";
  return { ...pair, jwks: { keys: [jwk] } };
}

export async function signToken(
  privateKey: CryptoKey,
  claims: {
    client?: string;
    scopes?: string[];
    exp?: number | string;
    aud?: string | string[];
    iss?: string;
    sub?: string;
  } = {},
) {
  const client = claims.client ?? "admin";
  const scopes = claims.scopes ?? CLIENT_SCOPES[client] ?? CLIENT_SCOPES.admin;
  const jwt = new SignJWT({
    azp: client,
    client_id: client,
    scope: scopes.join(" "),
    permissions: scopes,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-1", typ: "at+jwt" })
    .setIssuer(claims.iss ?? ISSUER)
    .setAudience(claims.aud ?? AUDIENCE)
    .setSubject(claims.sub ?? client)
    .setIssuedAt();
  if (typeof claims.exp === "number") {
    jwt.setExpirationTime(claims.exp);
  } else {
    jwt.setExpirationTime(claims.exp ?? "10m");
  }
  return jwt.sign(privateKey);
}

export function mockWoo(): WooAdapter {
  const catalog = [
    { id: 1, name: "Calza Test", slug: "calza-test", sku: "HF-C1", status: "publish", permalink: "https://horizonfit.com.ar/producto/calza-test/", price: "10000", stock_status: "instock" },
    { id: 2, name: "Top Test", slug: "top-test", sku: "HF-T1", status: "publish", permalink: "https://horizonfit.com.ar/producto/top-test/", price: "8000", stock_status: "instock" },
  ];
  return {
    async searchProducts(query) {
      const q = query.toLowerCase();
      return catalog.filter((item) => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q));
    },
    async getProduct(id) {
      return catalog.find((item) => String(item.id) === String(id)) ?? null;
    },
  };
}

export function mockCache(): CacheAdapter {
  return {
    async readStorefrontConfig() {
      return { path: "/tmp/horizon-fit-cache", files: { "menu.json": [{ label: "Shop", href: "/" }] } };
    },
    async readMerchantDiagnostics() {
      return {
        path: "/tmp/horizon-fit-seo",
        diagnosticsTxt: "Merchant diagnostics fixture\n- none: 0\n",
        productsJson: { ready: 1, blocked: 0, items: [] },
      };
    },
    async readLatestSeoAudit() {
      return { path: null, report: null };
    },
  };
}

export function mockVps(): VpsAdapter {
  return {
    async inspectContainers() {
      return [
        { name: "horizon-fit-db", present: false, running: null, status: "docker_unavailable" },
        { name: "horizon-fit-wp", present: false, running: null, status: "docker_unavailable" },
        { name: "horizon-fit-spa", present: false, running: null, status: "docker_unavailable" },
        { name: "horizon-fit-wpcli", present: false, running: null, status: "docker_unavailable" },
      ];
    },
    async probeHttp(url) {
      return { url, ok: false, status: null };
    },
    async compareGit() {
      return { head: "abc", originMain: "abc", inSync: true };
    },
    async typedJob() {
      throw new Error("typedJob must be mocked in tests — refusing to run real processes");
    },
  };
}

export function mockGit(): GitAdapter {
  return {
    async status() {
      return {
        path: "/repo",
        branch: "feat/horizon-control",
        dirty: false,
        ahead: 0,
        behind: 0,
        head: "abc123",
      };
    },
  };
}

export async function buildTestApp(overrides: CreateServicesOptions = {}) {
  const keys = await createTestKeys();
  const config = loadConfig({
    HORIZON_OIDC_ISSUER: ISSUER,
    HORIZON_OIDC_AUDIENCE: AUDIENCE,
    HORIZON_BIND: "127.0.0.1",
    HORIZON_PORT: "8787",
    HORIZON_PUBLIC_URL: "http://127.0.0.1:8787",
    HORIZON_SQLITE_PATH: ":memory:",
    HORIZON_REPO_DIR: "",
  });
  const jobsRun: Array<{ type: string; args: Record<string, unknown> }> = [];
  const services: AppServices = createServices({
    config,
    jwks: keys.jwks,
    clockToleranceSec: 0,
    woo: mockWoo(),
    cache: mockCache(),
    vps: mockVps(),
    git: mockGit(),
    startWorker: false,
    sqlitePath: ":memory:",
    runner: async (type, args) => {
      jobsRun.push({ type, args });
      return { stdout: "mocked", stderr: "", exitCode: 0, mocked: true };
    },
    ...overrides,
  });
  const app = createHttpApp(services);
  return { app, services, keys, jobsRun };
}

export async function request(
  app: ReturnType<typeof createHttpApp>,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  return app.request(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

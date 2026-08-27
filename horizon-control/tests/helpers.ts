import { exportJWK, generateKeyPair, SignJWT, type GenerateKeyPairResult, type JWK } from "jose";
import { type Server } from "node:http";
import { loadConfig } from "../src/config.js";
import { createServices, type CreateServicesOptions } from "../src/create-services.js";
import { createHttpApp } from "../src/api/app.js";
import { createHorizonHttpServer } from "../src/server.js";
import { CLIENT_SCOPES } from "../src/config.js";
import type { AppServices } from "../src/app-context.js";
import type { CatalogProduct } from "../src/types.js";
import type { CatalogAdapter } from "../src/adapters/woo.js";
import type { StorefrontAdapter } from "../src/adapters/storefront.js";
import type { MerchantAdapter } from "../src/adapters/merchant.js";
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
  privateKey: Awaited<ReturnType<typeof createTestKeys>>["privateKey"],
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

function sampleProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 1,
    parent_sku: "HF-C1",
    sku: "HF-C1",
    slug: "calza-test",
    name: "Calza Test",
    status: "publish",
    categories: [{ name: "Calzas", slug: "calzas" }],
    description: "desc",
    short_description: "short",
    images: [],
    attributes: { Talle: ["S"], Color: ["Negro"] },
    variations: [],
    price: { amount: "100.00", currency: "ARS", raw: "10000" },
    stock_status: "instock",
    ...overrides,
  };
}

export const SAMPLE_TOP_AZU: CatalogProduct = {
  id: 99,
  parent_sku: "001-TOP-AZU",
  sku: "001-TOP-AZU",
  slug: "top-liso-azul",
  name: "Top Dynamic blue",
  status: "publish",
  categories: [
    { name: "Básicos", slug: "basicos" },
    { name: "Tops", slug: "tops" },
  ],
  description: "Top de entrenamiento",
  short_description: "Top Dynamic",
  images: ["https://api.horizonfit.com.ar/wp-content/uploads/2026/07/DSC02686_retocada.jpg"],
  attributes: { Talle: ["S", "M", "L"], Color: ["Azul"] },
  variations: [
    {
      id: 100,
      sku: "001-TOP-AZU-S",
      name: "Top Dynamic blue",
      parent: 99,
      in_stock: true,
      price: { amount: "67000.00", currency: "ARS", raw: "6700000" },
      attributes: [
        { name: "Talle", value: "S" },
        { name: "Color", value: "Azul" },
      ],
      image: "https://api.horizonfit.com.ar/wp-content/uploads/2026/07/DSC02686_retocada.jpg",
    },
  ],
  price: { amount: "67000.00", currency: "ARS", raw: "6700000" },
  stock_status: "instock",
};

export function mockWoo(): CatalogAdapter {
  const catalog = [sampleProduct(), sampleProduct({ id: 2, sku: "HF-T1", parent_sku: "HF-T1", slug: "top-test", name: "Top Test" }), SAMPLE_TOP_AZU];
  return {
    async searchProducts(filters) {
      const q = (filters.query ?? "").toLowerCase();
      const sku = (filters.sku ?? "").toLowerCase();
      const products = catalog.filter((item) => {
        if (q && !item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q) && !item.parent_sku.toLowerCase().includes(q)) {
          return false;
        }
        if (sku && item.sku.toLowerCase() !== sku && item.parent_sku.toLowerCase() !== sku) return false;
        if (filters.category && !item.categories.some((category: { slug: string }) => category.slug === filters.category)) return false;
        return true;
      });
      return { products, page: filters.page ?? 1, limit: filters.limit ?? 20 };
    },
    async getProduct(id) {
      const key = String(id);
      return (
        catalog.find(
          (item) =>
            String(item.id) === key ||
            item.sku === key ||
            item.parent_sku === key ||
            item.slug === key ||
            item.variations.some((variation: { sku: string }) => variation.sku === key),
        ) ?? null
      );
    },
  };
}

export function mockStorefront(): StorefrontAdapter {
  return {
    async getConfig() {
      return {
        menu: { status: "ok", data: [{ label: "Shop", url: "/" }], source: "mock" },
        home_sections: { status: "unavailable", data: null, source: null },
        hero: { status: "unavailable", data: null, source: null },
        marquee: { status: "unavailable", data: null, source: null },
      };
    },
  };
}

export function mockMerchant(): MerchantAdapter {
  return {
    async readDiagnostics() {
      return {
        path: "/tmp/horizon-fit-merchant",
        diagnosticsTxt: "Merchant diagnostics fixture\n- none: 0\n",
        productsJson: { ready: 1, blocked: 0, items: [] },
        source: "local",
        summary: { ready: 1, blocked: 0, problems: [] },
      };
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
        dirty_files: [],
        dirty_summary: { changed: 0, shown: 0 },
        ahead: 0,
        behind: 0,
        head: "abc123",
        remote: "origin",
        fetched: false,
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
    HORIZON_DATA_DIR: "",
    HORIZON_REPO_PATH: "",
    HORIZON_STOREFRONT_URL: "https://horizonfit.com.ar",
    HORIZON_WOO_BASE_URL: "https://api.horizonfit.com.ar",
  });
  const jobsRun: Array<{ type: string; args: Record<string, unknown> }> = [];
  const services: AppServices = createServices({
    config,
    jwks: keys.jwks,
    clockToleranceSec: 0,
    catalog: mockWoo(),
    storefront: mockStorefront(),
    merchant: mockMerchant(),
    git: mockGit(),
    startWorker: false,
    sqlitePath: ":memory:",
    fetchImpl: async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
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
  const response = await app.request(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  return {
    status: response.status,
    headers: response.headers,
    json: async <T = Record<string, any>>() => (await response.json()) as T,
    text: () => response.text(),
  };
}

export async function listenHorizon(services: AppServices): Promise<{ server: Server; base: string }> {
  const server = createHorizonHttpServer(services);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("listenHorizon: no TCP port");
  }
  return { server, base: `http://127.0.0.1:${address.port}` };
}

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

const MCP_ACCEPT = "application/json, text/event-stream";

function parseMcpBody(text: string, contentType: string | null): unknown {
  if (contentType?.includes("text/event-stream")) {
    const payloads = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== "[DONE]");
    if (!payloads.length) return { raw: text };
    return JSON.parse(payloads[payloads.length - 1]);
  }
  if (!text.trim()) return undefined;
  return JSON.parse(text);
}

export async function mcpRpc(
  base: string,
  token: string | undefined,
  body: unknown,
  method = "POST",
): Promise<{
  status: number;
  headers: Headers;
  json: unknown;
  text: string;
}> {
  const headers: Record<string, string> = {
    accept: MCP_ACCEPT,
    "content-type": "application/json",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${base}/mcp`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = text;
  try {
    json = parseMcpBody(text, response.headers.get("content-type"));
  } catch {
    json = { parse_error: true, raw: text };
  }
  return { status: response.status, headers: response.headers, json, text };
}

export async function mcpInitialize(base: string, token: string) {
  const init = await mcpRpc(base, token, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "horizon-control-tests", version: "0.1.0" },
    },
  });
  await mcpRpc(base, token, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
  return init;
}

export async function mcpCallTool(
  base: string,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
) {
  const response = await mcpRpc(base, token, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const rpc = response.json as {
    result?: { content?: Array<{ text?: string }>; isError?: boolean };
    error?: { message?: string; code?: number };
  };
  let tool: Record<string, unknown> | null = null;
  const text = rpc?.result?.content?.[0]?.text;
  if (text) {
    try {
      tool = JSON.parse(text) as Record<string, unknown>;
    } catch {
      tool = { text };
    }
  }
  return {
    httpStatus: response.status,
    isError: Boolean(rpc?.result?.isError) || Boolean(rpc?.error),
    rpc,
    tool,
    text: response.text,
  };
}

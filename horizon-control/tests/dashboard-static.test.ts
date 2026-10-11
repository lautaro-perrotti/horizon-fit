import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { AUDIENCE, ISSUER, buildTestApp, request } from "./helpers.js";

const DASHBOARD = path.resolve(__dirname, "../dashboard");

function fixtureConfig(extra: Record<string, string> = {}) {
  return loadConfig({
    HORIZON_OIDC_ISSUER: ISSUER,
    HORIZON_OIDC_AUDIENCE: AUDIENCE,
    HORIZON_BIND: "127.0.0.1",
    HORIZON_PORT: "8787",
    HORIZON_PUBLIC_URL: "http://127.0.0.1:8787",
    HORIZON_SQLITE_PATH: ":memory:",
    HORIZON_DATA_DIR: os.tmpdir(),
    HORIZON_REPO_PATH: "",
    HORIZON_STOREFRONT_URL: "https://horizonfit.com.ar",
    HORIZON_WOO_BASE_URL: "https://api.horizonfit.com.ar",
    HORIZON_DASHBOARD_FIXTURES: "1",
    ...extra,
  });
}

// Browser modules are plain ESM; load them by URL so tsc does not try to type them.
async function dashboardModule(rel: string): Promise<any> {
  return import(pathToFileURL(path.join(DASHBOARD, rel)).href);
}

describe("dashboard static serving", () => {
  it("sends a strict CSP and no-cache on the shell", async () => {
    const { app } = await buildTestApp();
    const page = await request(app, "/app/");
    const csp = page.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/script-src 'self'(;|$)/);
    expect(csp).toMatch(/frame-src https:\/\/horizonfit\.com\.ar/);
    expect(csp).toMatch(/connect-src 'self' https:\/\/horizon-fit\.test\.auth0\.com/);
    expect(csp).toMatch(/img-src 'self' data: https:\/\/horizonfit\.com\.ar https:\/\/api\.horizonfit\.com\.ar/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(page.headers.get("cache-control")).toBe("no-cache");
    expect(page.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("serves brand fonts as binary woff2 with a long cache", async () => {
    const { app } = await buildTestApp();
    for (const file of ["archivo-400.woff2", "archivo-700.woff2", "archivo-narrow-var.woff2"]) {
      const res = await app.request(`/app/fonts/${file}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("font/woff2");
      expect(res.headers.get("cache-control")).toMatch(/max-age=/);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const disk = fs.readFileSync(path.join(DASHBOARD, "fonts", file));
      expect(bytes.length).toBe(disk.length);
      expect(Buffer.from(bytes.slice(0, 4)).toString("latin1")).toBe("wOF2");
    }
  });

  it("serves every view module named in the registry", async () => {
    const { app } = await buildTestApp();
    const registry = await (await request(app, "/app/core/views.js")).text();
    const modules = [...registry.matchAll(/import\("\.\.\/(views\/[a-z0-9-]+\.js)"\)/g)].map((m) => m[1]);
    expect(modules.length).toBe(15);
    for (const mod of modules) {
      const res = await request(app, `/app/${mod}`);
      expect(res.status, mod).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/text\/javascript/);
    }
  });

  it("answers 304 when the ETag matches", async () => {
    const { app } = await buildTestApp();
    const first = await request(app, "/app/app.css");
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();
    const second = await app.request("/app/app.css", { headers: { "if-none-match": etag ?? "" } });
    expect(second.status).toBe(304);
  });

  it("refuses traversal, dotfiles, unknown folders and the fixtures folder by default", async () => {
    const { app } = await buildTestApp();
    for (const bad of ["/app/src/config.ts", "/app/.env", "/app/core/.hidden.js", "/app/dev/fixtures.js", "/app/core/x/y.js", "/app/%2e%2e/package.json", "/app/views/..%2f..%2fpackage.json", "/app/README.md"]) {
      const res = await request(app, bad);
      expect(res.status, bad).toBe(404);
    }
  });

  it("enables fixtures only outside production", async () => {
    const dev = await buildTestApp({ config: fixtureConfig() });
    expect((await (await request(dev.app, "/app/config.json")).json()).fixtures).toBe(true);
    expect((await request(dev.app, "/app/dev/fixtures.js")).status).toBe(200);

    const prod = await buildTestApp({ config: fixtureConfig({ NODE_ENV: "production" }) });
    expect((await (await request(prod.app, "/app/config.json")).json()).fixtures).toBe(false);
    expect((await request(prod.app, "/app/dev/fixtures.js")).status).toBe(404);
  });
});

describe("dashboard core modules", () => {
  it("formats es-AR money honestly", async () => {
    const { money, pct, num, delta } = await dashboardModule("core/format.js");
    expect(money(67000)).toBe("$67.000");
    expect(money("70000.00")).toBe("$70.000");
    expect(money(0, { orders: 0 })).toBe("Sin pedidos");
    expect(money(null)).toBe("—");
    expect(pct(0.123)).toBe("12,3 %");
    expect(pct(null)).toBe("—");
    expect(num(1180)).toBe("1.180");
    expect(delta(-2, -0.19)).toEqual({ text: "↓ 19 %", dir: "down" });
  });

  it("escapes template values and prints booleans for aria attributes", async () => {
    const { html, raw } = await dashboardModule("core/html.js");
    expect(String(html`<b>${"<x>"}</b>`)).toBe("<b>&lt;x&gt;</b>");
    expect(String(html`<i aria-pressed="${1 === 1}"></i>`)).toBe('<i aria-pressed="true"></i>');
    expect(String(html`${[raw("<a>"), "<b>"]}`)).toBe("<a>&lt;b&gt;");
    expect(String(html`${null}${undefined}`)).toBe("");
  });

  it("parses hash routes with params and the global window", async () => {
    const { parseHash, matchRoute, buildHash } = await dashboardModule("core/router.js");
    const parsed = parseHash("#/producto/004-TOP-BOR?w=7d&cmp=0");
    expect(parsed.segments).toEqual(["producto", "004-TOP-BOR"]);
    expect(parsed.query).toEqual({ w: "7d", cmp: "0" });
    const views = [{ id: "hoy", route: "/" }, { id: "producto", route: "/producto/:ref?" }];
    expect(matchRoute(views, []).view.id).toBe("hoy");
    expect(matchRoute(views, ["producto"]).params).toEqual({});
    expect(matchRoute(views, ["producto", "004-TOP-BOR"]).params).toEqual({ ref: "004-TOP-BOR" });
    expect(matchRoute(views, ["nada"])).toBeNull();
    expect(buildHash("/demanda", { w: "28d", gs: undefined })).toBe("#/demanda?w=28d");
  });

  it("maps legacy payloads and errors onto slice states", async () => {
    const { statusOf, statusFromError, asSlice } = await dashboardModule("core/slice.js");
    expect(statusOf({ configured: false })).toBe("not_configured");
    expect(statusOf({ configured: true, ok: false })).toBe("error");
    expect(statusOf({ status: "zero" })).toBe("zero");
    expect(statusOf({ status: "not_joined" })).toBe("not_joined");
    expect(statusFromError({ status: 401 })).toBe("session");
    expect(statusFromError({ status: 403 })).toBe("scope");
    expect(statusFromError({ status: 500 })).toBe("error");
    expect(asSlice({ configured: false, reason: "missing_woo_rest_credentials" }).available).toBe(false);
  });
});

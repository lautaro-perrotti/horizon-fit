import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES, loadConfig } from "../src/config.js";
import {
  extractPage,
  extractShopifyProducts,
  parsePrice,
  priceIndex,
  robotsAllows,
  shopifyCollectionJsonUrl,
} from "../src/adapters/competitor-extract.js";
import { AUDIENCE, ISSUER, buildTestApp, request, signToken } from "./helpers.js";

const SHOPIFY = {
  products: [
    {
      id: 11,
      title: "Calza Shine",
      handle: "calza-shine",
      variants: [{ price: "45000.00", compare_at_price: "55000.00", available: true }],
    },
    {
      id: 12,
      title: "Calza Soft",
      handle: "calza-soft",
      variants: [{ price: "39000.00", compare_at_price: null, available: true }],
    },
  ],
};

describe("competitor extractors and 360", () => {
  it("parses Shopify JSON, JSON-LD and robots without inventing prices", () => {
    expect(shopifyCollectionJsonUrl("https://touchesport.com/collections/leggings")).toBe(
      "https://touchesport.com/collections/leggings/products.json",
    );
    const products = extractShopifyProducts(SHOPIFY, "https://touchesport.com/collections/leggings");
    expect(products).toHaveLength(2);
    expect(products[0].price).toBe(45000);
    expect(products[0].compare_at).toBe(55000);
    const ld = extractPage(
      `<title>Tops</title><h1>Tops</h1><script type="application/ld+json">${JSON.stringify({
        "@type": "Product",
        name: "Top rival",
        offers: { price: "62000", priceCurrency: "ARS" },
      })}</script>`,
    );
    expect(ld.extractor).toBe("jsonld");
    expect(ld.products[0].price).toBe(62000);
    expect(robotsAllows("User-agent: *\nDisallow: /collections\n", "/collections/tops").allowed).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /admin\n", "/collections/tops").allowed).toBe(true);
    expect(priceIndex(67000, [45000, 39000]).index).toBeCloseTo(67000 / 42000);
    expect(priceIndex(67000, []).index).toBeNull();
    expect(parsePrice("$45.000")).toBe(45000);
  });

  it("returns configured:false without env URLs and does not invent rivals", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const list = await request(app, "/v1/competition", { token });
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.configured).toBe(false);
    expect(body.reason).toBe("missing_competitor_urls");
    expect(body.snapshots).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/\$214\.000/);
  });

  it("job persists Shopify snapshot, diffs prices and compares a Horizon SKU", async () => {
    const html = "<html><title>Calzas Touche</title><h1>Calzas</h1></html>";
    const { app, keys, services } = await buildTestApp({
      config: loadConfig({
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
        HORIZON_COMPETITOR_URLS: "https://touchesport.com/collections/leggings",
      }),
      runner: undefined,
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /\n", { status: 200 });
        if (url.includes("/products.json")) {
          return new Response(JSON.stringify(SHOPIFY), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
      },
    });
    const job = await services.jobs.enqueue({ type: "competitor.snapshot", args: {}, actor: "test", clientId: "admin" });
    await services.worker.tick();
    expect((await services.jobs.get(job.id))?.status).toBe("succeeded");

    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const listed = await request(app, "/v1/competition", { token });
    const listBody = await listed.json();
    expect(listBody.configured).toBe(true);
    expect(listBody.snapshots[0].competitor).toBe("touche");
    expect(listBody.snapshots[0].segment).toBe("calzas");
    expect(listBody.snapshots[0].product_count).toBe(2);
    expect(listBody.snapshots[0].price_min).toBe(39000);

    SHOPIFY.products[0].variants[0].price = "48000.00";
    await new Promise((resolve) => setTimeout(resolve, 5));
    const again = await services.jobs.enqueue({ type: "competitor.snapshot", args: {}, actor: "test", clientId: "admin" });
    await services.worker.tick();
    expect((await services.jobs.get(again.id))?.status).toBe("succeeded");
    const changes = await request(app, "/v1/competition/changes", { token });
    const changeBody = await changes.json();
    expect(changeBody.changes.some((row: { type: string }) => row.type === "price_up")).toBe(true);

    const compare = await request(app, "/v1/competition/compare?id=001-TOP-AZU", { token });
    const compared = await compare.json();
    expect(compared.found).toBe(true);
    expect(compared.segment).toBe("tops");
    expect(compared.price_index.index).toBeNull();
  });

  it("skips scrape when robots.txt disallows the path", async () => {
    const { services } = await buildTestApp({
      config: loadConfig({
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
        HORIZON_COMPETITOR_URLS: "https://touchesport.com/collections/tops",
      }),
      runner: undefined,
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /collections\n", { status: 200 });
        return new Response("should-not-fetch", { status: 200 });
      },
    });
    const result = await services.competition.runSnapshot();
    expect(result.skipped_robots).toBe(1);
    expect(services.competition.list().snapshots[0].error).toMatch(/robots_disallow/);
  });

  it("Cursor cannot call competition.list", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    expect((await request(app, "/v1/competition", { token })).status).toBe(403);
  });
});

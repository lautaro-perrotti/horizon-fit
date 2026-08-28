import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES, loadConfig } from "../src/config.js";
import { AUDIENCE, ISSUER, buildTestApp, mockAnalytics, request, signToken } from "./helpers.js";

describe("Product 360 insights.get_product", () => {
  it("joins catalog and SKU sales around parent_sku without inventing GA4/GSC", async () => {
    const soldAt = new Date().toISOString().slice(0, 19);
    const { app, keys } = await buildTestApp({
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
        HORIZON_WOO_KEY: "ck_test",
        HORIZON_WOO_SECRET: "cs_test",
      }),
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/wp-json/wc/v3/orders")) {
          if (/[?&]page=2(?:&|$)/.test(url)) {
            return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
          }
          return new Response(
            JSON.stringify([
              {
                id: 42,
                status: "completed",
                total: "67000.00",
                date_created_gmt: soldAt,
                currency: "ARS",
                line_items: [
                  {
                    sku: "001-TOP-AZU-S",
                    name: "Top Dynamic blue",
                    product_id: 99,
                    quantity: 1,
                    price: "67000",
                    total: "67000",
                  },
                ],
              },
            ]),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const byVariant = await request(app, "/v1/insights/products/001-TOP-AZU-S", { token });
    expect(byVariant.status).toBe(200);
    const body = await byVariant.json();
    expect(body.keys.parent_sku).toBe("001-TOP-AZU");
    expect(body.keys.kind).toBe("variant_sku");
    expect(body.catalog.available).toBe(true);
    expect(body.catalog.data.stock_status).toBe("instock");
    expect(body.sales.available).toBe(true);
    expect(body.sales.data.units).toBe(1);
    expect(body.sales.data.revenue).toBe(67000);
    expect(body.analytics.available).toBe(false);
    expect(body.analytics.reason).toBe("missing_google_credentials");
    expect(body.search.available).toBe(false);
    expect(body.search.reason).toBe("missing_google_credentials");
    expect(body.merchant.available).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/\$214\.000/);

    const byUrl = await request(
      app,
      `/v1/insights/products?id=${encodeURIComponent("https://horizonfit.com.ar/product/top-liso-azul/")}`,
      { token },
    );
    expect(byUrl.status).toBe(200);
    expect((await byUrl.json()).keys.parent_sku).toBe("001-TOP-AZU");

    const missing = await request(app, "/v1/insights/products/NO-SUCH-SKU", { token });
    expect(missing.status).toBe(404);
  });

  it("joins mocked GA4 and GSC onto the parent SKU without inventing metrics", async () => {
    const { app, keys } = await buildTestApp({
      analytics: mockAnalytics(
        {},
        {},
        {
          ga4Product: {
            configured: true,
            ok: true,
            property_id: "550763778",
            pdp_views: 1420,
            view_item: 900,
            add_to_cart: 86,
            begin_checkout: 39,
            purchase: 21,
            purchase_revenue: 842000,
            atc_rate: 86 / 1420,
            cvr: 21 / 1420,
            join: { item_id: "001-TOP-AZU", page_path: "/product/top-liso-azul/" },
          },
          gscProduct: {
            configured: true,
            ok: true,
            page: "https://horizonfit.com.ar/product/top-liso-azul/",
            clicks: 283,
            impressions: 12480,
            ctr: 0.0227,
            position: 7.8,
            queries: [{ query: "top azul", clicks: 40, impressions: 900, ctr: 0.044, position: 5.1 }],
          },
        },
      ),
    });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/insights/products/001-TOP-AZU", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.analytics.available).toBe(true);
    expect(body.analytics.data.pdp_views).toBe(1420);
    expect(body.analytics.data.add_to_cart).toBe(86);
    expect(body.search.available).toBe(true);
    expect(body.search.data.impressions).toBe(12480);
    expect(body.search.data.queries[0].query).toBe("top azul");
    expect(body.seo.reason).toBe("not_joined_yet");
    expect(JSON.stringify(body)).not.toMatch(/\$214\.000/);
  });

  it("sales slice is configured:false without Woo keys and still returns catalog", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/insights/products/001-TOP-AZU", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.catalog.available).toBe(true);
    expect(body.sales.configured).toBe(false);
    expect(body.sales.data).toBeNull();
    expect(body.sales.reason).toBe("missing_woo_rest_credentials");
  });

  it("Cursor cannot call insights.get_product", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    const response = await request(app, "/v1/insights/products/001-TOP-AZU", { token });
    expect(response.status).toBe(403);
  });
});

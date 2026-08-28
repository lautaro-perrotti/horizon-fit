import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES, loadConfig } from "../src/config.js";
import { mockWoo, SAMPLE_TOP_AZU, AUDIENCE, ISSUER, buildTestApp, request, signToken } from "./helpers.js";

describe("dashboard SPA + commerce warehouse", () => {
  it("serves the Tailscale SPA at /app without auth", async () => {
    const { app } = await buildTestApp();
    const page = await request(app, "/app/");
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toMatch(/Overview/);
    expect(html).toMatch(/Sitio/);
    expect(html).toMatch(/Salud general/);
    expect(html).toMatch(/Catálogo/);
    expect(html).toMatch(/Operaciones/);
    expect(html).toMatch(/Consulta/);
    expect(html).toMatch(/siteFrame/);
    expect(html).toMatch(/Horizon Fit/);
    expect(html).toMatch(/Plus\+Jakarta\+Sans/);
    expect(html).toMatch(/Auditar ahora/);
    expect(html).toMatch(/Competencia/);
    expect(html).toMatch(/Product 360/);
    expect(html).toMatch(/insights\.get_product/);
    expect(html).toMatch(/line items \/ SKU/);
    expect(html).not.toMatch(/GA4 no conectado\. No hay adapter/);
    expect(html).toMatch(/\/app\/app\.js/);
    expect(html).not.toMatch(/\$214\.000/);

    const cfg = await request(app, "/app/config.json");
    expect(cfg.status).toBe(200);
    const body = await cfg.json();
    expect(body.apiBase).toBe("/v1");
    expect(body.scopes).toMatch(/commerce\.read/);
    expect(body.scopes).toMatch(/seo\.read/);
    expect(body.scopes).toMatch(/seo\.audit/);
    expect(body.scopes).toMatch(/analytics\.read/);
    expect(body.scopes).toMatch(/openid/);
    expect(body.storefrontUrl).toBe("https://horizonfit.com.ar");
    expect(body.wpAdminUrl).toMatch(/wp-admin/);
  });

  it("sales returns configured:false when Woo REST keys are missing", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/commerce/sales", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toBe(false);
    expect(body.reason).toBe("missing_woo_rest_credentials");
    expect(body.today.revenue).toBeNull();
    expect(body.week.orders).toBe(0);
    expect(body.products).toEqual([]);
    expect(body.fetched_at).toBeNull();
    expect(body.source).toBe("orders");
  });

  it("sales rolls up line items by parent SKU from mocked Woo REST orders", async () => {
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
                status: "processing",
                total: "67000.00",
                date_created_gmt: soldAt,
                currency: "ARS",
                line_items: [
                  {
                    sku: "001-TOP-AZU-S",
                    name: "Top Dynamic blue",
                    product_id: 99,
                    variation_id: 100,
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
    const token = await signToken(keys.privateKey, { client: "admin", scopes: CLIENT_SCOPES.admin });
    const sales = await request(app, "/v1/commerce/sales", { token });
    expect(sales.status).toBe(200);
    const body = await sales.json();
    expect(body.configured).toBe(true);
    expect(body.source).toBe("orders");
    expect(body.fetched_at).toBeTruthy();
    expect(body.incomplete).toBe(false);
    expect(body.month.orders).toBe(1);
    expect(body.month.units).toBe(1);
    expect(body.month.revenue).toBe(67000);
    expect(body.month.aov).toBe(67000);
    expect(body.recent_orders[0].id).toBe(42);
    expect(body.recent_orders[0].items[0].parent_sku).toBe("001-TOP-AZU");
    expect(body.products[0].parent_sku).toBe("001-TOP-AZU");
    expect(body.products[0].d30.units).toBe(1);
    expect(body.products[0].d30.revenue).toBe(67000);
    expect(body.products[0].d30.aov).toBe(67000);
    expect(body.products[0].variants[0].sku).toBe("001-TOP-AZU-S");
    expect(JSON.stringify(body)).not.toMatch(/\$214\.000/);

    const snapshots = await request(app, "/v1/metrics/snapshots", { token });
    const snapBody = await snapshots.json();
    expect(snapBody.snapshots.some((row: { kpi: string }) => row.kpi === "orders")).toBe(true);
    expect(snapBody.snapshots.some((row: { kpi: string }) => row.kpi === "revenue")).toBe(true);
  });

  it("alerts.evaluate opens storefront_down and sku_out_of_stock", async () => {
    const catalog = mockWoo();
    const inner = catalog.searchProducts.bind(catalog);
    catalog.searchProducts = async (filters) => {
      if (filters.stock_status === "outofstock") {
        return {
          products: [{ ...SAMPLE_TOP_AZU, sku: "999-OUT-STK", parent_sku: "999-OUT-STK", stock_status: "outofstock" }],
          page: 1,
          limit: 10,
        };
      }
      return inner(filters);
    };
    const { app, keys } = await buildTestApp({
      catalog,
      fetchImpl: async () => new Response("down", { status: 503 }),
    });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const evaluated = await request(app, "/v1/alerts/evaluate", { method: "POST", token });
    expect(evaluated.status).toBe(200);
    const body = await evaluated.json();
    const open = (body.alerts as Array<{ rule_id: string; status: string; payload?: { skus?: string[] } }>).filter(
      (alert) => alert.status === "open",
    );
    expect(open.some((alert) => alert.rule_id === "storefront_down")).toBe(true);
    const stock = open.find((alert) => alert.rule_id === "sku_out_of_stock");
    expect(stock?.payload?.skus).toContain("999-OUT-STK");
  });

  it("assistant.ask returns the 001-TOP-AZU product without dumping the catalog", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/assistant/ask", {
      method: "POST",
      token,
      body: { question: "precio del SKU 001-TOP-AZU" },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("deterministic");
    expect(body.intent).toBe("product");
    expect(body.data.sku).toBe("001-TOP-AZU");
    expect(body.data.price.amount).toBe("67000.00");
    expect(JSON.stringify(body)).not.toMatch(/HF-C1/);
  });

  it("assistant.ask returns SKU sales rollups for unidades vendidas", async () => {
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
    const response = await request(app, "/v1/assistant/ask", {
      method: "POST",
      token,
      body: { question: "cuántas unidades vendió 001-TOP-AZU" },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.intent).toBe("sales");
    expect(body.data.parent_sku).toBe("001-TOP-AZU");
    expect(body.data.product.d30.units).toBe(1);
    expect(body.data.product.d30.revenue).toBe(67000);
    expect(JSON.stringify(body)).not.toMatch(/\$214\.000/);
  });

  it("Cursor cannot call commerce.sales", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    const response = await request(app, "/v1/commerce/sales", { token });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("insufficient_scope");
  });

  it("settings returns configured:false without Woo REST keys and never invents gateways", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/commerce/settings", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toBe(false);
    expect(body.reason).toBe("missing_woo_rest_credentials");
    expect(body.storefront_url).toBe("https://horizonfit.com.ar");
    expect(body.wp_admin_url).toMatch(/wp-admin/);
    expect(body.payments).toEqual([]);
  });

  it("settings reads allowlisted Woo general + payment gateways", async () => {
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
        if (url.includes("/wp-json/wc/v3/settings/general")) {
          return new Response(
            JSON.stringify([
              { id: "woocommerce_currency", label: "Currency", value: "ARS" },
              { id: "woocommerce_email_smtp_password", label: "SMTP", value: "secret" },
            ]),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/wp-json/wc/v3/payment_gateways")) {
          return new Response(JSON.stringify([{ id: "cod", title: "Contra reembolso", enabled: true }]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/wp-json/wc/v3/system_status")) {
          return new Response(
            JSON.stringify({ environment: { version: "9.0.0", wp_version: "6.9", currency: "ARS", currency_symbol: "$", language: "es_AR" } }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/commerce/settings", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toBe(true);
    expect(body.environment.wc_version).toBe("9.0.0");
    expect(body.general.some((row: { id: string; value: string }) => row.id === "woocommerce_currency" && row.value === "ARS")).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/secret/);
    expect(body.payments[0]).toMatchObject({ id: "cod", enabled: true });
  });
});

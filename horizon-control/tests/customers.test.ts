import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES, loadConfig } from "../src/config.js";
import { hashCustomerKey } from "../src/adapters/commerce.js";
import { aggregateCustomers, segmentOf } from "../src/adapters/customers.js";
import { AUDIENCE, ISSUER, buildTestApp, request, signToken } from "./helpers.js";

function order(partial: {
  id: number;
  date: string;
  revenue: number;
  customer_key: string;
  coupon?: string | null;
  sku?: string;
}) {
  return {
    id: partial.id,
    status: "completed",
    total: String(partial.revenue),
    revenue: partial.revenue,
    date: partial.date,
    coupon: partial.coupon ?? null,
    customer_key: partial.customer_key,
    items: [{ sku: `${partial.sku ?? "001-TOP-AZU"}-S`, parent_sku: partial.sku ?? "001-TOP-AZU", product_id: 1, variation_id: 2, slug: null, name: "Top", quantity: 1, unit_price: partial.revenue, line_total: partial.revenue }],
  };
}

describe("customer hash and RFM", () => {
  it("hashes customer_id or email and never stores the raw email", () => {
    expect(hashCustomerKey({ email: "A@B.com" })).toBe(hashCustomerKey({ email: "a@b.com" }));
    expect(hashCustomerKey({ customer_id: 9 })).toBe(hashCustomerKey({ customer_id: 9 }));
    expect(hashCustomerKey({ customer_id: 9, email: "x@y.com" })).toBe(hashCustomerKey({ customer_id: 9 }));
    expect(hashCustomerKey({})).toBeNull();
    expect(hashCustomerKey({ email: "a@b.com" })).toMatch(/^[a-f0-9]{16}$/);
    expect(hashCustomerKey({ email: "a@b.com" })).not.toMatch(/a@b\.com/);
  });

  it("segments RFM without inventing missing customers", () => {
    expect(segmentOf({ r: 5, f: 5, m: 5, orders: 4, recency_days: 2 })).toBe("champions");
    expect(segmentOf({ r: 1, f: 4, m: 3, orders: 4, recency_days: 90 })).toBe("at_risk");
    expect(segmentOf({ r: 1, f: 1, m: 1, orders: 2, recency_days: 90 })).toBe("dormant");
    expect(segmentOf({ r: 4, f: 4, m: 2, orders: 3, recency_days: 10 })).toBe("loyal");
    expect(segmentOf({ r: 5, f: 1, m: 1, orders: 1, recency_days: 5 })).toBe("new");
    expect(segmentOf({ r: 1, f: 1, m: 1, orders: 1, recency_days: 80 })).toBe("one_time");

    const now = Date.parse("2026-10-11T12:00:00Z");
    const rows = aggregateCustomers(
      [
        order({ id: 1, date: "2026-10-10T12:00:00Z", revenue: 20000, customer_key: "aaa111aaa111aaaa" }),
        order({ id: 2, date: "2026-01-01T12:00:00Z", revenue: 5000, customer_key: "bbb222bbb222bbbb" }),
      ],
      now,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].customer_key).toBe("aaa111aaa111aaaa");
    expect(rows.find((row) => row.customer_key === "aaa111aaa111aaaa")?.segment).toBe("new");
    expect(rows.find((row) => row.customer_key === "bbb222bbb222bbbb")?.segment).toBe("one_time");
  });
});

describe("customers and campaigns HTTP", () => {
  it("returns configured:false without Woo and keeps Ads not_configured", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const customers = await request(app, "/v1/customers", { token });
    expect(customers.status).toBe(200);
    const listed = await customers.json();
    expect(listed.configured).toBe(false);
    expect(listed.reason).toBe("missing_woo_rest_credentials");
    expect(listed.customers).toEqual([]);
    expect(JSON.stringify(listed)).not.toMatch(/@/);

    const ads = await request(app, "/v1/ads", { token });
    expect(ads.status).toBe(200);
    const adsBody = await ads.json();
    expect(adsBody.google.configured).toBe(false);
    expect(adsBody.google.reason).toBe("ads_adapter_not_configured");
    expect(adsBody.meta.configured).toBe(false);
    expect(JSON.stringify(adsBody)).not.toMatch(/spend|impressions|roas/i);

    const campaigns = await request(app, "/v1/campaigns", { token });
    const camp = await campaigns.json();
    expect(camp.configured).toBe(false);
    expect(camp.ads.google.configured).toBe(false);
  });

  it("hashes Woo customer identity and never leaks email", async () => {
    const soldAt = new Date().toISOString().slice(0, 19);
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
                id: 88,
                status: "completed",
                total: "67000.00",
                date_created_gmt: soldAt,
                currency: "ARS",
                customer_id: 12,
                billing: { email: "sofia@example.com" },
                coupon_lines: [{ code: "FIT10" }],
                line_items: [{ sku: "001-TOP-AZU-S", name: "Top", product_id: 99, quantity: 1, price: "67000", total: "67000" }],
              },
            ]),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, "/v1/customers", { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toBe(true);
    expect(body.customers).toHaveLength(1);
    expect(body.customers[0].customer_key).toBe(hashCustomerKey({ customer_id: 12 }));
    expect(body.customers[0].discount_used).toBe(true);
    expect(body.customers[0].segment).toBe("new");
    expect(JSON.stringify(body)).not.toMatch(/sofia@example\.com/i);
    expect(JSON.stringify(body)).not.toMatch(/customer_id":12/);

    const one = await request(app, `/v1/customers/${body.customers[0].customer_key}`, { token });
    expect(one.status).toBe(200);
    expect((await one.json()).customer_key).toBe(body.customers[0].customer_key);

    const campaigns = await request(app, "/v1/campaigns", { token });
    const camp = await campaigns.json();
    expect(camp.configured).toBe(true);
    expect(camp.campaigns.some((row: { name: string }) => row.name === "FIT10")).toBe(true);
    expect(camp.campaigns.some((row: { reason?: string }) => row.reason === "ads_adapter_not_configured")).toBe(true);

    const extra = await services.customers.aggregate();
    expect(extra.customers).toBe(1);
  });
});

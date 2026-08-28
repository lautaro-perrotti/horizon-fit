import { describe, expect, it } from "vitest";
import { createCommerceAdapter, parentSkuFromVariant } from "../src/adapters/commerce.js";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function gmtNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "");
}

describe("parentSkuFromVariant", () => {
  it("strips Horizon size suffixes and leaves parent SKUs intact", () => {
    expect(parentSkuFromVariant("001-TOP-AZU-S")).toBe("001-TOP-AZU");
    expect(parentSkuFromVariant("001-TOP-AZU-XS")).toBe("001-TOP-AZU");
    expect(parentSkuFromVariant("001-TOP-AZU-XXL")).toBe("001-TOP-AZU");
    expect(parentSkuFromVariant("001-TOP-AZU")).toBe("001-TOP-AZU");
    expect(parentSkuFromVariant(" 001-CAL-NEG-L ")).toBe("001-CAL-NEG");
  });
});

describe("commerce.sales SKU rollups", () => {
  it("uses line totals for SKU revenue and order totals for store buckets and containing-order AOV", async () => {
    const soldAt = gmtNow();
    const calls: string[] = [];
    const commerce = createCommerceAdapter({
      baseUrl: "https://api.horizonfit.com.ar",
      key: "ck_test",
      secret: "cs_test",
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (!url.includes("/wp-json/wc/v3/orders")) return jsonResponse({});
        if (/[?&]page=2(?:&|$)/.test(url)) return jsonResponse([]);
        return jsonResponse([
          {
            id: 10,
            status: "completed",
            total: "100000.00",
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
              {
                sku: "002-CAL-NEG-M",
                name: "Calza negra",
                product_id: 40,
                variation_id: 41,
                quantity: 1,
                price: "33000",
                total: "33000",
              },
            ],
          },
        ]);
      },
    });

    const sales = await commerce.sales();
    expect(sales.configured).toBe(true);
    expect(sales.source).toBe("orders");
    expect(sales.month.orders).toBe(1);
    expect(sales.month.units).toBe(2);
    expect(sales.month.revenue).toBe(100000);
    expect(sales.month.aov).toBe(100000);

    const top = sales.products.find((row) => row.parent_sku === "001-TOP-AZU");
    expect(top?.d30.units).toBe(1);
    expect(top?.d30.revenue).toBe(67000);
    expect(top?.d30.orders).toBe(1);
    expect(top?.d30.aov).toBe(100000);
    expect(top?.d30.avg_unit_price).toBe(67000);
    expect(top?.d30.units_per_order).toBe(1);
    expect(top?.velocity_30d).toBeCloseTo(1 / 30);

    const calza = sales.products.find((row) => row.parent_sku === "002-CAL-NEG");
    expect(calza?.d30.revenue).toBe(33000);
    expect(calza?.d30.aov).toBe(100000);

    expect(sales.recent_orders[0].items).toHaveLength(2);
    expect(calls[0]).toMatch(/status=processing%2Ccompleted%2Con-hold/);
    expect(calls[0]).toMatch(/after=/);

    const cached = await commerce.sales();
    expect(cached.fetched_at).toBe(sales.fetched_at);
    expect(calls.filter((url) => url.includes("/orders")).length).toBe(1);
  });

  it("flags incomplete when the 5×100 page cap is hit", async () => {
    const soldAt = gmtNow();
    const commerce = createCommerceAdapter({
      baseUrl: "https://api.horizonfit.com.ar",
      key: "ck_test",
      secret: "cs_test",
      fetchImpl: async (input) => {
        const url = new URL(String(input));
        if (!url.pathname.includes("/wp-json/wc/v3/orders")) return jsonResponse({});
        const pageNum = Number(url.searchParams.get("page") || "1");
        const batch = Array.from({ length: 100 }, (_, i) => ({
          id: (pageNum - 1) * 100 + i + 1,
          status: "processing",
          total: "1.00",
          date_created_gmt: soldAt,
          currency: "ARS",
          line_items: [{ sku: "001-TOP-AZU-S", name: "Top", product_id: 99, quantity: 1, price: "1", total: "1" }],
        }));
        return jsonResponse(batch);
      },
    });
    const sales = await commerce.sales();
    expect(sales.incomplete).toBe(true);
    expect(sales.ninety.orders).toBe(500);
  });
});

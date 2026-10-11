import { describe, expect, it } from "vitest";
import { CLIENT_SCOPES, loadConfig } from "../src/config.js";
import { AUDIENCE, ISSUER, buildTestApp, request, signToken } from "./helpers.js";
import { createHistoryStore } from "../src/adapters/history.js";
import { dailyFromOrders } from "../src/adapters/commerce.js";
import { isoDay } from "../src/core/slice.js";

describe("daily history and metrics.series", () => {
  it("buckets Woo orders by UTC day without inventing missing days as zero", () => {
    const buckets = dailyFromOrders([
      {
        id: 1,
        status: "completed",
        total: "67000",
        revenue: 67000,
        date: `${isoDay(1)}T15:00:00Z`,
        items: [
          {
            sku: "004-TOP-BOR-S",
            parent_sku: "004-TOP-BOR",
            product_id: 204,
            variation_id: 205,
            slug: null,
            name: "Top Bordeaux",
            quantity: 1,
            unit_price: 67000,
            line_total: 67000,
          },
        ],
      },
    ]);
    expect(buckets.store).toEqual([{ day: isoDay(1), orders: 1, units: 1, revenue: 67000 }]);
    expect(buckets.products[0]).toMatchObject({ day: isoDay(1), parent_sku: "004-TOP-BOR", units: 1, revenue: 67000 });
  });

  it("returns unknown for days without a row and compares the previous window", async () => {
    const { app, keys, services } = await buildTestApp();
    const history = createHistoryStore(services.db);
    const today = isoDay(0);
    const yesterday = isoDay(1);
    history.upsert([
      { day: yesterday, source: "woo_rest_orders", metric: "revenue", value: 50000, status: "ok" },
      { day: today, source: "woo_rest_orders", metric: "revenue", value: 80000, status: "ok" },
    ]);
    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, `/v1/metrics/series?metric=revenue&range=7d&compare=previous`, { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe("woo_rest_orders");
    expect(body.entity).toBe("store");
    expect(body.current.points).toHaveLength(7);
    const todayPoint = body.current.points.find((point: { day: string }) => point.day === today);
    const gap = body.current.points.find((point: { day: string }) => point.day === isoDay(3));
    expect(todayPoint).toMatchObject({ value: 80000, status: "ok" });
    expect(gap).toMatchObject({ value: null, status: "unknown", reason: "no_observation" });
    expect(body.current.total).toBe(130000);
    expect(body.note).toMatch(/not seasonally adjusted/);
    expect(JSON.stringify(body)).not.toMatch(/214\.000/);
  });

  it("writes sales history from a paid order and reads the product series", async () => {
    const soldAt = `${isoDay(0)}T12:00:00`;
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
      runner: undefined,
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
                line_items: [{ sku: "004-TOP-BOR-S", name: "Top Bordeaux", product_id: 204, quantity: 1, price: "67000", total: "67000" }],
              },
            ]),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    const job = await services.jobs.enqueue({ type: "sales.sync", args: {}, actor: "test", clientId: "admin" });
    await services.worker.tick();
    const finished = await services.jobs.get(job.id);
    expect(finished?.status).toBe("succeeded");
    expect((finished?.result as { extra?: { status?: string } })?.extra?.status).toBe("ok");

    const token = await signToken(keys.privateKey, { client: "dashboard", scopes: CLIENT_SCOPES.dashboard });
    const response = await request(app, `/v1/metrics/series?metric=units&entity=004-TOP-BOR&range=7d&compare=none`, { token });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.parent_sku).toBe("004-TOP-BOR");
    expect(body.current.total).toBe(1);
    expect(body.previous).toBeNull();
  });

  it("Cursor cannot read metric series", async () => {
    const { app, keys } = await buildTestApp();
    const token = await signToken(keys.privateKey, { client: "cursor", scopes: CLIENT_SCOPES.cursor });
    const response = await request(app, "/v1/metrics/series?metric=revenue", { token });
    expect(response.status).toBe(403);
  });
});

import { eq } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { customerRfm } from "../db/schema.js";
import type { CommerceAdapter, SalesOrder } from "./commerce.js";

const STORE_ID = "horizon-fit";

export type CustomerRow = {
  customer_key: string;
  first_purchase: string | null;
  last_purchase: string | null;
  orders: number;
  revenue: number | null;
  aov: number | null;
  frequency: number;
  recency_days: number | null;
  r: number | null;
  f: number | null;
  m: number | null;
  segment: string;
  categories: string[];
  repeat: boolean;
  discount_used: boolean;
};

export type CustomerList = {
  configured: boolean;
  reason?: string;
  store_id: string;
  fetched_at: string | null;
  customers: CustomerRow[];
  segments: Record<string, number>;
};

function scoreDesc(values: number[], value: number): number | null {
  const sorted = values.filter((row) => Number.isFinite(row)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const rank = sorted.filter((row) => row <= value).length / sorted.length;
  return Math.min(5, Math.max(1, Math.ceil(rank * 5)));
}

function scoreInverse(values: number[], value: number): number | null {
  const sorted = values.filter((row) => Number.isFinite(row)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const rank = sorted.filter((row) => row >= value).length / sorted.length;
  return Math.min(5, Math.max(1, Math.ceil(rank * 5)));
}

export function segmentOf(row: Pick<CustomerRow, "r" | "f" | "m" | "orders" | "recency_days">): string {
  if (row.orders <= 1 && (row.recency_days ?? 999) <= 30) return "new";
  if (row.orders <= 1) return "one_time";
  if ((row.r ?? 0) >= 4 && (row.f ?? 0) >= 4 && (row.m ?? 0) >= 4) return "champions";
  if ((row.r ?? 0) <= 2 && (row.f ?? 0) >= 3) return "at_risk";
  if ((row.r ?? 0) <= 2) return "dormant";
  if ((row.f ?? 0) >= 3) return "loyal";
  return "regular";
}

export function aggregateCustomers(orders: SalesOrder[], now = Date.now()): CustomerRow[] {
  const groups = new Map<string, SalesOrder[]>();
  for (const order of orders) {
    if (!order.customer_key) continue;
    const list = groups.get(order.customer_key) ?? [];
    list.push(order);
    groups.set(order.customer_key, list);
  }
  const raw = [...groups.entries()].map(([customer_key, rows]) => {
    const dates = rows.map((row) => Date.parse(row.date)).filter((value) => Number.isFinite(value));
    const first = dates.length ? Math.min(...dates) : null;
    const last = dates.length ? Math.max(...dates) : null;
    const revenue = rows.reduce((sum, row) => sum + (row.revenue ?? 0), 0);
    const categories = [...new Set(rows.flatMap((row) => row.items.map((item) => item.parent_sku)))].slice(0, 8);
    return {
      customer_key,
      first_purchase: first ? new Date(first).toISOString() : null,
      last_purchase: last ? new Date(last).toISOString() : null,
      orders: rows.length,
      revenue: rows.length ? revenue : null,
      aov: rows.length ? revenue / rows.length : null,
      frequency: rows.length,
      recency_days: last != null ? Math.max(0, Math.round((now - last) / 86_400_000)) : null,
      r: null as number | null,
      f: null as number | null,
      m: null as number | null,
      segment: "regular",
      categories,
      repeat: rows.length > 1,
      discount_used: rows.some((row) => Boolean(row.coupon)),
    };
  });
  const recencies = raw.map((row) => row.recency_days).filter((value): value is number => value != null);
  const freqs = raw.map((row) => row.frequency);
  const monies = raw.map((row) => row.revenue ?? 0);
  return raw
    .map((row) => {
      const r = row.recency_days == null ? null : scoreInverse(recencies, row.recency_days);
      const f = scoreDesc(freqs, row.frequency);
      const m = scoreDesc(monies, row.revenue ?? 0);
      const scored = { ...row, r, f, m };
      return { ...scored, segment: segmentOf(scored) };
    })
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
}

export function createCustomersAdapter(options: { commerce: CommerceAdapter; db?: HorizonDb }) {
  const db = options.db;

  function persist(rows: CustomerRow[]) {
    if (!db) return;
    db.delete(customerRfm).where(eq(customerRfm.storeId, STORE_ID)).run();
    const now = Date.now();
    for (const row of rows) {
      db.insert(customerRfm)
        .values({
          storeId: STORE_ID,
          customerKey: row.customer_key,
          firstPurchase: row.first_purchase,
          lastPurchase: row.last_purchase,
          orders: row.orders,
          revenue: row.revenue,
          aov: row.aov,
          frequency: row.frequency,
          recencyDays: row.recency_days,
          r: row.r,
          f: row.f,
          m: row.m,
          segment: row.segment,
          categoriesJson: JSON.stringify(row.categories),
          repeat: row.repeat ? 1 : 0,
          discountUsed: row.discount_used ? 1 : 0,
          updatedAt: now,
        })
        .run();
    }
  }

  return {
    async list(segment?: string): Promise<CustomerList> {
      const paid = await options.commerce.paidOrders();
      if (!paid.configured) {
        return {
          configured: false,
          reason: paid.reason ?? "missing_woo_rest_credentials",
          store_id: "horizon-fit",
          fetched_at: null,
          customers: [],
          segments: {},
        };
      }
      const all = aggregateCustomers(paid.orders);
      const customers = all.filter((row) => (segment ? row.segment === segment : true));
      const segments: Record<string, number> = {};
      for (const row of all) {
        segments[row.segment] = (segments[row.segment] ?? 0) + 1;
      }
      return {
        configured: true,
        reason: paid.reason,
        store_id: "horizon-fit",
        fetched_at: new Date().toISOString(),
        customers,
        segments,
      };
    },
    async get(customerKey: string) {
      const listed = await this.list();
      return listed.customers.find((row) => row.customer_key === customerKey) ?? null;
    },
    async aggregate() {
      const listed = await this.list();
      persist(listed.customers);
      return { configured: listed.configured, reason: listed.reason, customers: listed.customers.length, segments: listed.segments };
    },
  };
}

export type CustomersAdapter = ReturnType<typeof createCustomersAdapter>;

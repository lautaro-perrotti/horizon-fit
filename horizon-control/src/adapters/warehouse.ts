import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { alerts, metricSnapshots } from "../db/schema.js";
import type { CatalogAdapter } from "./woo.js";
import type { CommerceAdapter, CommerceSales } from "./commerce.js";
import type { HealthAdapter } from "./health.js";
import type { JobQueue } from "../jobs/queue.js";

const STORE_ID = "horizon-fit";

export type AlertRecord = {
  id: string;
  store_id: string;
  rule_id: string;
  severity: "critical" | "warning" | "info";
  status: "open" | "resolved";
  title: string;
  payload: unknown;
  opened_at: number;
  updated_at: number;
};

export type Warehouse = {
  recordSales: (sales: CommerceSales) => void;
  snapshots: (limit?: number) => Array<{
    id: string;
    store_id: string;
    period: string;
    kpi: string;
    value: number | null;
    unit: string | null;
    at: number;
  }>;
  listAlerts: (status?: "open" | "resolved") => AlertRecord[];
  evaluate: () => Promise<{ alerts: AlertRecord[]; evaluated_at: number }>;
};

function asAlert(row: typeof alerts.$inferSelect): AlertRecord {
  return {
    id: row.id,
    store_id: row.storeId,
    rule_id: row.ruleId,
    severity: row.severity as AlertRecord["severity"],
    status: row.status as AlertRecord["status"],
    title: row.title,
    payload: row.payloadJson ? JSON.parse(row.payloadJson) : null,
    opened_at: row.openedAt,
    updated_at: row.updatedAt,
  };
}

export function createWarehouse(options: {
  db: HorizonDb;
  health: HealthAdapter;
  catalog: CatalogAdapter;
  commerce: CommerceAdapter;
  jobs: JobQueue;
}): Warehouse {
  const { db } = options;

  function upsertAlert(input: {
    ruleId: string;
    severity: AlertRecord["severity"];
    title: string;
    payload: unknown;
    open: boolean;
  }) {
    const now = Date.now();
    const existing = db.select().from(alerts).where(eq(alerts.ruleId, input.ruleId)).get();
    if (!input.open) {
      if (existing && existing.status === "open") {
        db.update(alerts)
          .set({ status: "resolved", updatedAt: now, payloadJson: JSON.stringify(input.payload) })
          .where(eq(alerts.id, existing.id))
          .run();
      }
      return;
    }
    if (existing) {
      db.update(alerts)
        .set({
          status: "open",
          severity: input.severity,
          title: input.title,
          payloadJson: JSON.stringify(input.payload),
          updatedAt: now,
        })
        .where(eq(alerts.id, existing.id))
        .run();
      return;
    }
    db.insert(alerts)
      .values({
        id: randomUUID(),
        storeId: STORE_ID,
        ruleId: input.ruleId,
        severity: input.severity,
        status: "open",
        title: input.title,
        payloadJson: JSON.stringify(input.payload),
        openedAt: now,
        updatedAt: now,
      })
      .run();
  }

  function writeSnapshot(period: string, kpi: string, value: number | null, unit: string, payload?: unknown) {
    db.insert(metricSnapshots)
      .values({
        id: randomUUID(),
        storeId: STORE_ID,
        period,
        kpi,
        value: value == null ? null : Math.round(value),
        unit,
        payloadJson: payload ? JSON.stringify(payload) : null,
        at: Date.now(),
      })
      .run();
  }

  return {
    recordSales(sales) {
      if (!sales.configured) return;
      writeSnapshot("today", "orders", sales.today.orders, "count", sales.today);
      writeSnapshot("today", "revenue", sales.today.revenue, sales.currency, sales.today);
      writeSnapshot("week", "orders", sales.week.orders, "count", sales.week);
      writeSnapshot("week", "revenue", sales.week.revenue, sales.currency, sales.week);
    },
    snapshots(limit = 20) {
      const cap = Math.min(50, Math.max(1, limit));
      return db
        .select()
        .from(metricSnapshots)
        .orderBy(desc(metricSnapshots.at))
        .limit(cap)
        .all()
        .map((row) => ({
          id: row.id,
          store_id: row.storeId,
          period: row.period,
          kpi: row.kpi,
          value: row.value,
          unit: row.unit,
          at: row.at,
        }));
    },
    listAlerts(status) {
      const rows = db.select().from(alerts).orderBy(desc(alerts.updatedAt)).limit(50).all();
      return rows.map(asAlert).filter((row) => (status ? row.status === status : true));
    },
    async evaluate() {
      const [health, stock, jobs] = await Promise.all([
        options.health.report(),
        options.catalog.searchProducts({ stock_status: "outofstock", limit: 10, page: 1 }),
        options.jobs.list(20),
      ]);
      writeSnapshot("now", "storefront_ok", health.storefront.ok ? 1 : 0, "bool", health.storefront);
      upsertAlert({
        ruleId: "storefront_down",
        severity: "critical",
        title: "Storefront no responde",
        payload: health.storefront,
        open: !health.storefront.ok,
      });
      const out = stock.products.filter((product) => product.stock_status === "outofstock").slice(0, 10);
      upsertAlert({
        ruleId: "sku_out_of_stock",
        severity: "warning",
        title: `${out.length} productos sin stock (muestra)`,
        payload: { skus: out.map((product) => product.sku || product.parent_sku), count: out.length },
        open: out.length > 0,
      });
      const failed = jobs.filter((job) => job.status === "failed").slice(0, 5);
      upsertAlert({
        ruleId: "job_failed",
        severity: "warning",
        title: failed.length ? `Jobs fallidos: ${failed.map((job) => job.type).join(", ")}` : "Jobs ok",
        payload: { ids: failed.map((job) => job.id) },
        open: failed.length > 0,
      });
      return { alerts: db.select().from(alerts).orderBy(desc(alerts.updatedAt)).limit(50).all().map(asAlert), evaluated_at: Date.now() };
    },
  };
}

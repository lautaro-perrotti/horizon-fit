import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { SEO_AUDIT_ORIGIN } from "../config.js";
import type { HorizonDb } from "../db/client.js";
import { alerts, metricSnapshots } from "../db/schema.js";
import type { CatalogAdapter } from "./woo.js";
import type { CommerceAdapter, CommerceSales } from "./commerce.js";
import type { HealthAdapter } from "./health.js";
import type { JobQueue } from "../jobs/queue.js";
import type { SeoReportAdapter, SeoSummary } from "./seo-report.js";
import { summaryFromJobResult } from "./seo-report.js";
import type { AnalyticsAdapter, Ga4Report, GscReport } from "./analytics.js";
import type { CompetitorsAdapter } from "./competitors.js";

const STORE_ID = "horizon-fit";
const SEO_WARNING_THRESHOLD = 5;
const SEO_STALE_HOURS = 24;
const SEO_SCHEDULE_MS = 12 * 3_600_000;

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

export type MetricSnapshot = {
  id: string;
  store_id: string;
  period: string;
  kpi: string;
  value: number | null;
  unit: string | null;
  at: number;
};

export type Warehouse = {
  recordSales: (sales: CommerceSales) => void;
  recordGsc: (report: GscReport) => void;
  recordGa4: (report: Ga4Report) => void;
  snapshots: (limit?: number, kpi?: string) => MetricSnapshot[];
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
  seo: SeoReportAdapter;
  analytics: AnalyticsAdapter;
  competitors: CompetitorsAdapter;
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
    recordGsc(report) {
      if (!report.configured || !report.ok) return;
      writeSnapshot("28d", "gsc_clicks", report.clicks, "count", { site_url: report.site_url });
      writeSnapshot("28d", "gsc_impressions", report.impressions, "count");
    },
    recordGa4(report) {
      if (!report.configured || !report.ok) return;
      writeSnapshot("28d", "ga4_sessions", report.sessions, "count", { property_id: report.property_id });
      writeSnapshot("28d", "ga4_users", report.users, "count");
    },
    snapshots(limit = 20, kpi) {
      const cap = Math.min(50, Math.max(1, limit));
      const rows = kpi
        ? db.select().from(metricSnapshots).where(eq(metricSnapshots.kpi, kpi)).orderBy(desc(metricSnapshots.at)).limit(cap).all()
        : db.select().from(metricSnapshots).orderBy(desc(metricSnapshots.at)).limit(cap).all();
      return rows.map((row) => ({
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

      const latestSeoJob = await options.jobs.latestOfType("seo.audit");
      const fromJob = summaryFromJobResult(latestSeoJob?.result);
      const fromDisk = options.seo.readLatest();
      const summary: SeoSummary | null = fromJob ?? fromDisk.summary ?? null;
      const ageH = summary?.age_h ?? (summary?.generatedAt ? (Date.now() - Date.parse(summary.generatedAt)) / 3_600_000 : null);
      const stale = !summary || ageH == null || ageH > SEO_STALE_HOURS;
      if (summary) {
        writeSnapshot("audit", "seo_pages", summary.auditedCount, "count", { generatedAt: summary.generatedAt });
        writeSnapshot("audit", "seo_critical", summary.totals.critical, "count");
        writeSnapshot("audit", "seo_warning", summary.totals.warning, "count");
        writeSnapshot("audit", "seo_age_h", ageH, "hours");
      }
      upsertAlert({
        ruleId: "seo_critical",
        severity: "critical",
        title: summary?.totals.critical ? `${summary.totals.critical} issues críticos de SEO` : "SEO sin críticos",
        payload: { totals: summary?.totals ?? null, pages: summary?.pages.slice(0, 10) ?? [] },
        open: Boolean(summary && summary.totals.critical > 0),
      });
      upsertAlert({
        ruleId: "seo_warnings",
        severity: "warning",
        title:
          summary && summary.totals.warning > SEO_WARNING_THRESHOLD
            ? `${summary.totals.warning} warnings de SEO`
            : "SEO warnings ok",
        payload: { totals: summary?.totals ?? null, threshold: SEO_WARNING_THRESHOLD },
        open: Boolean(summary && summary.totals.warning > SEO_WARNING_THRESHOLD),
      });
      upsertAlert({
        ruleId: "seo_stale",
        severity: "warning",
        title: stale ? "Auditoría SEO ausente o más vieja de 24h" : "Auditoría SEO reciente",
        payload: { age_h: ageH, generatedAt: summary?.generatedAt ?? null },
        open: stale,
      });

      const seoBusy = jobs.some((job) => job.type === "seo.audit" && (job.status === "queued" || job.status === "running"));
      const lastOk = latestSeoJob?.status === "succeeded" ? latestSeoJob.finishedAt ?? latestSeoJob.createdAt : 0;
      if (!seoBusy && (!lastOk || Date.now() - lastOk > SEO_SCHEDULE_MS)) {
        await options.jobs.enqueue({
          type: "seo.audit",
          args: { target: SEO_AUDIT_ORIGIN, scheduled: true },
          actor: "worker",
          clientId: "horizon-control",
        });
      }

      const [gsc, ga4, competitors] = await Promise.all([
        options.analytics.searchConsole(),
        options.analytics.ga4(),
        options.competitors.snapshot(),
      ]);
      if (gsc.configured && gsc.ok) {
        writeSnapshot("28d", "gsc_clicks", gsc.clicks, "count", { site_url: gsc.site_url });
        writeSnapshot("28d", "gsc_impressions", gsc.impressions, "count");
      }
      if (ga4.configured && ga4.ok) {
        writeSnapshot("28d", "ga4_sessions", ga4.sessions, "count", { property_id: ga4.property_id });
        writeSnapshot("28d", "ga4_users", ga4.users, "count");
      }
      const down = competitors.configured
        ? competitors.pages.filter((page) => !page.ok || (page.status != null && page.status >= 400))
        : [];
      upsertAlert({
        ruleId: "competitor_down",
        severity: "warning",
        title: down.length ? `Competidores caídos: ${down.map((page) => page.host).join(", ")}` : "Competidores ok",
        payload: { hosts: down.map((page) => page.host), count: down.length },
        open: down.length > 0,
      });

      return { alerts: db.select().from(alerts).orderBy(desc(alerts.updatedAt)).limit(50).all().map(asAlert), evaluated_at: Date.now() };
    },
  };
}

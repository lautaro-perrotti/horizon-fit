import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  argsJson: text("args_json").notNull(),
  resultJson: text("result_json"),
  error: text("error"),
  idempotencyKey: text("idempotency_key"),
  actor: text("actor"),
  clientId: text("client_id"),
  attempt: integer("attempt").notNull(),
  maxAttempts: integer("max_attempts").notNull(),
  timeoutMs: integer("timeout_ms").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  startedAt: integer("started_at"),
  finishedAt: integer("finished_at"),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  at: integer("at").notNull(),
  actor: text("actor").notNull(),
  subject: text("subject"),
  clientId: text("client_id").notNull(),
  tool: text("tool").notNull(),
  scope: text("scope"),
  argsRedacted: text("args_redacted").notNull(),
  outcome: text("outcome").notNull(),
  statusCode: integer("status_code").notNull(),
  durationMs: integer("duration_ms").notNull(),
  jobId: text("job_id"),
  error: text("error"),
});

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").primaryKey(),
  tool: text("tool").notNull(),
  responseJson: text("response_json").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const stores = sqliteTable("stores", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  storefrontUrl: text("storefront_url"),
  apiUrl: text("api_url"),
});

export const metricSnapshots = sqliteTable("metric_snapshots", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  period: text("period").notNull(),
  kpi: text("kpi").notNull(),
  value: integer("value"),
  unit: text("unit"),
  payloadJson: text("payload_json"),
  at: integer("at").notNull(),
});

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  ruleId: text("rule_id").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  title: text("title").notNull(),
  payloadJson: text("payload_json"),
  openedAt: integer("opened_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const dailyStoreMetrics = sqliteTable(
  "daily_store_metrics",
  {
    storeId: text("store_id").notNull(),
    day: text("day").notNull(),
    source: text("source").notNull(),
    metric: text("metric").notNull(),
    value: real("value"),
    status: text("status").notNull(),
    syncedAt: integer("synced_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.storeId, table.day, table.source, table.metric] })],
);

export const dailyProductMetrics = sqliteTable(
  "daily_product_metrics",
  {
    storeId: text("store_id").notNull(),
    day: text("day").notNull(),
    parentSku: text("parent_sku").notNull(),
    source: text("source").notNull(),
    metric: text("metric").notNull(),
    value: real("value"),
    status: text("status").notNull(),
    syncedAt: integer("synced_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.storeId, table.day, table.parentSku, table.source, table.metric] })],
);

export const competitorSnapshots = sqliteTable("competitor_snapshots", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  competitor: text("competitor").notNull(),
  segment: text("segment"),
  url: text("url").notNull(),
  checkedAt: integer("checked_at").notNull(),
  status: integer("status"),
  title: text("title"),
  description: text("description"),
  h1: text("h1"),
  productCount: integer("product_count"),
  priceMin: real("price_min"),
  priceMax: real("price_max"),
  robotsAllowed: integer("robots_allowed"),
  extractor: text("extractor"),
  error: text("error"),
});

export const competitorProducts = sqliteTable("competitor_products", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id").notNull(),
  storeId: text("store_id").notNull(),
  competitor: text("competitor").notNull(),
  segment: text("segment"),
  url: text("url").notNull(),
  productUrl: text("product_url"),
  productId: text("product_id"),
  title: text("title"),
  price: real("price"),
  compareAt: real("compare_at"),
  currency: text("currency"),
  inStock: integer("in_stock"),
  checkedAt: integer("checked_at").notNull(),
});

export const competitorProductHistory = sqliteTable(
  "competitor_product_history",
  {
    storeId: text("store_id").notNull(),
    competitor: text("competitor").notNull(),
    productKey: text("product_key").notNull(),
    checkedAt: integer("checked_at").notNull(),
    title: text("title"),
    price: real("price"),
    compareAt: real("compare_at"),
    currency: text("currency"),
    inStock: integer("in_stock"),
  },
  (table) => [primaryKey({ columns: [table.storeId, table.competitor, table.productKey, table.checkedAt] })],
);

export const syncState = sqliteTable(
  "sync_state",
  {
    storeId: text("store_id").notNull(),
    source: text("source").notNull(),
    lastSyncedAt: integer("last_synced_at"),
    lastSuccessAt: integer("last_success_at"),
    coveredFrom: text("covered_from"),
    coveredTo: text("covered_to"),
    lastStatus: text("last_status"),
    lastReason: text("last_reason"),
  },
  (table) => [primaryKey({ columns: [table.storeId, table.source] })],
);

export const schema = {
  jobs,
  auditEvents,
  idempotencyKeys,
  stores,
  metricSnapshots,
  alerts,
  dailyStoreMetrics,
  dailyProductMetrics,
  competitorSnapshots,
  competitorProducts,
  competitorProductHistory,
  syncState,
};

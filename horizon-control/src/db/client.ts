import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { schema } from "./schema.js";

export type HorizonDb = BetterSQLite3Database<typeof schema>;

const DDL = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  args_json TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  idempotency_key TEXT,
  actor TEXT,
  client_id TEXT,
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  timeout_ms INTEGER NOT NULL DEFAULT 120000,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_idempotency_idx ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  subject TEXT,
  client_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  scope TEXT,
  args_redacted TEXT NOT NULL,
  outcome TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  job_id TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS audit_at_idx ON audit_events(at);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  storefront_url TEXT,
  api_url TEXT
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  period TEXT NOT NULL,
  kpi TEXT NOT NULL,
  value INTEGER,
  unit TEXT,
  payload_json TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS metric_snapshots_at_idx ON metric_snapshots(at);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  payload_json TEXT,
  opened_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts(status);
CREATE UNIQUE INDEX IF NOT EXISTS alerts_store_rule_idx ON alerts(store_id, rule_id);

-- Daily history (B2). One row per store/source/metric/day; REAL so CTR/position/revenue fit.
CREATE TABLE IF NOT EXISTS daily_store_metrics (
  store_id TEXT NOT NULL,
  day TEXT NOT NULL,
  source TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL,
  status TEXT NOT NULL DEFAULT 'ok',
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (store_id, day, source, metric)
);
CREATE INDEX IF NOT EXISTS daily_store_metrics_lookup_idx ON daily_store_metrics(store_id, source, metric, day);

CREATE TABLE IF NOT EXISTS daily_product_metrics (
  store_id TEXT NOT NULL,
  day TEXT NOT NULL,
  parent_sku TEXT NOT NULL,
  source TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL,
  status TEXT NOT NULL DEFAULT 'ok',
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (store_id, day, parent_sku, source, metric)
);
CREATE INDEX IF NOT EXISTS daily_product_metrics_lookup_idx ON daily_product_metrics(store_id, parent_sku, source, metric, day);

CREATE TABLE IF NOT EXISTS competitor_snapshots (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  competitor TEXT NOT NULL,
  segment TEXT,
  url TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  status INTEGER,
  title TEXT,
  description TEXT,
  h1 TEXT,
  product_count INTEGER,
  price_min REAL,
  price_max REAL,
  robots_allowed INTEGER,
  extractor TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS competitor_snapshots_url_idx ON competitor_snapshots(url, checked_at);
CREATE INDEX IF NOT EXISTS competitor_snapshots_segment_idx ON competitor_snapshots(store_id, segment, checked_at);

CREATE TABLE IF NOT EXISTS competitor_products (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  competitor TEXT NOT NULL,
  segment TEXT,
  url TEXT NOT NULL,
  product_url TEXT,
  product_id TEXT,
  title TEXT,
  price REAL,
  compare_at REAL,
  currency TEXT,
  in_stock INTEGER,
  checked_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS competitor_products_snapshot_idx ON competitor_products(snapshot_id);
CREATE INDEX IF NOT EXISTS competitor_products_segment_idx ON competitor_products(store_id, segment, checked_at);

CREATE TABLE IF NOT EXISTS competitor_product_history (
  store_id TEXT NOT NULL,
  competitor TEXT NOT NULL,
  product_key TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  title TEXT,
  price REAL,
  compare_at REAL,
  currency TEXT,
  in_stock INTEGER,
  PRIMARY KEY (store_id, competitor, product_key, checked_at)
);

CREATE TABLE IF NOT EXISTS growth_opportunities (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  parent_sku TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL,
  payload_json TEXT,
  detected_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  snoozed_until INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS growth_opportunities_rule_sku_idx ON growth_opportunities(store_id, rule_id, parent_sku);
CREATE INDEX IF NOT EXISTS growth_opportunities_status_idx ON growth_opportunities(status, score);

CREATE TABLE IF NOT EXISTS opportunity_actions (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  actor TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS opportunity_actions_opp_idx ON opportunity_actions(opportunity_id, at);

CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  user TEXT NOT NULL,
  calls INTEGER NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_day_model_user_idx ON ai_usage(day, provider, model, user);

CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL,
  context_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  evidence_json TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_messages_session_idx ON ai_messages(session_id, at);
CREATE TABLE IF NOT EXISTS ai_traces (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  tools_json TEXT,
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  store_id TEXT NOT NULL,
  source TEXT NOT NULL,
  last_synced_at INTEGER,
  last_success_at INTEGER,
  covered_from TEXT,
  covered_to TEXT,
  last_status TEXT,
  last_reason TEXT,
  PRIMARY KEY (store_id, source)
);
`;

function addColumn(sqlite: Database.Database, table: string, column: string, definition: string) {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!rows.some((row) => row.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function createDb(sqlitePath: string): { sqlite: Database.Database; db: HorizonDb } {
  if (sqlitePath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(sqlitePath)), { recursive: true });
  }
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  sqlite.prepare(
    `INSERT OR IGNORE INTO stores (id, name, slug, storefront_url, api_url)
     VALUES ('horizon-fit', 'Horizon Fit', 'horizon-fit', 'https://horizonfit.com.ar', 'https://api.horizonfit.com.ar')`,
  ).run();
  addColumn(sqlite, "jobs", "attempt", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sqlite, "jobs", "max_attempts", "INTEGER NOT NULL DEFAULT 1");
  addColumn(sqlite, "jobs", "timeout_ms", "INTEGER NOT NULL DEFAULT 120000");
  addColumn(sqlite, "jobs", "started_at", "INTEGER");
  addColumn(sqlite, "jobs", "finished_at", "INTEGER");
  addColumn(sqlite, "audit_events", "scope", "TEXT");
  addColumn(sqlite, "audit_events", "duration_ms", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sqlite, "audit_events", "subject", "TEXT");
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

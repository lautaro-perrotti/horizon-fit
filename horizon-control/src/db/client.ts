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

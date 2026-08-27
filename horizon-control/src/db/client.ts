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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_idempotency_idx ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  client_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  args_redacted TEXT NOT NULL,
  outcome TEXT NOT NULL,
  status_code INTEGER NOT NULL,
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
`;

export function createDb(sqlitePath: string): { sqlite: Database.Database; db: HorizonDb } {
  if (sqlitePath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(sqlitePath)), { recursive: true });
  }
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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

export const schema = { jobs, auditEvents, idempotencyKeys };

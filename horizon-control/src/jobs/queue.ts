import { randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { jobs } from "../db/schema.js";
import type { JobRecord, JobStatus } from "../types.js";
import { sanitizeError } from "../auth/redact.js";

function rowToJob(row: typeof jobs.$inferSelect): JobRecord {
  return {
    id: row.id,
    type: row.type,
    status: row.status as JobStatus,
    args: JSON.parse(row.argsJson) as Record<string, unknown>,
    result: row.resultJson ? JSON.parse(row.resultJson) : undefined,
    error: row.error,
    actor: row.actor,
    clientId: row.clientId,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    timeoutMs: row.timeoutMs,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

export const ALLOWED_JOB_TYPES = ["seo.audit", "tests.run", "merchant.audit"] as const;
export type AllowedJobType = (typeof ALLOWED_JOB_TYPES)[number];

const DEFAULTS: Record<AllowedJobType, { timeoutMs: number; maxAttempts: number }> = {
  "seo.audit": { timeoutMs: 600_000, maxAttempts: 1 },
  "tests.run": { timeoutMs: 120_000, maxAttempts: 1 },
  "merchant.audit": { timeoutMs: 15_000, maxAttempts: 1 },
};

export function createJobQueue(db: HorizonDb) {
  return {
    async enqueue(input: {
      type: AllowedJobType;
      args: Record<string, unknown>;
      actor: string;
      clientId: string;
      idempotencyKey?: string;
      timeoutMs?: number;
      maxAttempts?: number;
    }): Promise<JobRecord> {
      if (input.idempotencyKey) {
        const existing = db.select().from(jobs).where(eq(jobs.idempotencyKey, input.idempotencyKey)).get();
        if (existing) return rowToJob(existing);
      }
      const now = Date.now();
      const defaults = DEFAULTS[input.type];
      const record = {
        id: randomUUID(),
        type: input.type,
        status: "queued" as const,
        argsJson: JSON.stringify(input.args),
        resultJson: null as string | null,
        error: null as string | null,
        idempotencyKey: input.idempotencyKey ?? null,
        actor: input.actor,
        clientId: input.clientId,
        attempt: 0,
        maxAttempts: input.maxAttempts ?? defaults.maxAttempts,
        timeoutMs: input.timeoutMs ?? defaults.timeoutMs,
        createdAt: now,
        updatedAt: now,
        startedAt: null as number | null,
        finishedAt: null as number | null,
      };
      db.insert(jobs).values(record).run();
      return rowToJob(record);
    },
    async get(id: string): Promise<JobRecord | null> {
      const row = db.select().from(jobs).where(eq(jobs.id, id)).get();
      return row ? rowToJob(row) : null;
    },
    async latestOfType(type: AllowedJobType): Promise<JobRecord | null> {
      const row = db.select().from(jobs).where(eq(jobs.type, type)).orderBy(desc(jobs.createdAt)).get();
      return row ? rowToJob(row) : null;
    },
    async claimNext(): Promise<JobRecord | null> {
      const row = db.select().from(jobs).where(eq(jobs.status, "queued")).orderBy(jobs.createdAt).get();
      if (!row) return null;
      const now = Date.now();
      db.update(jobs)
        .set({ status: "running", attempt: row.attempt + 1, startedAt: now, updatedAt: now })
        .where(eq(jobs.id, row.id))
        .run();
      return rowToJob({ ...row, status: "running", attempt: row.attempt + 1, startedAt: now, updatedAt: now });
    },
    async finish(id: string, result: unknown): Promise<void> {
      const now = Date.now();
      db.update(jobs)
        .set({
          status: "succeeded",
          resultJson: JSON.stringify(result),
          error: null,
          updatedAt: now,
          finishedAt: now,
        })
        .where(eq(jobs.id, id))
        .run();
    },
    async fail(id: string, error: string, retry = false): Promise<void> {
      const now = Date.now();
      const row = db.select().from(jobs).where(eq(jobs.id, id)).get();
      const canRetry = retry && row && row.attempt < row.maxAttempts;
      db.update(jobs)
        .set({
          status: canRetry ? "queued" : "failed",
          error: sanitizeError(error),
          updatedAt: now,
          finishedAt: canRetry ? null : now,
        })
        .where(eq(jobs.id, id))
        .run();
    },
    async cancel(id: string): Promise<void> {
      const now = Date.now();
      db.update(jobs)
        .set({ status: "cancelled", updatedAt: now, finishedAt: now })
        .where(eq(jobs.id, id))
        .run();
    },
    async list(limit = 50): Promise<JobRecord[]> {
      return db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(limit).all().map(rowToJob);
    },
  };
}

export type JobQueue = ReturnType<typeof createJobQueue>;

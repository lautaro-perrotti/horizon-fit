import { randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { jobs } from "../db/schema.js";
import type { JobRecord, JobStatus } from "../types.js";

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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const ALLOWED_JOB_TYPES = ["seo.audit", "tests.run", "merchant.audit"] as const;
export type AllowedJobType = (typeof ALLOWED_JOB_TYPES)[number];

export function createJobQueue(db: HorizonDb) {
  return {
    async enqueue(input: {
      type: AllowedJobType;
      args: Record<string, unknown>;
      actor: string;
      clientId: string;
      idempotencyKey?: string;
    }): Promise<JobRecord> {
      if (input.idempotencyKey) {
        const existing = db.select().from(jobs).where(eq(jobs.idempotencyKey, input.idempotencyKey)).get();
        if (existing) return rowToJob(existing);
      }
      const now = Date.now();
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
        createdAt: now,
        updatedAt: now,
      };
      db.insert(jobs).values(record).run();
      return rowToJob(record);
    },
    async get(id: string): Promise<JobRecord | null> {
      const row = db.select().from(jobs).where(eq(jobs.id, id)).get();
      return row ? rowToJob(row) : null;
    },
    async claimNext(): Promise<JobRecord | null> {
      const row = db.select().from(jobs).where(eq(jobs.status, "queued")).orderBy(jobs.createdAt).get();
      if (!row) return null;
      db.update(jobs)
        .set({ status: "running", updatedAt: Date.now() })
        .where(eq(jobs.id, row.id))
        .run();
      return rowToJob({ ...row, status: "running" });
    },
    async finish(id: string, result: unknown): Promise<void> {
      db.update(jobs)
        .set({ status: "succeeded", resultJson: JSON.stringify(result), error: null, updatedAt: Date.now() })
        .where(eq(jobs.id, id))
        .run();
    },
    async fail(id: string, error: string): Promise<void> {
      db.update(jobs)
        .set({ status: "failed", error, updatedAt: Date.now() })
        .where(eq(jobs.id, id))
        .run();
    },
    async list(limit = 50): Promise<JobRecord[]> {
      return db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(limit).all().map(rowToJob);
    },
  };
}

export type JobQueue = ReturnType<typeof createJobQueue>;

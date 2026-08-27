import { randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { auditEvents } from "../db/schema.js";
import type { AuditEvent, AuthPrincipal } from "../types.js";
import { redactArgs } from "../auth/redact.js";

export function createAuditLog(db: HorizonDb) {
  return {
    async record(input: {
      principal: AuthPrincipal;
      tool: string;
      args: unknown;
      outcome: AuditEvent["outcome"];
      statusCode: number;
      jobId?: string | null;
      error?: string | null;
    }): Promise<AuditEvent> {
      const event: AuditEvent = {
        id: randomUUID(),
        at: Date.now(),
        actor: input.principal.subject,
        clientId: input.principal.clientId,
        tool: input.tool,
        argsRedacted: redactArgs(input.args),
        outcome: input.outcome,
        statusCode: input.statusCode,
        jobId: input.jobId ?? null,
        error: input.error ?? null,
      };
      db.insert(auditEvents)
        .values({
          id: event.id,
          at: event.at,
          actor: event.actor,
          clientId: event.clientId,
          tool: event.tool,
          argsRedacted: JSON.stringify(event.argsRedacted),
          outcome: event.outcome,
          statusCode: event.statusCode,
          jobId: event.jobId,
          error: event.error,
        })
        .run();
      return event;
    },
    async history(limit = 50): Promise<AuditEvent[]> {
      const rows = db.select().from(auditEvents).orderBy(desc(auditEvents.at)).limit(Math.min(limit, 200)).all();
      return rows.map((row) => ({
        id: row.id,
        at: row.at,
        actor: row.actor,
        clientId: row.clientId,
        tool: row.tool,
        argsRedacted: JSON.parse(row.argsRedacted) as Record<string, unknown>,
        outcome: row.outcome as AuditEvent["outcome"],
        statusCode: row.statusCode,
        jobId: row.jobId,
        error: row.error,
      }));
    },
    async get(id: string): Promise<AuditEvent | null> {
      const row = db.select().from(auditEvents).where(eq(auditEvents.id, id)).get();
      if (!row) return null;
      return {
        id: row.id,
        at: row.at,
        actor: row.actor,
        clientId: row.clientId,
        tool: row.tool,
        argsRedacted: JSON.parse(row.argsRedacted) as Record<string, unknown>,
        outcome: row.outcome as AuditEvent["outcome"],
        statusCode: row.statusCode,
        jobId: row.jobId,
        error: row.error,
      };
    },
  };
}

export type AuditLog = ReturnType<typeof createAuditLog>;

import { randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { auditEvents } from "../db/schema.js";
import type { AuditEvent, AuthPrincipal } from "../types.js";
import { sanitizeToolArgs } from "../auth/redact.js";
import { TOOL_SCOPES } from "../config.js";
import type { ToolName } from "../types.js";

export function createAuditLog(db: HorizonDb) {
  return {
    async record(input: {
      principal: AuthPrincipal;
      tool: string;
      args: unknown;
      outcome: AuditEvent["outcome"];
      statusCode: number;
      durationMs?: number;
      jobId?: string | null;
      error?: string | null;
    }): Promise<AuditEvent> {
      const event: AuditEvent = {
        id: randomUUID(),
        at: Date.now(),
        actor: input.principal.subject,
        clientId: input.principal.clientId,
        tool: input.tool,
        scope: TOOL_SCOPES[input.tool as ToolName] ?? null,
        argsRedacted: sanitizeToolArgs(input.tool, input.args),
        outcome: input.outcome,
        statusCode: input.statusCode,
        durationMs: input.durationMs ?? 0,
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
          scope: event.scope,
          argsRedacted: JSON.stringify(event.argsRedacted),
          outcome: event.outcome,
          statusCode: event.statusCode,
          durationMs: event.durationMs,
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
        scope: row.scope,
        argsRedacted: JSON.parse(row.argsRedacted) as Record<string, unknown>,
        outcome: row.outcome as AuditEvent["outcome"],
        statusCode: row.statusCode,
        durationMs: row.durationMs,
        jobId: row.jobId,
        error: row.error,
      }));
    },
  };
}

export type AuditLog = ReturnType<typeof createAuditLog>;

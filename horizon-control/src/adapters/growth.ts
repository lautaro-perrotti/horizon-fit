import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { growthOpportunities, opportunityActions } from "../db/schema.js";
import type { CatalogAdapter } from "./woo.js";
import type { InsightsAdapter, ProductInsight, DeterministicInsight } from "./insights.js";
import { cohortFromInsights, evaluateRules, scoreDrafts, type ScoredOpportunity } from "./growth-engine.js";

const STORE_ID = "horizon-fit";

export type GrowthOpportunityRow = ScoredOpportunity & {
  id: string;
  store_id: string;
  status: "open" | "dismissed" | "snoozed" | "done";
  detected_at: string;
  updated_at: string;
  snoozed_until: string | null;
};

export type GrowthAdapter = {
  evaluate: () => Promise<{ evaluated: number; open: number; skipped: number }>;
  list: (status?: GrowthOpportunityRow["status"]) => GrowthOpportunityRow[];
  get: (id: string) => GrowthOpportunityRow | null;
  listForSku: (parentSku: string) => GrowthOpportunityRow[];
  update: (input: {
    id: string;
    action: "dismiss" | "snooze" | "done" | "note";
    note?: string;
    snooze_days?: number;
    actor?: string;
  }) => GrowthOpportunityRow | null;
  asInsights: (rows: GrowthOpportunityRow[]) => DeterministicInsight[];
};

export function createGrowthAdapter(options: {
  db: HorizonDb;
  catalog: CatalogAdapter;
  insights: InsightsAdapter;
}): GrowthAdapter {
  const db = options.db;
  function asRow(row: typeof growthOpportunities.$inferSelect): GrowthOpportunityRow {
    const payload = row.payloadJson ? (JSON.parse(row.payloadJson) as ScoredOpportunity) : null;
    return {
      id: row.id,
      store_id: row.storeId,
      status: row.status as GrowthOpportunityRow["status"],
      detected_at: new Date(row.detectedAt).toISOString(),
      updated_at: new Date(row.updatedAt).toISOString(),
      snoozed_until: row.snoozedUntil ? new Date(row.snoozedUntil).toISOString() : null,
      type: (payload?.type ?? row.ruleId) as ScoredOpportunity["type"],
      parent_sku: row.parentSku,
      product: payload?.product ?? row.parentSku,
      metrics: payload?.metrics ?? {},
      evidence: payload?.evidence ?? [],
      source: payload?.source ?? "growth_engine",
      reason: payload?.reason ?? "",
      recommended_action: payload?.recommended_action ?? "",
      period: payload?.period ?? "",
      score: row.score ?? payload?.score ?? 0,
      score_caption: payload?.score_caption ?? "",
      components: payload?.components ?? {},
      weights_used: payload?.weights_used ?? {},
      severity: (payload?.severity ?? "info") as ScoredOpportunity["severity"],
    };
  }

  function list(status?: GrowthOpportunityRow["status"]) {
    const now = Date.now();
    const rows = db.select().from(growthOpportunities).orderBy(desc(growthOpportunities.score), desc(growthOpportunities.updatedAt)).all();
    return rows
      .map(asRow)
      .map((row) => {
        if (row.status === "snoozed" && row.snoozed_until && Date.parse(row.snoozed_until) <= now) {
          return { ...row, status: "open" as const };
        }
        return row;
      })
      .filter((row) => (status ? row.status === status : row.status === "open" || row.status === "snoozed"));
  }

  return {
    list,
    get(id) {
      const row = db.select().from(growthOpportunities).where(eq(growthOpportunities.id, id)).get();
      return row ? asRow(row) : null;
    },
    listForSku(parentSku) {
      return list("open").filter((row) => row.parent_sku === parentSku);
    },
    asInsights(rows) {
      return rows.map((row) => ({
        type: row.type,
        severity: row.severity,
        entity: row.parent_sku,
        metrics: { ...row.metrics, score: row.score },
        reason: row.reason,
        source: row.source,
        period: row.period,
      }));
    },
    async evaluate() {
      const found = await options.catalog.searchProducts({ limit: 20 });
      const insights: ProductInsight[] = [];
      for (const product of found.products) {
        const insight = await options.insights.getProduct(product.parent_sku || product.sku);
        if (insight) insights.push(insight);
      }
      const cohort = cohortFromInsights(insights);
      const now = Date.now();
      let open = 0;
      for (const insight of insights) {
        const scored = scoreDrafts(insight, evaluateRules(insight, cohort), cohort);
        for (const item of scored) {
          const existing = db
            .select()
            .from(growthOpportunities)
            .where(and(eq(growthOpportunities.storeId, STORE_ID), eq(growthOpportunities.ruleId, item.type), eq(growthOpportunities.parentSku, item.parent_sku)))
            .get();
          if (existing && (existing.status === "dismissed" || existing.status === "done")) continue;
          if (existing && existing.status === "snoozed" && existing.snoozedUntil && existing.snoozedUntil > now) continue;
          const payload = JSON.stringify(item);
          if (existing) {
            db.update(growthOpportunities)
              .set({ score: item.score, payloadJson: payload, status: "open", updatedAt: now, detectedAt: now, snoozedUntil: null })
              .where(eq(growthOpportunities.id, existing.id))
              .run();
          } else {
            db.insert(growthOpportunities)
              .values({
                id: randomUUID(),
                storeId: STORE_ID,
                ruleId: item.type,
                parentSku: item.parent_sku,
                status: "open",
                score: item.score,
                payloadJson: payload,
                detectedAt: now,
                updatedAt: now,
                snoozedUntil: null,
              })
              .run();
          }
          open += 1;
        }
      }
      return { evaluated: insights.length, open, skipped: found.products.length - insights.length };
    },
    update(input) {
      const row = db.select().from(growthOpportunities).where(eq(growthOpportunities.id, input.id)).get();
      if (!row) return null;
      const now = Date.now();
      const status = input.action === "note" ? row.status : input.action === "snooze" ? "snoozed" : input.action === "done" ? "done" : "dismissed";
      const snoozedUntil = input.action === "snooze" ? now + (Math.max(1, input.snooze_days ?? 7) * 86_400_000) : null;
      db.insert(opportunityActions)
        .values({
          id: randomUUID(),
          opportunityId: row.id,
          action: input.action,
          note: input.note ?? null,
          actor: input.actor ?? "dashboard",
          at: now,
        })
        .run();
      db.update(growthOpportunities)
        .set({ status, snoozedUntil, updatedAt: now })
        .where(eq(growthOpportunities.id, row.id))
        .run();
      return asRow(db.select().from(growthOpportunities).where(eq(growthOpportunities.id, row.id)).get()!);
    },
  };
}

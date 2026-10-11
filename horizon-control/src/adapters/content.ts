import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { contentDrafts } from "../db/schema.js";
import type { InsightsAdapter, ProductInsight } from "./insights.js";
import type { GrowthAdapter } from "./growth.js";
import type { ModelGateway } from "../ai/gateway.js";

export const CONTENT_PROMPT_VERSION = "content.v1";

export const CONTENT_KINDS = [
  "seo_title",
  "seo_meta",
  "product_description",
  "collection_copy",
  "ad_copy",
  "email_subject",
  "email_body",
  "instagram_caption",
  "creative_brief",
  "image_prompt",
] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];
export type ContentStatus = "draft" | "approved" | "published-externally";

export type ContentDraftRow = {
  id: string;
  kind: ContentKind;
  parent_sku: string | null;
  opportunity_id: string | null;
  status: ContentStatus;
  body: string;
  notes: string;
  model: string | null;
  prompt_version: string;
  source_context: Record<string, unknown>;
  author: string;
  created_at: string;
  updated_at: string;
};

export type ContentAdapter = {
  generate: (input: {
    kind: ContentKind;
    parent_sku?: string;
    opportunity_id?: string;
    author: string;
  }) => Promise<ContentDraftRow>;
  list: (status?: ContentStatus) => ContentDraftRow[];
  get: (id: string) => ContentDraftRow | null;
  update: (input: { id: string; action: "approve" | "published-externally" | "note"; note?: string; actor: string }) => ContentDraftRow | null;
};

function asRow(row: typeof contentDrafts.$inferSelect): ContentDraftRow {
  return {
    id: row.id,
    kind: row.kind as ContentKind,
    parent_sku: row.parentSku,
    opportunity_id: row.opportunityId,
    status: row.status as ContentStatus,
    body: row.body,
    notes: row.notes ?? "",
    model: row.model,
    prompt_version: row.promptVersion,
    source_context: row.sourceContextJson ? (JSON.parse(row.sourceContextJson) as Record<string, unknown>) : {},
    author: row.author,
    created_at: new Date(row.createdAt).toISOString(),
    updated_at: new Date(row.updatedAt).toISOString(),
  };
}

function sliceNote(name: string, status: string | undefined): string {
  return `${name}:${status ?? "unknown"}`;
}

export function composeFromEvidence(kind: ContentKind, insight: ProductInsight | null, opportunities: Array<{ type: string; reason: string }>): {
  body: string;
  notes: string;
  context: Record<string, unknown>;
} {
  const name = insight?.catalog.data?.name ?? insight?.keys.parent_sku ?? "producto";
  const sku = insight?.keys.parent_sku ?? null;
  const queries = insight?.search.available ? (insight.search.data?.queries ?? []).map((row) => row.query).filter(Boolean).slice(0, 5) : [];
  const title = insight?.seo.available ? insight.seo.data?.title ?? "" : "";
  const issues = insight?.seo.available ? (insight.seo.data?.critical ?? 0) + (insight.seo.data?.warning ?? 0) : null;
  const category = insight?.catalog.data?.categories?.[0] ?? null;
  const opp = opportunities[0];
  const notes = [
    sliceNote("catalog", insight?.catalog.status),
    sliceNote("search", insight?.search.status),
    sliceNote("seo", insight?.seo.status),
    sliceNote("sales", insight?.sales.status),
    "no_publish_to_horizon_fit",
  ].join(" · ");
  const context = {
    parent_sku: sku,
    catalog_status: insight?.catalog.status ?? "not_joined",
    search_status: insight?.search.status ?? "not_joined",
    seo_status: insight?.seo.status ?? "not_joined",
    queries,
    opportunity: opp ? { type: opp.type, reason: opp.reason } : null,
  };
  const queryBit = queries[0] ? ` · ${queries[0]}` : "";
  const bodies: Record<ContentKind, string> = {
    seo_title: title || `${name}${queryBit}`.slice(0, 60),
    seo_meta: queries.length
      ? `${name}. Búsqueda observada: ${queries.slice(0, 3).join(", ")}.`
      : `${name}. Meta sin queries GSC — search ${insight?.search.status ?? "not_joined"}.`,
    product_description: `${name}${category ? ` · ${category}` : ""}. Texto anclado al catálogo. Sales ${insight?.sales.status ?? "not_joined"}.`,
    collection_copy: category ? `Colección ${category}.` : "Colección: sin categoría observada en el catálogo.",
    ad_copy: `${name}${queryBit}. No se afirma performance sin slice ok.`,
    email_subject: name,
    email_body: `Hola,\n\n${name} está en el catálogo Horizon Fit.${opp ? ` Señal: ${opp.type}.` : ""}\n\nNo se publican cambios a la tienda desde este draft.`,
    instagram_caption: `${name}${queryBit}`,
    creative_brief: `SKU ${sku ?? "—"}\nNombre ${name}\nQueries GSC: ${queries.join(", ") || "no disponibles"}\nOportunidad: ${opp?.type ?? "ninguna abierta"}`,
    image_prompt: `Producto de entrenamiento ${name}, fotografía de catálogo, fondo limpio. Sin texto inventado de precio.`,
  };
  return { body: bodies[kind], notes, context };
}

export function createContentAdapter(options: {
  db: HorizonDb;
  insights: InsightsAdapter;
  growth: GrowthAdapter;
  gateway: ModelGateway;
}): ContentAdapter {
  return {
    list(status) {
      const rows = options.db.select().from(contentDrafts).orderBy(desc(contentDrafts.updatedAt)).all();
      return rows.map(asRow).filter((row) => (status ? row.status === status : true));
    },
    get(id) {
      const row = options.db.select().from(contentDrafts).where(eq(contentDrafts.id, id)).get();
      return row ? asRow(row) : null;
    },
    async generate(input) {
      const insight = input.parent_sku ? await options.insights.getProduct(input.parent_sku) : null;
      if (input.parent_sku && !insight) {
        throw Object.assign(new Error("not_found"), { status: 404 });
      }
      const opportunities = input.parent_sku ? options.growth.listForSku(input.parent_sku) : options.growth.list("open");
      const composed = composeFromEvidence(input.kind, insight, opportunities);
      let body = composed.body;
      let model: string | null = null;
      const listed = options.gateway.listModels();
      if (listed.configured) {
        const result = await options.gateway.chat({
          messages: [
            {
              role: "system",
              content: `Redactá ${input.kind} para Horizon Fit. Solo usá el contexto. No inventes métricas. JSON {"body":"..."}`,
            },
            { role: "user", content: JSON.stringify({ kind: input.kind, context: composed.context, seed: composed.body }) },
          ],
          task: "json",
          user: input.author,
        });
        if (result.configured && result.text) {
          try {
            const parsed = JSON.parse(result.text) as { body?: string };
            if (typeof parsed.body === "string" && parsed.body.trim()) body = parsed.body.trim();
            model = result.model;
          } catch {
            model = result.model;
          }
        }
      }
      const now = Date.now();
      const id = randomUUID();
      options.db
        .insert(contentDrafts)
        .values({
          id,
          kind: input.kind,
          parentSku: insight?.keys.parent_sku ?? input.parent_sku ?? null,
          opportunityId: input.opportunity_id ?? opportunities[0]?.id ?? null,
          status: "draft",
          body,
          notes: composed.notes,
          model,
          promptVersion: CONTENT_PROMPT_VERSION,
          sourceContextJson: JSON.stringify(composed.context),
          author: input.author,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return asRow(options.db.select().from(contentDrafts).where(eq(contentDrafts.id, id)).get()!);
    },
    update(input) {
      const row = options.db.select().from(contentDrafts).where(eq(contentDrafts.id, input.id)).get();
      if (!row) return null;
      let status = row.status as ContentStatus;
      if (input.action === "approve") {
        if (status !== "draft") throw Object.assign(new Error("invalid_transition"), { status: 400 });
        status = "approved";
      }
      if (input.action === "published-externally") {
        if (status !== "approved") throw Object.assign(new Error("invalid_transition"), { status: 400 });
        status = "published-externally";
      }
      const notes = input.note ? `${row.notes ?? ""}\n${input.actor}: ${input.note}`.trim() : row.notes;
      options.db.update(contentDrafts).set({ status, notes, updatedAt: Date.now() }).where(eq(contentDrafts.id, row.id)).run();
      return asRow(options.db.select().from(contentDrafts).where(eq(contentDrafts.id, row.id)).get()!);
    },
  };
}

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { aiMessages, aiSessions, aiTraces } from "../db/schema.js";
import type { ModelGateway } from "./gateway.js";
import type { AiToolRuntime, ToolEvidence } from "./tools.js";
import { aiRuntimeTools } from "./principal.js";

export const CHAT_SYSTEM = `Sos el asistente de Horizon Control para Horizon Fit. Solo afirmás hechos que vengan de resultados de tools. Si un slice no está ok/zero/stale, decí el status y no inventes números. Nunca uses $214.000 ni métricas de ejemplo. Respondé JSON: {"message":"texto","tools":[{"name":"tool.dotted","args":{}}]}. Tools vacías si ya podés responder. Cada afirmación de negocio debe poder citarse con source y fetched_at.`;

const MAX_ROUNDS = 3;

export type ChatTurn = {
  configured: boolean;
  reason?: string;
  session_id: string;
  message_id: string | null;
  trace_id: string | null;
  text: string;
  model: string | null;
  usage: { input_tokens: number | null; output_tokens: number | null; cost_usd: number | null };
  tools: Array<{ name: string; ok: boolean; evidence: ToolEvidence }>;
  evidence: ToolEvidence[];
};

export type ChatAdapter = {
  chat: (input: {
    message: string;
    session_id?: string;
    model?: string;
    parent_sku?: string;
    range?: string;
    subject: string;
  }) => Promise<ChatTurn>;
  get: (id: string) => {
    session: { id: string; model: string | null; status: string; created_at: string } | null;
    messages: Array<{ id: string; role: string; content: string; evidence: unknown; at: string }>;
  };
};

function parseTurn(text: string): { message: string; tools: Array<{ name: string; args: unknown }> } {
  try {
    const json = JSON.parse(text) as { message?: unknown; tools?: unknown };
    const tools: Array<{ name: string; args: unknown }> = [];
    if (Array.isArray(json.tools)) {
      for (const row of json.tools) {
        const item = row as { name?: unknown; args?: unknown };
        if (typeof item.name === "string") tools.push({ name: item.name, args: item.args ?? {} });
      }
    }
    return { message: typeof json.message === "string" ? json.message : text, tools };
  } catch {
    return { message: text, tools: [] };
  }
}

export function createChatAdapter(options: { db: HorizonDb; gateway: ModelGateway; runtime: AiToolRuntime }): ChatAdapter {
  const allowed = new Set(aiRuntimeTools());

  function loadSession(id: string) {
    return options.db.select().from(aiSessions).where(eq(aiSessions.id, id)).get();
  }

  function messagesOf(sessionId: string) {
    return options.db.select().from(aiMessages).where(eq(aiMessages.sessionId, sessionId)).orderBy(aiMessages.at).all();
  }

  return {
    get(id) {
      const session = loadSession(id);
      if (!session) return { session: null, messages: [] };
      return {
        session: {
          id: session.id,
          model: session.model,
          status: session.status,
          created_at: new Date(session.createdAt).toISOString(),
        },
        messages: messagesOf(id).map((row) => ({
          id: row.id,
          role: row.role,
          content: row.content,
          evidence: row.evidenceJson ? JSON.parse(row.evidenceJson) : null,
          at: new Date(row.at).toISOString(),
        })),
      };
    },
    async chat(input) {
      const now = Date.now();
      let session = input.session_id ? loadSession(input.session_id) : undefined;
      if (!session) {
        const id = randomUUID();
        options.db
          .insert(aiSessions)
          .values({
            id,
            storeId: "horizon-fit",
            subject: input.subject,
            model: input.model ?? "auto",
            status: "open",
            contextJson: JSON.stringify({ parent_sku: input.parent_sku ?? null, range: input.range ?? null }),
            createdAt: now,
            updatedAt: now,
          })
          .run();
        session = loadSession(id)!;
      }
      options.db
        .insert(aiMessages)
        .values({ id: randomUUID(), sessionId: session.id, role: "user", content: input.message, evidenceJson: null, at: now })
        .run();

      const listed = options.gateway.listModels();
      if (!listed.configured) {
        const empty: ChatTurn = {
          configured: false,
          reason: listed.reason,
          session_id: session.id,
          message_id: null,
          trace_id: null,
          text: "",
          model: null,
          usage: { input_tokens: null, output_tokens: null, cost_usd: null },
          tools: [],
          evidence: [],
        };
        return empty;
      }

      const context = [
        input.parent_sku ? `parent_sku=${input.parent_sku}` : null,
        input.range ? `range=${input.range}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      const history = messagesOf(session.id).map((row) => ({
        role: row.role as "user" | "assistant" | "system",
        content: row.content,
      }));
      const toolsUsed: ChatTurn["tools"] = [];
      const evidence: ToolEvidence[] = [];
      let usage = { input_tokens: 0, output_tokens: 0, cost_usd: 0 as number | null };
      let lastText = "";
      let model: string | null = session.model;

      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const result = await options.gateway.chat({
          messages: [
            { role: "system", content: `${CHAT_SYSTEM}\nAllowed tools: ${[...allowed].join(", ")}` },
            ...history,
            { role: "user", content: context ? `${input.message}\ncontext: ${context}` : input.message },
          ],
          model: input.model ?? "auto",
          task: "chat",
          user: input.subject,
        });
        model = result.model;
        if (result.usage.input_tokens != null) usage.input_tokens += result.usage.input_tokens;
        if (result.usage.output_tokens != null) usage.output_tokens += result.usage.output_tokens;
        if (result.usage.cost_usd != null) usage.cost_usd = (usage.cost_usd ?? 0) + result.usage.cost_usd;
        if (!result.configured) {
          return {
            configured: false,
            reason: result.reason,
            session_id: session.id,
            message_id: null,
            trace_id: null,
            text: "",
            model: result.model,
            usage: result.usage,
            tools: toolsUsed,
            evidence,
          };
        }
        const parsed = parseTurn(result.text);
        lastText = parsed.message;
        const calls = parsed.tools.filter((row) => allowed.has(row.name as never));
        if (!calls.length) break;
        for (const call of calls) {
          const invoked = await options.runtime.invoke(call.name, call.args, input.subject);
          toolsUsed.push({ name: call.name, ok: invoked.ok, evidence: invoked.evidence });
          evidence.push(invoked.evidence, ...invoked.slices);
          history.push({
            role: "assistant",
            content: JSON.stringify({ tool: call.name, ok: invoked.ok, evidence: invoked.evidence, data: invoked.data }),
          });
        }
      }

      const messageId = randomUUID();
      const traceId = randomUUID();
      options.db
        .insert(aiMessages)
        .values({
          id: messageId,
          sessionId: session.id,
          role: "assistant",
          content: lastText,
          evidenceJson: JSON.stringify(evidence),
          at: Date.now(),
        })
        .run();
      options.db
        .insert(aiTraces)
        .values({
          id: traceId,
          sessionId: session.id,
          messageId,
          provider: model?.split(":")[0] ?? null,
          model,
          inputTokens: usage.input_tokens || null,
          outputTokens: usage.output_tokens || null,
          costUsd: usage.cost_usd,
          toolsJson: JSON.stringify(toolsUsed),
          at: Date.now(),
        })
        .run();
      options.db.update(aiSessions).set({ updatedAt: Date.now(), model }).where(eq(aiSessions.id, session.id)).run();
      return {
        configured: true,
        session_id: session.id,
        message_id: messageId,
        trace_id: traceId,
        text: lastText,
        model,
        usage,
        tools: toolsUsed,
        evidence,
      };
    },
  };
}

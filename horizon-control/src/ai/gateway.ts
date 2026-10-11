import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { aiUsage } from "../db/schema.js";
import { estimateCostUsd } from "./cost.js";

export type TaskClass = "chat" | "reason" | "fast" | "local" | "json";
export type ProviderId = "openai" | "anthropic" | "gemini" | "ollama";
export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type ProviderComplete = (input: {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
}) => Promise<{ text: string; input_tokens: number | null; output_tokens: number | null }>;

export type ModelInfo = {
  id: string;
  provider: ProviderId;
  alias: string;
  configured: boolean;
  reason?: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  model?: string;
  task?: TaskClass;
  user?: string;
  max_tokens?: number;
};

export type ChatResult = {
  configured: boolean;
  reason?: string;
  provider: ProviderId | null;
  model: string | null;
  text: string;
  usage: { input_tokens: number | null; output_tokens: number | null; cost_usd: number | null };
  routed: { requested: string; chosen: string | null; failover: string[] };
};

export type UsageReport = {
  day: string;
  configured: boolean;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  by_provider: Array<{ provider: string; calls: number; input_tokens: number; output_tokens: number; cost_usd: number | null }>;
  budget: { daily_usd: number; user_tokens: number; remaining_usd: number | null };
};

export type ModelGateway = {
  listModels: () => { configured: boolean; reason?: string; models: ModelInfo[] };
  usage: (day?: string) => UsageReport;
  chat: (input: ChatRequest) => Promise<ChatResult>;
  stream: (input: ChatRequest) => AsyncGenerator<{ text: string; done: boolean; result?: ChatResult }>;
};

const ALIASES: Record<string, { provider: ProviderId; model: string }> = {
  "openai:gpt-4o-mini": { provider: "openai", model: "gpt-4o-mini" },
  "openai:gpt-4o": { provider: "openai", model: "gpt-4o" },
  "anthropic:claude-sonnet-4-5": { provider: "anthropic", model: "claude-sonnet-4-5" },
  "gemini:gemini-2.0-flash": { provider: "gemini", model: "gemini-2.0-flash" },
  "ollama:llama3.2": { provider: "ollama", model: "llama3.2" },
};

const AUTO: Record<TaskClass, string[]> = {
  fast: ["openai:gpt-4o-mini", "gemini:gemini-2.0-flash", "ollama:llama3.2"],
  reason: ["anthropic:claude-sonnet-4-5", "openai:gpt-4o", "gemini:gemini-2.0-flash"],
  local: ["ollama:llama3.2"],
  json: ["openai:gpt-4o-mini", "anthropic:claude-sonnet-4-5"],
  chat: ["openai:gpt-4o-mini", "anthropic:claude-sonnet-4-5", "gemini:gemini-2.0-flash", "ollama:llama3.2"],
};

function isoDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function createModelGateway(options: {
  db: HorizonDb;
  openaiKey?: string;
  anthropicKey?: string;
  geminiKey?: string;
  ollamaBaseUrl?: string;
  dailyBudgetUsd?: number;
  userTokenBudget?: number;
  complete?: Partial<Record<ProviderId, ProviderComplete>>;
}): ModelGateway {
  const dailyBudgetUsd = options.dailyBudgetUsd ?? 5;
  const userTokenBudget = options.userTokenBudget ?? 100_000;
  const keys: Record<ProviderId, string> = {
    openai: options.openaiKey?.trim() || "",
    anthropic: options.anthropicKey?.trim() || "",
    gemini: options.geminiKey?.trim() || "",
    ollama: options.ollamaBaseUrl?.trim() || "",
  };

  function providerConfigured(id: ProviderId): { configured: boolean; reason?: string } {
    if (keys[id]) return { configured: true };
    const reasons: Record<ProviderId, string> = {
      openai: "missing_openai_api_key",
      anthropic: "missing_anthropic_api_key",
      gemini: "missing_gemini_api_key",
      ollama: "missing_ollama_base_url",
    };
    return { configured: false, reason: reasons[id] };
  }

  function listModels() {
    const models = Object.entries(ALIASES).map(([id, spec]) => {
      const state = providerConfigured(spec.provider);
      return { id, provider: spec.provider, alias: id, ...state };
    });
    const configured = models.some((row) => row.configured);
    return {
      configured,
      reason: configured ? undefined : "missing_ai_provider_keys",
      models,
    };
  }

  function resolveCandidates(requested?: string, task: TaskClass = "chat"): string[] {
    if (requested && requested !== "auto") {
      if (ALIASES[requested]) return [requested, ...AUTO[task].filter((id) => id !== requested)];
      return AUTO[task];
    }
    return AUTO[task];
  }

  function dayTotals(day: string, user?: string) {
    const rows = options.db
      .select()
      .from(aiUsage)
      .where(user ? and(eq(aiUsage.day, day), eq(aiUsage.user, user)) : eq(aiUsage.day, day))
      .all();
    return rows.reduce(
      (acc, row) => {
        acc.calls += row.calls;
        acc.input += row.inputTokens ?? 0;
        acc.output += row.outputTokens ?? 0;
        if (row.costUsd != null) acc.cost = (acc.cost ?? 0) + row.costUsd;
        return acc;
      },
      { calls: 0, input: 0, output: 0, cost: null as number | null },
    );
  }

  function usage(day = isoDay()): UsageReport {
    const rows = options.db.select().from(aiUsage).where(eq(aiUsage.day, day)).all();
    const by = new Map<string, { calls: number; input_tokens: number; output_tokens: number; cost_usd: number | null }>();
    let calls = 0;
    let input = 0;
    let output = 0;
    let cost: number | null = null;
    for (const row of rows) {
      calls += row.calls;
      input += row.inputTokens ?? 0;
      output += row.outputTokens ?? 0;
      if (row.costUsd != null) cost = (cost ?? 0) + row.costUsd;
      const current = by.get(row.provider) ?? { calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: null };
      current.calls += row.calls;
      current.input_tokens += row.inputTokens ?? 0;
      current.output_tokens += row.outputTokens ?? 0;
      if (row.costUsd != null) current.cost_usd = (current.cost_usd ?? 0) + row.costUsd;
      by.set(row.provider, current);
    }
    return {
      day,
      configured: listModels().configured,
      calls,
      input_tokens: input,
      output_tokens: output,
      cost_usd: cost,
      by_provider: [...by.entries()].map(([provider, value]) => ({ provider, ...value })),
      budget: {
        daily_usd: dailyBudgetUsd,
        user_tokens: userTokenBudget,
        remaining_usd: cost == null ? dailyBudgetUsd : Math.max(0, Math.round((dailyBudgetUsd - cost) * 1_000_000) / 1_000_000),
      },
    };
  }

  function record(row: { provider: ProviderId; model: string; user: string; input: number | null; output: number | null; cost: number | null }) {
    const day = isoDay();
    const existing = options.db
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.day, day), eq(aiUsage.provider, row.provider), eq(aiUsage.model, row.model), eq(aiUsage.user, row.user)))
      .get();
    if (existing) {
      options.db
        .update(aiUsage)
        .set({
          calls: existing.calls + 1,
          inputTokens: (existing.inputTokens ?? 0) + (row.input ?? 0),
          outputTokens: (existing.outputTokens ?? 0) + (row.output ?? 0),
          costUsd: existing.costUsd == null && row.cost == null ? null : (existing.costUsd ?? 0) + (row.cost ?? 0),
          updatedAt: Date.now(),
        })
        .where(eq(aiUsage.id, existing.id))
        .run();
      return;
    }
    options.db
      .insert(aiUsage)
      .values({
        id: randomUUID(),
        day,
        provider: row.provider,
        model: row.model,
        user: row.user,
        calls: 1,
        inputTokens: row.input,
        outputTokens: row.output,
        costUsd: row.cost,
        updatedAt: Date.now(),
      })
      .run();
  }

  async function chat(input: ChatRequest): Promise<ChatResult> {
    const catalog = listModels();
    const requested = input.model || "auto";
    const failover: string[] = [];
    if (!catalog.configured) {
      return {
        configured: false,
        reason: catalog.reason,
        provider: null,
        model: null,
        text: "",
        usage: { input_tokens: null, output_tokens: null, cost_usd: null },
        routed: { requested, chosen: null, failover },
      };
    }
    const day = dayTotals(isoDay());
    if (day.cost != null && day.cost >= dailyBudgetUsd) {
      return {
        configured: true,
        reason: "budget_exceeded_daily_usd",
        provider: null,
        model: null,
        text: "",
        usage: { input_tokens: null, output_tokens: null, cost_usd: null },
        routed: { requested, chosen: null, failover },
      };
    }
    if (input.user) {
      const user = dayTotals(isoDay(), input.user);
      if (user.input + user.output >= userTokenBudget) {
        return {
          configured: true,
          reason: "budget_exceeded_user_tokens",
          provider: null,
          model: null,
          text: "",
          usage: { input_tokens: null, output_tokens: null, cost_usd: null },
          routed: { requested, chosen: null, failover },
        };
      }
    }

    const candidates = resolveCandidates(requested, input.task ?? "chat").filter((id) => {
      const spec = ALIASES[id];
      return spec && providerConfigured(spec.provider).configured;
    });
    if (!candidates.length) {
      return {
        configured: false,
        reason: "no_configured_model_for_task",
        provider: null,
        model: null,
        text: "",
        usage: { input_tokens: null, output_tokens: null, cost_usd: null },
        routed: { requested, chosen: null, failover },
      };
    }

    let lastError = "provider_error";
    for (const id of candidates) {
      const spec = ALIASES[id];
      const complete = options.complete?.[spec.provider];
      if (!complete) {
        failover.push(id);
        lastError = "provider_adapter_missing";
        continue;
      }
      try {
        const raw = await complete({ model: spec.model, messages: input.messages, max_tokens: input.max_tokens });
        const cost = estimateCostUsd(id, raw.input_tokens, raw.output_tokens);
        record({
          provider: spec.provider,
          model: id,
          user: input.user || "system",
          input: raw.input_tokens,
          output: raw.output_tokens,
          cost,
        });
        return {
          configured: true,
          provider: spec.provider,
          model: id,
          text: raw.text,
          usage: { input_tokens: raw.input_tokens, output_tokens: raw.output_tokens, cost_usd: cost },
          routed: { requested, chosen: id, failover },
        };
      } catch (error) {
        failover.push(id);
        lastError = error instanceof Error ? error.message.slice(0, 80) : "provider_error";
      }
    }
    return {
      configured: true,
      reason: lastError,
      provider: null,
      model: null,
      text: "",
      usage: { input_tokens: null, output_tokens: null, cost_usd: null },
      routed: { requested, chosen: null, failover },
    };
  }

  return {
    listModels,
    usage,
    chat,
    async *stream(input) {
      const result = await chat(input);
      if (result.text) yield { text: result.text, done: false };
      yield { text: "", done: true, result };
    },
  };
}

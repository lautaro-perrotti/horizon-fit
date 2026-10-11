import { serve } from "@hono/node-server";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createResourceServer } from "../auth/resource-server.js";
import { loadConfig } from "../config.js";
import { PlatformRepository } from "./repository.js";
import { createPlatformApp } from "./app.js";
import type { ModelConfig } from "./assistant.js";
import { configureProvisioning } from './provision.js';
import type { PlatformServices } from './commands.js';
import { createDb } from "../db/client.js";
import { createModelGateway } from "../ai/gateway.js";
import { createOpenAiCompatibleComplete } from "../ai/providers.js";

const development = process.env.PLATFORM_DEV === "1";
if (development && process.env.NODE_ENV === "production") throw new Error("PLATFORM_DEV no puede activarse en producción");
// Studio stays local/pilot on 127.0.0.1:8790. V1 does not deploy it next to horizonfit.com.ar.
const publicUrl = process.env.PLATFORM_PUBLIC_URL || "http://127.0.0.1:8790";
const host = "127.0.0.1", port = Number(process.env.PLATFORM_PORT || 8790);
if (development && !["localhost", "127.0.0.1"].includes(new URL(publicUrl).hostname)) throw new Error("El modo de desarrollo solo permite localhost");
const issuer = process.env.PLATFORM_OIDC_ISSUER || "", clientId = process.env.PLATFORM_OIDC_CLIENT_ID || "", audience = process.env.PLATFORM_OIDC_AUDIENCE || publicUrl + "/mcp";
if (!development && (!issuer.startsWith("https://") || !clientId || !publicUrl.startsWith("https://"))) throw new Error("Configurá PLATFORM_OIDC_ISSUER, CLIENT_ID y PUBLIC_URL HTTPS");
const dir = path.resolve(process.env.PLATFORM_DATA_DIR || "data/platform"); fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, "platform.sqlite")), repo = new PlatformRepository(db);
// An interrupted model never owns a draft transaction. Preserve document and expose recovery.
db.prepare("UPDATE platform_tasks SET status='interrupted' WHERE status='running'").run();
db.prepare("UPDATE platform_imports SET status='failed' WHERE status='publishing'").run();
const manifestSchema = z.record(z.object({ baseUrl: z.string().url(), user: z.string().optional(), password: z.string().optional(), storeSlug: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/), googleServiceAccountPath:z.string().optional(),ga4PropertyId:z.string().optional(),gscSiteUrl:z.string().optional() }).strict());
const manifest = manifestSchema.parse(process.env.PLATFORM_CONNECTIONS_FILE ? JSON.parse(fs.readFileSync(process.env.PLATFORM_CONNECTIONS_FILE, "utf8")) : {});
if (new Set(Object.values(manifest).map(c => c.storeSlug)).size !== Object.keys(manifest).length) throw new Error("Cada motor debe asignarse a una sola tienda");
if (new Set(Object.values(manifest).map(c => c.baseUrl.replace(/\/$/, ""))).size !== Object.keys(manifest).length) throw new Error("No se puede compartir un motor entre tiendas");
for (const c of Object.values(manifest)) { const url = new URL(c.baseUrl); if (url.username || url.password || (!development && url.protocol !== 'https:')) throw new Error("Origen WooCommerce inválido"); }
const gatewayStore = createDb(process.env.HORIZON_SQLITE_PATH || path.join(dir, "gateway.sqlite"));
const openaiKey = process.env.HORIZON_OPENAI_API_KEY || process.env.PLATFORM_LLM_KEY || "";
const llmEndpoint = process.env.PLATFORM_LLM_ENDPOINT || "https://api.openai.com/v1/chat/completions";
if (openaiKey && !llmEndpoint.startsWith("https://") && !development) throw new Error("La IA requiere HTTPS");
const gateway = createModelGateway({
  db: gatewayStore.db,
  openaiKey,
  anthropicKey: process.env.HORIZON_ANTHROPIC_API_KEY,
  geminiKey: process.env.HORIZON_GEMINI_API_KEY,
  ollamaBaseUrl: process.env.HORIZON_OLLAMA_BASE_URL,
  dailyBudgetUsd: Number(process.env.HORIZON_AI_BUDGET_USD_DAILY || 5),
  userTokenBudget: Number(process.env.HORIZON_AI_BUDGET_TOKENS_USER_DAILY || 100000),
  complete: openaiKey ? { openai: createOpenAiCompatibleComplete({ apiKey: openaiKey, endpoint: llmEndpoint }) } : undefined,
});
let model: ModelConfig | undefined;
if (gateway.listModels().configured) {
  model = {
    gateway,
    model: process.env.PLATFORM_LLM_MODEL || "openai:gpt-4o-mini",
    maxTokens: Number(process.env.PLATFORM_LLM_MAX_TOKENS || 16000),
    maxIterations: Number(process.env.PLATFORM_LLM_MAX_ITERATIONS || 2),
  };
  if (!Number.isInteger(model.maxTokens) || model.maxTokens < 1000 || model.maxTokens > 100000 || !Number.isInteger(model.maxIterations) || model.maxIterations < 1 || model.maxIterations > 5) {
    throw new Error("Configuración de modelo/presupuesto inválida");
  }
}
const authConfig = loadConfig({ HORIZON_BIND: host, HORIZON_PUBLIC_URL: publicUrl, HORIZON_OIDC_ISSUER: issuer || "https://local.invalid/", HORIZON_OIDC_AUDIENCE: audience });
// Public platform accepts only its own audience, not the internal control plane's legacy audience.
authConfig.allowedAudiences = [audience];
const auth = development ? undefined : createResourceServer({ config: authConfig });
const services:PlatformServices={repo,connections:manifest,connectionOwners:Object.fromEntries(Object.entries(manifest).map(([key,value])=>[key,value.storeSlug])),model};
configureProvisioning(services);
const app = createPlatformApp({ services, publicUrl, issuer, clientId, audience, development, verify: async token => {
  if (development) { if (token !== "local-development") throw new Error("invalid token"); return { subject: "local-owner" }; }
  return auth!.verifyAccessToken(token);
} });
const server = serve({ fetch: app.fetch, hostname: host, port }, () => console.log(`Horizon Studio: ${publicUrl}${development ? " (desarrollo local)" : ""}`));
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => { server.close(() => { try { gatewayStore.sqlite.close(); } catch { /* already closed */ } db.close(); process.exit(0); }); });

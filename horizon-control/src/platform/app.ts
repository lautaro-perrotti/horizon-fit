import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { commands, dispatchPlatform, type PlatformServices, type Actor } from "./commands.js";
import { PlatformError } from "./repository.js";
import { renderDocument } from "./render.js";
import { documentSchema } from './document.js';
import { catalogFor } from "./catalog.js";
import { answerBuyer, buyerWidget, buyerScript } from './buyer.js';

export type PlatformAppOptions = { services: PlatformServices; verify: (token: string) => Promise<Actor>; publicUrl: string; issuer: string; clientId: string; audience: string; development?: boolean; editorDir?: string };
export function createPlatformApp(options: PlatformAppOptions) {
  const { services: s } = options;
  const app = new Hono<{ Variables: { actor: Actor } }>();
  const active = new Set<string>(), rates = new Map<string, { count: number; until: number }>();
  function rate(key: string, limit: number, window = 60000) {
    const now = Date.now(); if (rates.size > 2000) for (const [k, v] of rates) if (v.until < now) rates.delete(k);
    const current = rates.get(key); if (!current || current.until < now) rates.set(key, { count: 1, until: now + window });
    else { if (++current.count > limit) throw new PlatformError(429, "Se alcanzó el límite temporal. Intentá nuevamente más tarde."); }
  }
  app.use("*", bodyLimit({ maxSize: 1_200_000, onError: c => c.json({ error: "Solicitud demasiado grande" }, 413) }));
  app.use("*", async (c, next) => {
    if (options.development && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(c.req.url).hostname)) return c.json({ error: "Host no permitido" }, 403);
    const origin = c.req.header("origin");
    if (origin && origin !== new URL(options.publicUrl).origin) return c.json({ error: "Origen no permitido" }, 403);
    c.header("X-Content-Type-Options", "nosniff"); c.header("Referrer-Policy", "no-referrer");
    c.header("Cache-Control", "no-store");
    await next();
  });
  app.onError((error, c) => {
    if (error instanceof z.ZodError) return c.json({ error: "Datos inválidos", details: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).slice(0, 10) }, 400);
    if (error instanceof PlatformError) return c.json({ error: error.message }, error.status as 400);
    console.error("platform_error", error.name, error.message);
    return c.json({ error: "No se pudo completar la operación" }, 500);
  });
  const auth = async (c: any, next: () => Promise<void>) => {
    const token = c.req.header("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    try { if (!token) throw new Error(); c.set("actor", await options.verify(token)); }
    catch { c.header("WWW-Authenticate", `Bearer resource_metadata="${options.publicUrl}/.well-known/oauth-protected-resource"`); return c.json({ error: "Iniciá sesión para continuar" }, 401); }
    await next();
  };
  app.use("/v1/*", auth); app.use("/mcp", auth);
  app.get("/healthz", c => c.json({ ok: true, service: "horizon-platform", version: 1 }));
  app.get("/platform-config.json", c => c.json({ issuer: options.issuer, clientId: options.clientId, audience: options.audience, development: !!options.development, apiBase: "/v1", resource: options.publicUrl + "/mcp" }));
  app.get("/.well-known/oauth-protected-resource", c => c.json({ resource: options.publicUrl + "/mcp", authorization_servers: [options.issuer], bearer_methods_supported: ["header"] }));
  app.get("/v1/tools", c => c.json(Object.entries(commands).map(([name, command]) => ({ name, description: command.description, write: command.write }))));
  app.post("/v1/commands/:name", async c => {
    const actor = c.get("actor"), name = c.req.param("name"); rate(actor.subject, 90);
    if (name === "assistant.run") { rate(`${actor.subject}:ai`, 30, 3600000); if (active.has(actor.subject)) throw new PlatformError(409, "Ya hay una tarea en curso"); active.add(actor.subject); }
    try { return c.json(await dispatchPlatform(s, name, await c.req.json(), actor)); }
    finally { if (name === "assistant.run") active.delete(actor.subject); }
  });
  app.get("/v1/stores/:storeId/preview", c => {
    const storeId = c.req.param("storeId"); s.repo.access(storeId, c.get("actor").subject);
    const nonce = randomUUID(); c.header("Content-Security-Policy", `default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`);
    return c.html(renderDocument(s.repo.document(storeId).document, { path: c.req.query("path") || "/", preview: true, nonce }));
  });
  app.all("/mcp", async c => {
    rate(c.get("actor").subject, 90);
    const server = new McpServer({ name: "horizon-platform", version: "1.0.0" });
    for (const [name, command] of Object.entries(commands)) {
      server.registerTool(name.replaceAll(".", "_"), { description: command.description, inputSchema: command.schema.shape }, async (args: Record<string, unknown>) => {
        try { return { content: [{ type: "text" as const, text: JSON.stringify(await dispatchPlatform(s, name, args, c.get("actor"))) }] }; }
        catch (error) { return { isError: true, content: [{ type: "text" as const, text: error instanceof PlatformError ? error.message : "No se pudo completar la operación" }] }; }
      });
    }
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try { return await transport.handleRequest(c.req.raw); }
    finally { await transport.close(); await server.close(); }
  });
  app.get("/shop/:slug", c => c.redirect(`/shop/${c.req.param("slug")}/`));
  app.get('/buyer-widget.js',c=>c.body(buyerScript,200,{'Content-Type':'text/javascript; charset=utf-8'}));
  app.get("/shop/:slug/*", c => {
    const store = s.repo.publicStore(c.req.param("slug")); if (!store) return c.notFound();
    const prefix = `/shop/${store.slug}`, requested = c.req.path.slice(prefix.length) || "/";
    const artifact = s.repo.db.prepare('SELECT document FROM platform_artifacts WHERE store_id=? AND revision=?').get(store.id,store.published) as {document:string}|undefined;
    const doc = artifact ? documentSchema.parse(JSON.parse(artifact.document)) : s.repo.document(store.id, store.published!).document;
    const connection=s.connections[s.repo.settings(store.id).connection];
    if (!doc.pages.some(p => p.path === requested)) {
      if(connection && ['/checkout/','/cart/','/shop/','/coleccion/'].includes(requested)) return c.redirect(connection.baseUrl.replace(/\/$/,'')+(requested==='/coleccion/'?'/shop/':requested));
      return c.notFound();
    }
    c.header("Content-Security-Policy", "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src https: http:; base-uri 'none'; frame-ancestors 'self'");
    c.header("ETag", `"${store.id}-${store.published}-${requested}"`);
    // Published documents contain no editor runtime or privileged data.
    return c.html(renderDocument(doc, { path: requested, origin: options.publicUrl + prefix }).replace(/href="\/(?!\/)([^\"]*)"/g, `href="${prefix}/$1"`).replace('</body>',(connection?buyerWidget(store.slug):'')+'</body>'));
  });
  app.post("/shop/:slug/assistant", async c => {
    const store = s.repo.publicStore(c.req.param("slug")); if (!store) return c.notFound();
    rate(`buyer:${store.id}`, 60, 3600000);
    const { question } = z.object({ question: z.string().min(1).max(300) }).strict().parse(await c.req.json());
    return c.json(await answerBuyer(s,store.id,question));
  });
  const editorDir = options.editorDir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../editor/dist");
  app.get("/*", c => {
    const relative = c.req.path.replace(/^\/+/, ""), target = path.resolve(editorDir, relative || "index.html"), root = path.resolve(editorDir);
    if (target !== root && !target.startsWith(root + path.sep)) return c.notFound();
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(root, "index.html");
    if (!fs.existsSync(file)) return c.text("Compilá el editor con npm run editor:build", 503);
    const ext = path.extname(file), mime: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
    if (ext === ".html") c.header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src 'self' blob:; img-src 'self' https: data:; connect-src 'self' https:; base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
    return new Response(fs.readFileSync(file), { headers: { "Content-Type": mime[ext] || "application/octet-stream", "Cache-Control": ext === ".html" ? "no-store" : "public,max-age=31536000,immutable" } });
  });
  return app;
}

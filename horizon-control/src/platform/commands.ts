import { z } from "zod";
import { randomUUID } from "node:crypto";
import { idSchema, operationSchema, findNode, variants, diffDocuments, themes } from "./document.js";
import { PlatformRepository, PlatformError, type Store } from "./repository.js";
import { runAssistant, type ModelConfig } from "./assistant.js";
import { catalogFor, validateImport, stageImport, publishImport, productInput, type ConnectionMap } from "./catalog.js";
import { publishDesign, assertNotPublishing, resolveBindings } from './publication.js';
import { integrationReport } from './integrations.js';
export type Actor = { subject: string };
export type PlatformServices = { repo: PlatformRepository; connections: ConnectionMap; model?: ModelConfig; connectionOwners?: Record<string, string>; provision?: (store:Store)=>Promise<void> };
type Command = { description: string; write: boolean; schema: z.AnyZodObject; run: (s: PlatformServices, a: any, actor: Actor) => unknown | Promise<unknown> };
const scoped = { storeId: idSchema };
const revision = z.number().int().positive();
export const commands: Record<string, Command> = {
  'integrations.report': {description:'Consultar ventas, GA4 o Search Console mediante adaptadores existentes y credenciales de esta tienda',write:false,schema:z.object({...scoped,source:z.enum(['ga4','searchConsole','sales'])}).strict(),run:(s,a)=>integrationReport(s,a.storeId,a.source)},
  "stores.list": { description: "Listar las tiendas del usuario", write: false, schema: z.object({}).strict(), run: (s, a, u) => s.repo.list(u.subject) },
  "stores.create": { description: "Crear una tienda del piloto", write: true, schema: z.object({ name: z.string().min(1).max(100), slug: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/), theme: z.enum(["linen", "ink", "coast"]).default("linen") }).strict(), run: (s, a, u) => { const store=s.repo.create(u.subject,a.name,a.slug,a.theme); if(s.provision) void s.provision(store).catch(()=>{}); return store; } },
  "design.get": { description: "Obtener el documento editable y su revisión", write: false, schema: z.object(scoped).strict(), run: (s, a) => ({ ...s.repo.document(a.storeId), themes }) },
  "design.inspect": { description: "Inspeccionar un elemento por ID estable, con origen de datos y estilos", write: false, schema: z.object({ ...scoped, nodeId: idSchema }).strict(), run: (s, a) => { const found = findNode(s.repo.document(a.storeId).document, a.nodeId); return { pageId: found.page.id, blockId: found.block.id, node: found.node }; } },
  "design.patch": { description: "Aplicar operaciones validadas al borrador; requiere la revisión actual", write: true, schema: z.object({ ...scoped, revision, operations: z.array(operationSchema).min(1).max(30) }).strict(), run: (s, a, u) => s.repo.patch(a.storeId, u.subject, a.revision, a.operations) },
  "design.variants": { description: "Calcular hasta seis variantes sin consumir IA", write: false, schema: z.object({ ...scoped, nodeId: idSchema, seed: z.number().int().default(42), count: z.number().int().min(1).max(6).default(3) }).strict(), run: (s, a) => variants(findNode(s.repo.document(a.storeId).document, a.nodeId).node, a.seed, a.count) },
  "design.history": { description: "Listar las últimas 50 revisiones", write: false, schema: z.object(scoped).strict(), run: (s, a) => s.repo.history(a.storeId) },
  "design.compare": { description: "Comparar dos revisiones de diseño", write: false, schema: z.object({ ...scoped, before: revision, after: revision }).strict(), run: (s, a) => diffDocuments(s.repo.document(a.storeId, a.before).document, s.repo.document(a.storeId, a.after).document) },
  "design.restore": { description: "Recuperar una revisión en un nuevo borrador; no modifica datos comerciales", write: true, schema: z.object({ ...scoped, revision, target: revision }).strict(), run: (s, a, u) => s.repo.save(a.storeId, u.subject, a.revision, s.repo.document(a.storeId, a.target).document, `Recuperar versión ${a.target}`) },
  "design.publish": { description: "Publicar explícitamente la revisión revisada del diseño", write: true, schema: z.object({ ...scoped, revision }).strict(), run: (s, a, u) => publishDesign(s, u.subject, a.storeId, a.revision) },
  "design.resolve": { description: "Resolver datos vinculados para inspeccionar la vista previa", write: false, schema: z.object(scoped).strict(), run: async (s,a) => ({...s.repo.document(a.storeId),document:await resolveBindings(s,a.storeId,s.repo.document(a.storeId).document)}) },
  "assistant.run": { description: "Editar el borrador con contexto mínimo y consumo limitado", write: true, schema: z.object({ ...scoped, revision, prompt: z.string().min(1).max(2000), nodeId: idSchema.optional() }).strict(), run: (s, a, u) => runAssistant(s.repo, u.subject, a.storeId, a, s.model) },
  "assistant.usage": { description: "Consultar consumo y estado de las últimas tareas", write: false, schema: z.object(scoped).strict(), run: (s, a) => s.repo.usage(a.storeId) },
  "catalog.search": { description: "Buscar productos de esta tienda sin enviar el catálogo completo", write: false, schema: z.object({ ...scoped, query: z.string().max(200).optional(), page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(20).default(10) }).strict(), run: async (s, a) => { const result = await catalogFor(s.repo, a.storeId, s.connections).searchProducts(a); return { ...result, products: result.products.map(p => ({ id: p.id, name: p.name, sku: p.sku, price: p.price, image: p.images[0], stock: p.stock_status })) }; } },
  "catalog.validate_csv": { description: "Mapear y validar un CSV sin escribir productos", write: false, schema: z.object({ ...scoped, csv: z.string().max(1_000_000), mapping: z.record(z.string()).default({}) }).strict(), run: (s, a) => validateImport(a.csv, a.mapping) },
  "catalog.stage": { description: "Guardar cambios de productos simples para revisión", write: true, schema: z.object({ ...scoped, products: z.array(productInput).min(1).max(500) }).strict(), run: (s, a) => stageImport(s.repo, a.storeId, a.products) },
  "catalog.publish": { description: "Aplicar explícitamente una importación revisada a WooCommerce", write: true, schema: z.object({ ...scoped, importId: idSchema }).strict(), run: (s, a) => publishImport(s.repo, a.storeId, a.importId, s.connections) },
  "connections.get": { description: "Ver conexiones disponibles para esta tienda sin revelar credenciales", write: false, schema: z.object(scoped).strict(), run: (s, a, u) => ({ settings: s.repo.settings(a.storeId), available: Object.keys(s.connections).filter(key => s.connectionOwners?.[key] === s.repo.access(a.storeId, u.subject).slug), capabilities: { ga4: "existing-control-adapter", searchConsole: "existing-control-adapter", merchant: "feed-and-diagnostics", meta: "pixel-and-purchase-capi", llm: s.model ? "configured" : "not-configured" } }) },
  "connections.save": { description: "Conectar el motor asignado por la plataforma a esta tienda", write: true, schema: z.object({ ...scoped, connection: z.string().max(100), domain: z.string().regex(/^$|^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/).default("") }).strict(), run: (s, a, u) => {
    const store = s.repo.access(a.storeId, u.subject, true);
    if (!s.connections[a.connection] || s.connectionOwners?.[a.connection] !== store.slug) throw new PlatformError(403, "La conexión no está asignada a esta tienda");
    s.repo.setSettings(a.storeId, u.subject, { ...s.repo.settings(a.storeId), connection: a.connection, requestedDomain: a.domain }); return { saved: true, domainStatus: a.domain ? "pending-dns-verification" : "platform-domain" };
  } },
};
export async function dispatchPlatform(s: PlatformServices, name: string, input: unknown, actor: Actor) {
  const command = commands[name]; if (!command) throw new PlatformError(404, "Operación no encontrada");
  const args = command.schema.parse(input);
  if (args.storeId) s.repo.access(args.storeId, actor.subject, command.write);
  if (args.storeId && command.write && name !== 'design.publish') assertNotPublishing(args.storeId);
  const started = Date.now();
  try { const result = await command.run(s, args, actor); if (args.storeId && command.write && name !== "assistant.run") s.repo.event(args.storeId, actor.subject, name, { requestId: randomUUID(), duration: Date.now() - started }); return result; }
  catch (error) { if (args.storeId) s.repo.event(args.storeId, actor.subject, `${name}.failed`, { duration: Date.now() - started }); throw error; }
}

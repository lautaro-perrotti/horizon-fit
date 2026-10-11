import { z } from "zod";

export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const safeUrl = z.string().max(2048).refine(v => !v || /^https?:\/\/[^\s]+$/i.test(v) || /^\/(?!\/)[^\s]*$/.test(v) || /^#[\w-]*$/.test(v), "URL no permitida");
const color = z.string().regex(/^#[\da-fA-F]{6}$/);
export const styleSchema = z.object({
  color: color.optional(), background: color.optional(), fontSize: z.number().min(10).max(160).optional(),
  padding: z.number().min(0).max(160).optional(), gap: z.number().min(0).max(100).optional(),
  borderRadius: z.number().min(0).max(100).optional(), maxWidth: z.number().min(100).max(2000).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(), fontWeight: z.enum(["400", "500", "600", "700"]).optional(),
  display: z.enum(["block", "flex", "grid"]).optional(), columns: z.number().int().min(1).max(4).optional(),
}).strict();
export const nodeSchema = z.object({
  id: idSchema, parentId: idSchema.nullable().default(null), tag: z.enum(["div", "h1", "h2", "h3", "p", "span", "a", "img"]),
  text: z.string().max(4000).default(""), src: safeUrl.optional(), href: safeUrl.optional(), alt: z.string().max(200).optional(),
  style: styleSchema.default({}), mobile: styleSchema.default({}),
  binding: z.object({ productId: z.number().int().positive(), field: z.enum(["name", "price", "image"]) }).strict().optional(),
}).strict();
export const blockSchema = z.object({ id: idSchema, name: z.string().min(1).max(100), type: z.enum(["hero", "content", "products", "custom"]), visible: z.boolean().default(true), nodes: z.array(nodeSchema).min(1).max(80) }).strict();
export const documentSchema = z.object({
  schemaVersion: z.literal(1), brand: z.object({ name: z.string().min(1).max(100), accent: color, background: color, foreground: color }).strict(),
  pages: z.array(z.object({ id: idSchema, path: z.string().regex(/^\/(?:[a-z0-9-]+\/)*$/), title: z.string().min(1).max(150), description: z.string().max(300), blocks: z.array(blockSchema).max(40) }).strict()).min(1).max(30),
}).strict().superRefine((doc, ctx) => {
  const ids = new Set<string>(), paths = new Set<string>();
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  const unique = (id: string) => { if (ids.has(id)) issue(`ID duplicado: ${id}`); ids.add(id); };
  for (const page of doc.pages) {
    unique(page.id); if (paths.has(page.path)) issue("Ruta duplicada"); paths.add(page.path);
    for (const block of page.blocks) {
      unique(block.id); const local = new Map(block.nodes.map(n => [n.id, n]));
      for (const node of block.nodes) {
        unique(node.id); let parent = node.parentId; const visited = new Set([node.id]);
        while (parent) { const ancestor = local.get(parent); if (!ancestor || visited.has(parent) || ancestor.tag === "img") { issue(`Jerarquía inválida: ${node.id}`); break; } visited.add(parent); parent = ancestor.parentId; }
      }
    }
  }
  if (!paths.has("/")) issue("Falta la página de inicio");
});
export type StoreDocument = z.infer<typeof documentSchema>;
export type DesignNode = z.infer<typeof nodeSchema>;
export type Block = z.infer<typeof blockSchema>;
export type DesignStyle = z.infer<typeof styleSchema>;
export const themes = {
  linen: { accent: "#6554c0", background: "#faf8f5", foreground: "#252327" },
  ink: { accent: "#d0f276", background: "#191c1b", foreground: "#f5f4ee" },
  coast: { accent: "#146c70", background: "#f2f7f5", foreground: "#193438" },
};
export function initialDocument(name: string, theme: keyof typeof themes = "linen"): StoreDocument {
  return documentSchema.parse({ schemaVersion: 1, brand: { name, ...themes[theme] }, pages: [{ id: "home", path: "/", title: name, description: `Descubrí la colección de ${name}.`, blocks: [
    { id: "hero", type: "hero", name: "Presentación", visible: true, nodes: [
      { id: "eyebrow", tag: "p", text: "NUEVA COLECCIÓN", style: { fontSize: 12, fontWeight: "600" } },
      { id: "headline", tag: "h1", text: "Hecho para tu día.", style: { fontSize: 76, maxWidth: 760 }, mobile: { fontSize: 42 } },
      { id: "intro", tag: "p", text: "Descubrí piezas que vas a querer usar todos los días.", style: { fontSize: 18 } },
      { id: "cta", tag: "a", text: "Explorar colección →", href: "/coleccion/", style: { fontSize: 16 } },
    ] },
    { id: "story", type: "content", name: "Nuestra historia", visible: true, nodes: [
      { id: "story-title", tag: "h2", text: "Los detalles hacen la diferencia.", style: { fontSize: 36 }, mobile: { fontSize: 28 } },
      { id: "story-body", tag: "p", text: "Contá qué hace especial a tu marca. Este espacio también es tuyo.", style: { maxWidth: 640 } },
    ] },
  ] }] });
}
export function findNode(doc: StoreDocument, id: string) {
  for (const page of doc.pages) for (const block of page.blocks) { const node = block.nodes.find(n => n.id === id); if (node) return { page, block, node }; }
  throw new Error("Elemento no encontrado");
}
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("node.update"), nodeId: idSchema, changes: nodeSchema.omit({ id: true, parentId: true }).partial() }).strict(),
  z.object({ op: z.literal("block.add"), pageId: idSchema, block: blockSchema }).strict(),
  z.object({ op: z.literal("block.remove"), blockId: idSchema }).strict(),
  z.object({ op: z.literal("block.move"), blockId: idSchema, index: z.number().int().min(0).max(39) }).strict(),
  z.object({ op: z.literal("brand.update"), brand: documentSchema.innerType().shape.brand.partial() }).strict(),
  z.object({ op: z.literal("page.add"), id: idSchema, path: z.string().regex(/^\/(?:[a-z0-9-]+\/)+$/), title: z.string().min(1).max(150) }).strict(),
]);
export type DesignOperation = z.infer<typeof operationSchema>;
export function applyOperations(input: StoreDocument, operations: DesignOperation[]): StoreDocument {
  const doc = structuredClone(input);
  for (const op of operations) {
    if (op.op === "node.update") Object.assign(findNode(doc, op.nodeId).node, op.changes);
    if (op.op === "brand.update") Object.assign(doc.brand, op.brand);
    if (op.op === "page.add") doc.pages.push({ id: op.id, path: op.path, title: op.title, description: "", blocks: [] });
    if (op.op === "block.add") { const page = doc.pages.find(p => p.id === op.pageId); if (!page) throw new Error("Página no encontrada"); page.blocks.push(op.block); }
    if (op.op === "block.remove" || op.op === "block.move") {
      const page = doc.pages.find(p => p.blocks.some(b => b.id === op.blockId)); if (!page) throw new Error("Bloque no encontrado");
      const index = page.blocks.findIndex(b => b.id === op.blockId), [block] = page.blocks.splice(index, 1);
      if (op.op === "block.move") page.blocks.splice(Math.min(op.index, page.blocks.length), 0, block);
    }
  }
  return documentSchema.parse(doc);
}
export function variants(node: DesignNode, seed: number, count = 3): DesignStyle[] {
  let state = seed >>> 0;
  return Array.from({ length: Math.min(count, 6) }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return { ...node.style, fontSize: Math.max(12, Math.min(120, (node.style.fontSize || 32) + ((state % 5) - 2) * 4)), textAlign: (["left", "center", "right"] as const)[state % 3] };
  });
}
export function diffDocuments(before: StoreDocument, after: StoreDocument) {
  const changes: { path: string; before: unknown; after: unknown }[] = [];
  function visit(a: any, b: any, path: string) {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) { for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) visit(a[key], b[key], `${path}/${key}`); }
    else changes.push({ path, before: a ?? null, after: b ?? null });
  }
  visit(before, after, ""); return changes;
}

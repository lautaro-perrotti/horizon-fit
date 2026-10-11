import { z } from "zod";
import { createCatalogAdapter } from "../adapters/woo.js";
import { allowlistedFetch } from "../http/allowlist.js";
import { PlatformError, type PlatformRepository } from "./repository.js";
import { randomUUID } from "node:crypto";
export const productInput = z.object({ sku: z.string().min(1).max(100), name: z.string().min(1).max(200), regular_price: z.string().regex(/^\d+(\.\d{1,2})?$/), stock_quantity: z.number().int().min(0).max(1000000), description: z.string().max(10000).default("") }).strict();
export type ProductInput = z.infer<typeof productInput>;
export type Connection = { baseUrl: string; user?: string; password?: string; googleServiceAccountPath?: string; ga4PropertyId?: string; gscSiteUrl?: string };
export type ConnectionMap = Record<string, Connection>;
export function connectionFor(repo: PlatformRepository, storeId: string, connections: ConnectionMap): Connection {
  const key = repo.settings(storeId).connection;
  if (!key || !connections[key]) throw new PlatformError(409, "Conectá el motor WooCommerce de esta tienda");
  return connections[key];
}
export function catalogFor(repo: PlatformRepository, storeId: string, connections: ConnectionMap) {
  const config = connectionFor(repo, storeId, connections);
  return createCatalogAdapter({ baseUrl: config.baseUrl, extraHosts: [new URL(config.baseUrl).hostname] });
}
export function parseCsv(text: string): string[][] {
  if (text.length > 1_000_000) throw new PlatformError(400, "El CSV supera 1 MB");
  const rows: string[][] = []; let row: string[] = [], value = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(value); value = ""; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(value); if (row.some(v => v.trim())) rows.push(row); row = []; value = ""; }
    else value += c;
  }
  if (quoted) throw new PlatformError(400, "CSV con comillas sin cerrar");
  row.push(value); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length > 501) throw new PlatformError(400, "Máximo 500 productos por importación");
  return rows;
}
export function validateImport(csv: string, mapping: Record<string, string>) {
  const [headers = [], ...rows] = parseCsv(csv); const products: ProductInput[] = [], errors: { row: number; message: string }[] = [], seen = new Set<string>();
  rows.forEach((row, index) => {
    const obj: Record<string, unknown> = {};
    for (const field of ["sku", "name", "regular_price", "stock_quantity", "description"]) { const value = row[headers.indexOf(mapping[field] || field)]?.trim() ?? ""; obj[field] = field === "stock_quantity" ? (value === "" ? NaN : Number(value)) : value; }
    const parsed = productInput.safeParse(obj);
    if (!parsed.success) errors.push({ row: index + 2, message: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
    else if (seen.has(parsed.data.sku)) errors.push({ row: index + 2, message: "SKU duplicado" });
    else { seen.add(parsed.data.sku); products.push(parsed.data); }
  });
  if (!rows.length) errors.push({ row: 1, message: "El archivo no contiene productos" });
  return { headers, products, errors };
}
export function stageImport(repo: PlatformRepository, storeId: string, products: ProductInput[]) {
  const rows = z.array(productInput).min(1).max(500).parse(products), id = randomUUID();
  if (new Set(rows.map(r => r.sku)).size !== rows.length) throw new PlatformError(400, "SKU duplicado");
  repo.db.prepare("INSERT INTO platform_imports VALUES(?,?,?,'draft',NULL,?)").run(id, storeId, JSON.stringify(rows), Date.now()); return { id, count: rows.length, status: "draft" };
}
export async function publishImport(repo: PlatformRepository, storeId: string, id: string, connections: ConnectionMap) {
  const row = repo.db.prepare("SELECT * FROM platform_imports WHERE id=? AND store_id=?").get(id, storeId) as { rows: string; status: string; result: string | null } | undefined;
  if (!row) throw new PlatformError(404, "Importación no encontrada");
  if (row.status === "published") return JSON.parse(row.result!);
  const config = connectionFor(repo, storeId, connections);
  if (!config.user || !config.password) throw new PlatformError(409, "Faltan credenciales de escritura de WooCommerce");
  const claimed = repo.db.prepare("UPDATE platform_imports SET status='publishing' WHERE id=? AND store_id=? AND status IN ('draft','failed')").run(id, storeId);
  if (!claimed.changes) throw new PlatformError(409, "La importación ya está en curso");
  const completed: any[] = row.result ? JSON.parse(row.result).completed || [] : [];
  async function request(route: string, method = "GET", body?: unknown) {
    const response = await allowlistedFetch(`${config.baseUrl.replace(/\/$/, "")}/wp-json/wc/v3/${route}`, [new URL(config.baseUrl).hostname], { method, timeoutMs:30000, headers: { Authorization: `Basic ${Buffer.from(`${config.user}:${config.password}`).toString('base64')}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new PlatformError(502, `WooCommerce respondió ${response.status}`); return response.json() as Promise<any>;
  }
  try {
    for (const product of JSON.parse(row.rows) as ProductInput[]) {
      if (completed.some(p => p.sku === product.sku)) continue;
      const existing = await request(`products?sku=${encodeURIComponent(product.sku)}&per_page=2`);
      if (!Array.isArray(existing) || existing.length > 1) throw new PlatformError(409, `SKU ambiguo: ${product.sku}`);
      if (existing[0] && existing[0].type !== "simple") throw new PlatformError(409, "Las variantes requieren una importación específica; no se modificaron");
      const payload = { ...product, description: product.description.replace(/</g, '&lt;').replace(/>/g, '&gt;'), manage_stock: true, ...(existing.length ? {} : { type: "simple", status: "publish" }) };
      const result = await request(existing.length ? `products/${existing[0].id}` : "products", existing.length ? "PUT" : "POST", payload);
      completed.push({ sku: product.sku, id: result.id });
      repo.db.prepare("UPDATE platform_imports SET result=? WHERE id=?").run(JSON.stringify({ completed }), id);
    }
    const result = { completed, status: "published" }; repo.db.prepare("UPDATE platform_imports SET status='published',result=? WHERE id=?").run(JSON.stringify(result), id); return result;
  } catch (error) { repo.db.prepare("UPDATE platform_imports SET status='failed',result=? WHERE id=?").run(JSON.stringify({ completed }), id); throw error; }
}

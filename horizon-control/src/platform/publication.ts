import { randomUUID } from 'node:crypto';
import { allowlistedFetch } from '../http/allowlist.js';
import { catalogFor, connectionFor } from './catalog.js';
import { renderDocument } from './render.js';
import { PlatformError } from './repository.js';
import type { PlatformServices } from './commands.js';
import type { StoreDocument } from './document.js';
export async function resolveBindings(s: PlatformServices, storeId: string, input: StoreDocument): Promise<StoreDocument> {
  const doc = structuredClone(input), nodes = doc.pages.flatMap(p=>p.blocks.flatMap(b=>b.nodes)), ids=[...new Set(nodes.flatMap(n=>n.binding ? [n.binding.productId] : []))];
  if (ids.length > 100) throw new PlatformError(400,'Máximo 100 productos vinculados por publicación');
  if (!ids.length) return doc;
  const catalog = catalogFor(s.repo,storeId,s.connections), products = new Map<number,Awaited<ReturnType<typeof catalog.getProduct>>>();
  for (const id of ids) { const product=await catalog.getProduct(id); if(!product)throw new PlatformError(409,`Producto ${id} no disponible`); products.set(id,product); }
  for(const node of nodes) if(node.binding) { const p=products.get(node.binding.productId)!; if(node.binding.field==='image'){node.src=p!.images[0] || '';node.alt=p!.name;} else node.text=node.binding.field==='name' ? p!.name : `${p!.price.currency} ${p!.price.amount || ''}`; }
  return doc;
}
const publishing = new Set<string>();
export function assertNotPublishing(storeId: string) { if(publishing.has(storeId))throw new PlatformError(409,'Hay una publicación en curso. Esperá antes de editar.'); }
export async function publishDesign(s: PlatformServices, subject: string, storeId: string, revision: number) {
  assertNotPublishing(storeId); const store=s.repo.access(storeId,subject,true); if(store.revision!==revision)throw new PlatformError(409,'El borrador cambió antes de publicar'); publishing.add(storeId);
  try {
    const current=s.repo.document(storeId,revision), resolved=await resolveBindings(s,storeId,current.document);
    const settings=s.repo.settings(storeId);
    if(settings.connection) {
      const config=connectionFor(s.repo,storeId,s.connections); if(!config.user || !config.password)throw new PlatformError(409,'La publicación requiere credenciales de escritura de WooCommerce');
      const pages=resolved.pages.map(p=>({path:p.path,html:renderDocument(resolved,{path:p.path,origin:config.baseUrl})}));
      const response=await allowlistedFetch(`${config.baseUrl.replace(/\/$/,'')}/wp-json/horizon-platform/v1/releases`,[new URL(config.baseUrl).hostname],{method:'POST',timeoutMs:20000,headers:{Authorization:`Basic ${Buffer.from(`${config.user}:${config.password}`).toString('base64')}`,'Content-Type':'application/json'},body:JSON.stringify({releaseId:`r${revision}-${randomUUID()}`,revision,document:resolved,pages})});
      if(!response.ok)throw new PlatformError(502,`El motor no pudo publicar (${response.status}). La versión anterior sigue disponible.`);
    }
    // Store the resolved artifact separately; editing sources retain their bindings.
    s.repo.db.prepare('INSERT INTO platform_artifacts(store_id,revision,document) VALUES(?,?,?) ON CONFLICT(store_id,revision) DO UPDATE SET document=excluded.document').run(storeId,revision,JSON.stringify(resolved));
    return s.repo.publish(storeId,subject,revision);
  } finally {publishing.delete(storeId);}
}

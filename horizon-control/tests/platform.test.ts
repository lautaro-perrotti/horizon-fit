import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { PlatformRepository } from '../src/platform/repository.js';
import { initialDocument, documentSchema, applyOperations, findNode, variants } from '../src/platform/document.js';
import { renderDocument } from '../src/platform/render.js';
import { dispatchPlatform, type PlatformServices } from '../src/platform/commands.js';
import { runAssistant, type ModelConfig } from '../src/platform/assistant.js';
import { parseCsv, validateImport } from '../src/platform/catalog.js';
import { createPlatformApp } from '../src/platform/app.js';
import { createDb } from '../src/db/client.js';
import { createModelGateway, type ProviderComplete } from '../src/ai/gateway.js';

function studioModel(complete: ProviderComplete, overrides: Partial<ModelConfig> = {}): ModelConfig {
  const { db } = createDb(':memory:');
  return {
    gateway: createModelGateway({ db, openaiKey: 'test-openai', complete: { openai: complete } }),
    model: 'openai:gpt-4o-mini',
    maxTokens: 16000,
    maxIterations: 2,
    ...overrides,
  };
}
let repo: PlatformRepository, services: PlatformServices, storeId: string;
beforeEach(() => { repo = new PlatformRepository(new Database(':memory:')); services = { repo, connections: {} }; storeId = repo.create('alice', 'Casa Sur', 'casa-sur', 'linen').id; });
afterEach(() => repo.db.close());
describe('documento y publicación', () => {
  test('otra marca se crea sin editar el núcleo y publica HTML sin editor', () => { const other = repo.create('bob','Tinta','tinta','ink'); repo.publish(other.id, 'bob', 1); const doc = repo.document(other.id).document; const html = renderDocument(doc); expect(html).toContain('Tinta'); expect(html).not.toContain('<script'); expect(html).toContain('<h1'); expect(html).toContain('name="description"'); });
  test('el borrador no afecta la versión publicada y recuperar crea otra revisión', () => { repo.publish(storeId,'alice',1); const next = repo.patch(storeId,'alice',1,[{op:'node.update',nodeId:'headline',changes:{text:'Nuevo título'}}]); expect(next.revision).toBe(2); expect(repo.publicStore('casa-sur')?.published).toBe(1); expect(repo.document(storeId,1).document.pages[0].blocks[0].nodes[1].text).toBe('Hecho para tu día.'); const restored = repo.save(storeId,'alice',2,repo.document(storeId,1).document,'restaurar'); expect(restored.revision).toBe(3); expect(repo.document(storeId,2).document.pages[0].blocks[0].nodes[1].text).toBe('Nuevo título'); });
  test('rechaza versiones antiguas y no pierde una edición concurrente', () => { repo.patch(storeId,'alice',1,[{op:'node.update',nodeId:'headline',changes:{text:'A'}}]); expect(() => repo.patch(storeId,'alice',1,[{op:'node.update',nodeId:'headline',changes:{text:'B'}}])).toThrow('desactualizado'); expect(() => repo.publish(storeId,'alice',1)).toThrow('cambió'); });
  test('un lote inválido no guarda cambios parciales', () => { expect(() => repo.patch(storeId,'alice',1,[{op:'node.update',nodeId:'headline',changes:{text:'A'}},{op:'node.update',nodeId:'missing',changes:{text:'B'}}])).toThrow(); expect(repo.document(storeId).revision).toBe(1); });
  test('rechaza scripts, URLs ejecutables, IDs duplicados y ciclos', () => { const doc = initialDocument('X'); expect(() => applyOperations(doc,[{op:'node.update',nodeId:'cta',changes:{href:'javascript:alert(1)'}}])).toThrow(); expect(() => documentSchema.parse({...doc, injected:'secret'})).toThrow(); doc.pages[0].blocks[0].nodes[0].parentId = 'headline'; doc.pages[0].blocks[0].nodes[1].parentId = 'eyebrow'; expect(() => documentSchema.parse(doc)).toThrow('Jerarquía'); });
  test('escapa contenido HTML y atributos en la salida publicada', () => { const doc = applyOperations(initialDocument('X'),[{op:'node.update',nodeId:'headline',changes:{text:'<script>alert(1)</script>'}}]); expect(renderDocument(doc)).toContain('&lt;script&gt;'); expect(renderDocument(doc)).not.toContain('<script>'); });
  test('variantes son reproducibles, acotadas y sin llamadas IA', () => { const node = findNode(initialDocument('X'),'headline').node; expect(variants(node, 9)).toEqual(variants(node,9)); expect(variants(node,9,100)).toHaveLength(6); });
});
describe('aislamiento y permisos', () => {
  test.each(['design.get','design.history','assistant.usage','connections.get'])('bloquea lectura ajena %s', async name => { await expect(dispatchPlatform(services,name,{storeId},{subject:'bob'})).rejects.toThrow('acceso'); });
  test('no permite publicar, restaurar ni editar otra tienda', async () => { await expect(dispatchPlatform(services,'design.publish',{storeId,revision:1},{subject:'bob'})).rejects.toThrow('acceso'); await expect(dispatchPlatform(services,'design.restore',{storeId,revision:1,target:1},{subject:'bob'})).rejects.toThrow('acceso'); });
  test('un lector no puede editar', async () => { repo.db.prepare('INSERT INTO platform_members VALUES(?,?,?)').run(storeId,'reader','viewer'); await expect(dispatchPlatform(services,'design.get',{storeId},{subject:'reader'})).resolves.toBeDefined(); await expect(dispatchPlatform(services,'design.publish',{storeId,revision:1},{subject:'reader'})).rejects.toThrow(); });
  test('no se puede vincular el motor de otro comercio', async () => { services.connections = { other: {baseUrl:'https://example.com'} }; services.connectionOwners = {other:'otro'}; await expect(dispatchPlatform(services,'connections.save',{storeId,connection:'other'},{subject:'alice'})).rejects.toThrow('asignada'); });
  test('el límite de diez tiendas se aplica en el servidor', () => { for(let i=0;i<9;i++) repo.create('alice',`Store ${i}`,`store-${i}`,'linen'); expect(()=>repo.create('alice','More','more','linen')).toThrow('diez'); });
});
describe('asistente y presupuesto', () => {
  test('una instrucción común edita el mismo documento con cero tokens', async () => { const result = await runAssistant(repo,'alice',storeId,{prompt:'hacé este título más chico',nodeId:'headline',revision:1}); expect(findNode(result.document,'headline').node.style.fontSize).toBe(72); expect(result.usage.inputTokens).toBe(0); expect(repo.usage(storeId)[0]).toMatchObject({status:'completed'}); });
  test('sin proveedor no finge una respuesta IA y conserva el borrador', async () => { await expect(runAssistant(repo,'alice',storeId,{prompt:'creá una sección editorial',revision:1})).rejects.toThrow('no está conectada'); expect(repo.document(storeId).revision).toBe(1); expect(repo.usage(storeId)[0]).toMatchObject({status:'failed'}); });
  test('el modelo crea bloques estructurados y no recibe todo el catálogo', async () => {
    const complete = vi.fn<ProviderComplete>(async ({ messages }) => {
      expect(JSON.stringify(messages)).not.toContain('password');
      return { text: JSON.stringify({ message: 'Agregué la sección', operations: [{ op: 'block.add', pageId: 'home', block: { id: 'new', name: 'Nueva', type: 'custom', visible: true, nodes: [{ id: 'new-title', tag: 'h2', text: 'Hola' }] } }] }), input_tokens: 300, output_tokens: 100 };
    });
    const result = await runAssistant(repo, 'alice', storeId, { prompt: 'Nueva sección', revision: 1 }, studioModel(complete));
    expect(result.document.pages[0].blocks).toHaveLength(3);
    expect(result.usage.outputTokens).toBe(100);
  });
  test('un presupuesto insuficiente evita la llamada y conserva el borrador', async () => {
    const complete = vi.fn<ProviderComplete>(async () => ({ text: '{}', input_tokens: 1, output_tokens: 1 }));
    await expect(runAssistant(repo, 'alice', storeId, { prompt: 'Nueva sección', revision: 1 }, studioModel(complete, { maxTokens: 100 }))).rejects.toThrow('presupuesto');
    expect(complete).not.toHaveBeenCalled();
    expect(repo.document(storeId).revision).toBe(1);
  });
  test('no puede publicar mediante una salida del modelo', async () => {
    const complete = vi.fn<ProviderComplete>(async () => ({ text: JSON.stringify({ message: 'ok', operations: [{ op: 'design.publish', revision: 1 }] }), input_tokens: 10, output_tokens: 10 }));
    await expect(runAssistant(repo, 'alice', storeId, { prompt: 'publicar', revision: 1 }, studioModel(complete))).rejects.toThrow('válida');
    expect(complete).toHaveBeenCalledTimes(2);
    expect(repo.publicStore('casa-sur')).toBeUndefined();
  });
});
describe('datos', () => {
  test('CSV admite comillas, saltos, BOM y mapeo', () => { expect(parseCsv('\ufeffsku,name\r\na,"Hola, mundo"')[1][1]).toBe('Hola, mundo'); const result=validateImport('codigo,titulo,precio,stock\nA,Remera,123.50,3',{sku:'codigo',name:'titulo',regular_price:'precio',stock_quantity:'stock'}); expect(result.errors).toEqual([]); expect(result.products[0].regular_price).toBe('123.50'); });
  test('rechaza stock vacío, precio inválido, duplicados y archivos vacíos', () => { expect(validateImport('sku,name,regular_price,stock_quantity\nA,X,5,\nA,Y,no,2',{}).errors).toHaveLength(2); expect(validateImport('',{}).errors).toHaveLength(1); expect(validateImport('sku,name,regular_price,stock_quantity\nA,X,5,1\nA,Y,6,2',{}).errors[0].message).toContain('duplicado'); });
});
describe('HTTP y MCP', () => {
  const app = () => createPlatformApp({services,publicUrl:'http://127.0.0.1:8790',issuer:'https://issuer.invalid/',clientId:'client',audience:'platform',development:true,verify:async token=>{if(token!=='alice')throw new Error();return {subject:token};}});
  test('API exige identidad, bloquea origen ajeno y no sirve borradores públicamente', async () => { expect((await app().request('http://127.0.0.1:8790/v1/tools')).status).toBe(401); expect((await app().request('http://127.0.0.1:8790/healthz',{headers:{Origin:'https://evil.test'}})).status).toBe(403); expect((await app().request('http://127.0.0.1:8790/shop/casa-sur/')).status).toBe(404); });
  test('API devuelve 409 ante revisión obsoleta', async () => { repo.patch(storeId,'alice',1,[{op:'node.update',nodeId:'headline',changes:{text:'A'}}]); const response=await app().request('http://127.0.0.1:8790/v1/commands/design.publish',{method:'POST',headers:{Authorization:'Bearer alice','Content-Type':'application/json'},body:JSON.stringify({storeId,revision:1})}); expect(response.status).toBe(409); });
  test('MCP usa el mismo registro y permisos', async () => { const response=await app().request('http://127.0.0.1:8790/mcp',{method:'POST',headers:{Authorization:'Bearer alice','Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'design_get',arguments:{storeId}}})}); expect(response.status).toBe(200); expect(await response.text()).toContain('Casa Sur'); });
});

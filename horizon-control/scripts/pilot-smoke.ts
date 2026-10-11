import fs from 'node:fs';
import Database from 'better-sqlite3';
import { PlatformRepository } from '../src/platform/repository.js';
import { dispatchPlatform, type PlatformServices } from '../src/platform/commands.js';
const manifest=JSON.parse(fs.readFileSync(process.env.PLATFORM_CONNECTIONS_FILE || 'data/pilot/connections.json','utf8'));
const key=process.argv[2] || 'estudio-piloto', connection=manifest[key];if(!connection)throw new Error('Conexión no encontrada');
if(!['127.0.0.1','localhost'].includes(new URL(connection.baseUrl).hostname))throw new Error('Esta prueba solo escribe en el piloto local');
const repo=new PlatformRepository(new Database(':memory:')), services:PlatformServices={repo,connections:manifest,connectionOwners:{[key]:connection.storeSlug}};
const actor={subject:'local-smoke'}, store=repo.create(actor.subject,'Estudio Piloto',connection.storeSlug,'coast');
const call=(name:string,args:any={})=>dispatchPlatform(services,name,{storeId:store.id,...args},actor) as Promise<any>;
try {
  await call('connections.save',{connection:key});
  console.log('Conexión asignada; preparando producto local.');
  const staged=await call('catalog.stage',{products:[{sku:'PILOTO-REMERA-001',name:'Remera de prueba del piloto',regular_price:'12500.00',stock_quantity:5,description:'Producto de validación local. No es una venta.'}]});
  const imported=await call('catalog.publish',{importId:staged.id});const productId=imported.completed[0].id;
  console.log('Producto guardado; publicando documento vinculado.');
  await call('design.patch',{revision:1,operations:[{op:'node.update',nodeId:'headline',changes:{binding:{productId,field:'name'}}},{op:'node.update',nodeId:'cta',changes:{href:'/shop/'}}]});
  await call('design.publish',{revision:2});
  const html=await(await fetch(connection.baseUrl)).text();if(!html.includes('Remera de prueba del piloto'))throw new Error('La publicación no está visible');
  const forbidden=await fetch(connection.baseUrl+'/wp-json/horizon-platform/v1/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(![401,403].includes(forbidden.status))throw new Error('El endpoint de publicación permite acceso anónimo');
  const cart=await fetch(connection.baseUrl+'/wp-json/wc/store/v1/cart');if(!cart.ok)throw new Error('Carrito no disponible');
  const replay=await call('catalog.publish',{importId:staged.id});if(replay.completed[0].id!==productId)throw new Error('La importación se duplicó');
  console.log(JSON.stringify({store:connection.storeSlug,publication:'visible',productId,anonymousPublish:forbidden.status,cart:cart.status,importReplay:'same-product'},null,2));
} finally {repo.db.close();}

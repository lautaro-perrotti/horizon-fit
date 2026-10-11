import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlatformServices } from './commands.js';
import type { Store } from './repository.js';
export function configureProvisioning(s:PlatformServices) {
  if(process.env.PLATFORM_AUTO_PROVISION!=='1')return;
  const source=process.env.PLATFORM_STOREFRONT_REPO;if(!source || !fs.existsSync(path.join(source,'backend/wordpress/wp-content/plugins/horizon-platform-bridge')))throw new Error('PLATFORM_STOREFRONT_REPO debe apuntar al núcleo de la tienda');
  const base=Number(process.env.PLATFORM_PILOT_BASE_PORT||8910);if(!Number.isInteger(base)||base<1024||base>65000)throw new Error('Puerto base inválido');
  const workingDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'), pilotDir=path.resolve(process.env.PLATFORM_PILOT_DIR||path.join(workingDir,'data/pilot'));
  let queue:Promise<void>=Promise.resolve();
  function execute(args:string[]) { return new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','scripts/pilot-ops.ts',...args],{cwd:workingDir,windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,PLATFORM_PILOT_DIR:pilotDir}});let error='';child.stderr.on('data',c=>{error=(error+String(c)).slice(-2000)});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`Aprovisionamiento falló (${code})`)));}); }
  s.provision=(store:Store)=>{
    s.repo.setSettings(store.id,store.owner,{...s.repo.settings(store.id),provisioning:'queued'});
    const task=queue.then(async()=>{
      s.repo.setSettings(store.id,store.owner,{...s.repo.settings(store.id),provisioning:'running'});
      try {
        const stores=s.repo.db.prepare('SELECT id FROM platform_stores ORDER BY created,id').all() as {id:string}[];
        const port=base+stores.findIndex(row=>row.id===store.id);
        if(!fs.existsSync(path.join(pilotDir,store.slug,'manifest.json')))await execute(['prepare',store.slug,String(port)]);
        await execute(['start',store.slug]);
        const connections=JSON.parse(fs.readFileSync(path.join(pilotDir,'connections.json'),'utf8'));s.connections[store.slug]=connections[store.slug];s.connectionOwners ||= {};s.connectionOwners[store.slug]=store.slug;
        s.repo.setSettings(store.id,store.owner,{...s.repo.settings(store.id),connection:store.slug,provisioning:'ready'});
      }catch(error){s.repo.setSettings(store.id,store.owner,{...s.repo.settings(store.id),provisioning:'failed'});throw error;}
    });queue=task.catch(()=>{});return task;
  };
}

/** Local/VPS pilot operator. Tenant IDs are resolved from generated manifests, never shell text. */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
const [action, slug, ...extra] = process.argv.slice(2);
if (!['prepare','start','backup','restore','update'].includes(action) || !/^[a-z][a-z0-9-]{2,40}$/.test(slug || '')) throw new Error('Uso: pilot-ops prepare|start|backup|restore|update slug [argumentos]');
const root=path.resolve(process.env.PLATFORM_PILOT_DIR || 'data/pilot'), dir=path.resolve(root,slug);
if(!dir.startsWith(root+path.sep))throw new Error('Directorio fuera del piloto');
const manifestFile=path.join(dir,'manifest.json');
function docker(args:string[],input?:string|Buffer) { const result=spawnSync('docker',args,{cwd:dir,input,encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true,timeout:300000}); if(result.status!==0)throw new Error(`Docker falló (${result.status}): ${result.stderr.slice(0,500)}`);return result.stdout; }
const manifestSchema=z.object({slug:z.string(),port:z.number().int().min(1024).max(65535),url:z.string().url(),admin:z.string(),password:z.string(),dbPassword:z.string(),image:z.string(),version:z.literal(1)});
if(action==='prepare') {
  if(fs.existsSync(manifestFile))throw new Error('La tienda ya fue preparada');
  const port=Number(extra[0]);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Indicá un puerto libre entre 1024 y 65535');
  const source=path.resolve(process.env.PLATFORM_STOREFRONT_REPO || '../../horizon-fit');
  const bridge=path.join(source,'backend/wordpress/wp-content/plugins/horizon-platform-bridge');
  const woo=path.join(source,'backend/wordpress/wp-content/plugins/woocommerce');
  if(!fs.existsSync(bridge)||!fs.existsSync(woo))throw new Error('Configurá PLATFORM_STOREFRONT_REPO con el repositorio de la tienda');
  const manifest=manifestSchema.parse({slug,port,url:extra[1] || `http://127.0.0.1:${port}`,admin:'platform-admin',password:randomBytes(24).toString('base64url'),dbPassword:randomBytes(24).toString('base64url'),image:'wordpress:6.9.4-php8.2-apache',version:1});
  fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(path.join(dir,'plugins'),{recursive:true});
  fs.cpSync(bridge,path.join(dir,'plugins/horizon-platform-bridge'),{recursive:true});fs.cpSync(woo,path.join(dir,'plugins/woocommerce'),{recursive:true});
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2),{mode:0o600});
  // JSON is valid Compose YAML and avoids quoting/interpolation of arbitrary shell fragments.
  const compose={name:`horizon-${slug}`,services:{
    db:{image:'mariadb:10.6',restart:'unless-stopped',environment:{MARIADB_DATABASE:'store',MARIADB_USER:'store',MARIADB_PASSWORD:manifest.dbPassword,MARIADB_ROOT_PASSWORD:randomBytes(24).toString('base64url')},volumes:['database:/var/lib/mysql'],healthcheck:{test:['CMD','healthcheck.sh','--connect','--innodb_initialized'],interval:'5s',timeout:'5s',retries:20}},
    wordpress:{image:manifest.image,restart:'unless-stopped',ports:[`127.0.0.1:${port}:80`],depends_on:{db:{condition:'service_healthy'}},environment:{WORDPRESS_DB_HOST:'db',WORDPRESS_DB_NAME:'store',WORDPRESS_DB_USER:'store',WORDPRESS_DB_PASSWORD:manifest.dbPassword,WORDPRESS_CONFIG_EXTRA:"define('WP_ENVIRONMENT_TYPE', 'local');"},volumes:['wordpress:/var/www/html','./plugins:/var/www/html/wp-content/plugins']},
    cli:{image:'wordpress:cli-php8.2',profiles:['tools'],user:'33:33',environment:{WORDPRESS_DB_HOST:'db',WORDPRESS_DB_NAME:'store',WORDPRESS_DB_USER:'store',WORDPRESS_DB_PASSWORD:manifest.dbPassword},volumes:['wordpress:/var/www/html','./plugins:/var/www/html/wp-content/plugins'],entrypoint:['wp']},
  },volumes:{database:{},wordpress:{}}};
  fs.writeFileSync(path.join(dir,'compose.json'),JSON.stringify(compose,null,2),{mode:0o600});console.log(`Preparado ${slug}. Archivos privados en ${dir}. Ejecutá start para levantarlo.`);
} else {
  const m=manifestSchema.parse(JSON.parse(fs.readFileSync(manifestFile,'utf8')));if(m.slug!==slug)throw new Error('El manifiesto no coincide con la tienda');
  const compose=['compose','-f','compose.json'];
  const wp=(args:string[])=>docker([...compose,'run','--rm','cli',...args]);
  if(action==='start') {
    docker([...compose,'up','-d','--wait','db','wordpress']);
    let installed=false;try{wp(['core','is-installed']);installed=true}catch{};
    if(!installed) wp(['core','install',`--url=${m.url}`,`--title=${slug}`,`--admin_user=${m.admin}`,`--admin_password=${m.password}`,`--admin_email=owner@${slug}.invalid`,'--skip-email']);
    wp(['plugin','activate','woocommerce','horizon-platform-bridge']);wp(['option','update','woocommerce_currency','ARS']);wp(['option','update','woocommerce_default_country','AR']);
    wp(['eval','WC_Install::create_pages();']);wp(['rewrite','structure','/%postname%/','--hard']);
    const appPassword=wp(['user','application-password','create',m.admin,'Horizon Platform','--porcelain']).trim();
    const connectionFile=path.join(root,'connections.json');const connections=fs.existsSync(connectionFile)?JSON.parse(fs.readFileSync(connectionFile,'utf8')):{};
    connections[slug]={baseUrl:m.url,user:m.admin,password:appPassword,storeSlug:slug};fs.writeFileSync(connectionFile,JSON.stringify(connections,null,2),{mode:0o600});
    console.log(`Tienda iniciada: ${m.url}. Configurá PLATFORM_CONNECTIONS_FILE=${connectionFile}.`);
  }
  if(action==='backup') {
    const backup=path.join(dir,'backups',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(backup,{recursive:true});
    const sql=docker([...compose,'exec','-T','db','sh','-c','exec mariadb-dump -u store -p"$MARIADB_PASSWORD" --single-transaction store']);fs.writeFileSync(path.join(backup,'database.sql'),sql,{mode:0o600});
    docker([...compose,'exec','-T','wordpress','tar','czf','/tmp/horizon-uploads.tar.gz','-C','/var/www/html/wp-content','uploads']);docker([...compose,'cp','wordpress:/tmp/horizon-uploads.tar.gz',path.join(backup,'uploads.tar.gz')]);
    fs.copyFileSync(manifestFile,path.join(backup,'manifest.json'));fs.copyFileSync(path.join(dir,'compose.json'),path.join(backup,'compose.json'));console.log(`Backup guardado: ${backup}`);
  }
  if(action==='restore') {
    const backup=path.resolve(extra[0] || '');if(!backup.startsWith(path.join(dir,'backups')+path.sep)||!fs.existsSync(path.join(backup,'database.sql')))throw new Error('Elegí un backup dentro de esta tienda');
    if(extra[1]!=='--replace-current')throw new Error('Restaurar reemplaza la base de esta tienda. Repetí con --replace-current.');
    docker([...compose,'stop','wordpress']);
    try {docker([...compose,'exec','-T','db','sh','-c','exec mariadb -u store -p"$MARIADB_PASSWORD" store'],fs.readFileSync(path.join(backup,'database.sql')));docker([...compose,'cp',path.join(backup,'uploads.tar.gz'),'wordpress:/tmp/horizon-uploads.tar.gz']);docker([...compose,'start','wordpress']);docker([...compose,'exec','-T','wordpress','tar','xzf','/tmp/horizon-uploads.tar.gz','-C','/var/www/html/wp-content']);}finally{docker([...compose,'start','wordpress']);}console.log('Base y uploads restaurados.');
  }
  if(action==='update') {
    const image=extra[0];if(!/^wordpress:\d+\.\d+\.\d+-php\d+\.\d+-apache$/.test(image||''))throw new Error('Indicá una imagen WordPress con versión exacta');
    const composeFile=path.join(dir,'compose.json'),config=JSON.parse(fs.readFileSync(composeFile,'utf8'));fs.copyFileSync(composeFile,composeFile+'.previous');config.services.wordpress.image=image;fs.writeFileSync(composeFile,JSON.stringify(config,null,2));
    try{docker([...compose,'up','-d','--wait','wordpress']);wp(['core','update-db']);console.log('Imagen actualizada. Validá checkout antes de actualizar otra tienda.');}catch(error){fs.copyFileSync(composeFile+'.previous',composeFile);docker([...compose,'up','-d','wordpress']);throw error;}
  }
}

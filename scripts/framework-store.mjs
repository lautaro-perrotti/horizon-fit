import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [action,configPath]=process.argv.slice(2);
if(!['build','refresh','backup','start','rebuild','status','stop','reset','seed','doctor'].includes(action)||!configPath)throw new Error('Uso: node scripts/framework-store.mjs build|refresh|backup|start|rebuild|status|stop|reset|seed|doctor framework/store.json');
function assertLocal(){for(const key of ['storefrontUrl','apiUrl']){const host=new URL(config[key]).hostname;if(!['127.0.0.1','localhost'].includes(host))throw new Error(`${action} solo corre contra una instancia local`);}}
const config=JSON.parse(fs.readFileSync(path.resolve(configPath),'utf8'));
if(!/^[a-z][a-z0-9-]{2,40}$/.test(config.slug||'')||typeof config.name!=='string'||!config.name.trim()||config.name.length>100)throw new Error('slug o nombre inválido');
for(const key of ['storefrontUrl','apiUrl']){const url=new URL(config[key]);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error(`${key} debe ser un origen HTTP(S)`);config[key]=url.origin;}
for(const port of Object.values(config.ports||{}))if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Puertos inválidos');
if(!config.ports?.api||!config.ports?.storefront||config.ports.api===config.ports.storefront)throw new Error('Indicá dos puertos distintos');
if(config.tracking?.ga4Id&&!/^G-[A-Z0-9]+$/.test(config.tracking.ga4Id))throw new Error('ID GA4 inválido');
if(config.tracking?.googleAdsId&&!/^AW-\d+$/.test(config.tracking.googleAdsId))throw new Error('ID Google Ads inválido');
if(config.tracking?.metaPixelId&&!/^\d{6,30}$/.test(config.tracking.metaPixelId))throw new Error('ID Meta Pixel inválido');
const instances=path.join(root,'framework/instances'),dir=path.resolve(instances,config.slug);
if(!dir.startsWith(instances+path.sep))throw new Error('Destino inválido');
const docker=(args,input)=>{const r=spawnSync('docker',['compose','-f','compose.json',...args],{cwd:dir,input,encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(`Docker: ${r.stderr?.slice(-1200)||r.error?.message}`);return r.stdout};
const wp=args=>docker(['run','--rm','cli',...args]);
function backup() {
  const destination=path.join(dir,'backups',new Date().toISOString().replace(/[:.]/g,'-'));
  fs.mkdirSync(destination,{recursive:true});
  for(const name of ['.env','store.json','compose.json','nginx.conf','api.conf','wordpress-entrypoint.sh','VERSION','public','plugins','mu-plugins']) fs.cpSync(path.join(dir,name),path.join(destination,name),{recursive:true});
  for(const [name,args] of [
    ['database.sql',['exec','-T','db','sh','-c','exec mariadb-dump --single-transaction -u "$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"']],
    ['uploads.tar.gz',['exec','-T','wordpress','tar','-czf','-','-C','/var/www/html/wp-content','uploads']],
  ]) {
    const fd=fs.openSync(path.join(destination,name),'w',0o600);
    try {const result=spawnSync('docker',['compose','-f','compose.json',...args],{cwd:dir,stdio:['ignore',fd,'pipe'],windowsHide:true,timeout:300000});if(result.status!==0)throw new Error(`Falló backup ${name}`);} finally{fs.closeSync(fd);}
  }
  fs.writeFileSync(path.join(destination,'COMPLETE'),new Date().toISOString());console.log(`Backup privado: ${destination}`);return destination;
}
if(action==='build'||action==='refresh'){
  if(action==='build'&&fs.existsSync(path.join(dir,'compose.json')))throw new Error('La instancia ya existe. Usá refresh para actualizar con backup previo.');
  if(action==='refresh'){if(!fs.existsSync(path.join(dir,'compose.json')))throw new Error('La instancia no existe');backup();}
  fs.mkdirSync(dir,{recursive:true});
  for(const name of ['design-system','assets','LOGOS','TIPOGRAFIAS'])fs.cpSync(path.join(root,name),path.join(dir,'public',name),{recursive:true});
  fs.copyFileSync(path.join(root,'favicon.ico'),path.join(dir,'public/favicon.ico'));
  const publicConfig={email:config.email||'',socialUrls:config.socialUrls||[],name:config.name,tagline:config.tagline||config.name,storefrontOrigin:config.storefrontUrl,apiOrigin:config.apiUrl,whatsappUrl:config.whatsappUrl||'',seoTitle:config.seo?.title||config.name,seoDescription:config.seo?.description||'',trackingEnabled:config.tracking?.enabled===true,ga4Id:config.tracking?.ga4Id||'',googleAdsId:config.tracking?.googleAdsId||'',googleAdsPurchaseLabel:config.tracking?.googleAdsPurchaseLabel||'',metaPixelId:config.tracking?.metaPixelId||''};
  publicConfig.social=config.social||{};publicConfig.setDiscountPercent=config.payments?.setDiscountPercent||0;
  const bootstrap=JSON.stringify(publicConfig).replace(/</g,'\\u003c');
  const version=fs.readFileSync(path.join(root,'framework/VERSION'),'utf8').trim();
  let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<head>',`<head>\n<script>window.HF_STOREFRONT_CONFIG=${bootstrap};</script>`);
  html=html.replace(/horizonfit\.com\.ar/g,new URL(config.storefrontUrl).hostname).replaceAll('Horizon Fit',config.name.replace(/</g,'&lt;').replace(/>/g,'&gt;'));
  // Build-specific asset fingerprints prevent cross-release stale JavaScript.
  html=html.replace(/(src|href)="(\/design-system\/[^"?]+)(?:\?[^\"]*)?"/g,(_,attr,url)=>{const asset=path.join(dir,'public',url);const hash=fs.existsSync(asset)?createHash('sha256').update(fs.readFileSync(asset)).digest('hex').slice(0,12):version;return `${attr}="${url}?v=${hash}"`});
  fs.writeFileSync(path.join(dir,'public/index.html'),html);
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  fs.writeFileSync(path.join(dir,'public/design-system/components/sections/framework-hero.html'),`<section class="container" style="padding:100px 5%;min-height:50vh"><p>${escape(config.name)}</p><h1 style="font-size:clamp(36px,6vw,80px)">${escape(config.tagline||config.name)}</h1><p>${escape(config.seo?.description||'')}</p><a href="/coleccion/">Ver productos →</a></section>`);
  const home=JSON.parse(fs.readFileSync(path.join(root,'design-system/pages/home.json'),'utf8'));
  home.sections=home.sections.filter(s=>['navbar','hero','featured-products','footer'].includes(s.id));
  for(const section of home.sections){if(section.id==='hero'){section.type='framework-hero';section.component='design-system/components/sections/framework-hero.html';delete section.config;}if(section.id==='featured-products')section.config={title:'Nuestros productos',limit:12};}
  fs.writeFileSync(path.join(dir,'public/design-system/pages/home.json'),JSON.stringify(home));
  for(const file of ['featured-products.json','pdp-sets.json'])fs.writeFileSync(path.join(dir,'public/design-system/data',file),'[]');
  fs.mkdirSync(path.join(dir,'plugins'),{recursive:true});
  for(const name of ['woocommerce','horizon-fit-commerce','payway-woocommerce']){const source=path.join(root,'backend/wordpress/wp-content/plugins',name);if(fs.existsSync(source))fs.cpSync(source,path.join(dir,'plugins',name),{recursive:true});}
  fs.mkdirSync(path.join(dir,'mu-plugins/config'),{recursive:true});
  for(const name of ['00-horizon-framework.php','horizon-fit-search-commerce.php'])fs.copyFileSync(path.join(root,'backend/wordpress/wp-content/mu-plugins',name),path.join(dir,'mu-plugins',name));
  fs.cpSync(path.join(root,'backend/wordpress/wp-content/mu-plugins/horizon-framework'),path.join(dir,'mu-plugins/horizon-framework'),{recursive:true});
  fs.cpSync(path.join(root,'backend/wordpress/wp-content/mu-plugins/config'),path.join(dir,'mu-plugins/config'),{recursive:true});
  fs.writeFileSync(path.join(dir,'store.json'),JSON.stringify(config,null,2));
  const dbPassword=randomBytes(24).toString('base64url'),adminPassword=randomBytes(24).toString('base64url');
  if(!fs.existsSync(path.join(dir,'.env')))fs.writeFileSync(path.join(dir,'.env'),`DB_PASSWORD=${dbPassword}\nADMIN_PASSWORD=${adminPassword}\nHF_CACHE_WEBHOOK_SECRET=${randomBytes(32).toString('base64url')}\nHF_META_CAPI_ACCESS_TOKEN=\nHF_META_TEST_EVENT_CODE=\n`,{mode:0o600});
  const env={WORDPRESS_DB_HOST:'db',WORDPRESS_DB_NAME:'store',WORDPRESS_DB_USER:'store',WORDPRESS_DB_PASSWORD:'${DB_PASSWORD}',HF_API_URL:config.apiUrl,HF_FRAMEWORK_CONFIG_FILE:'/store.json',HF_STOREFRONT_TEMPLATE_PATH:'/public/index.html',HF_ENABLE_VISIBLE_BODY_PRERENDER:'1',HF_FRONTEND_HOST:new URL(config.storefrontUrl).host,HF_FRONTEND_SCHEME:new URL(config.storefrontUrl).protocol.slice(0,-1),HF_CACHE_WEBHOOK_SECRET:'${HF_CACHE_WEBHOOK_SECRET}',HF_META_CAPI_ACCESS_TOKEN:'${HF_META_CAPI_ACCESS_TOKEN}',HF_META_TEST_EVENT_CODE:'${HF_META_TEST_EVENT_CODE}',WORDPRESS_CONFIG_EXTRA:"define('WP_HOME',getenv('HF_API_URL')); define('WP_SITEURL',getenv('HF_API_URL')); define('WP_ENVIRONMENT_TYPE','local'); define('DISABLE_WP_CRON',true);"};
  const volumes=['wordpress:/var/www/html','./plugins:/var/www/html/wp-content/plugins','./mu-plugins:/var/www/html/wp-content/mu-plugins:ro','./store.json:/store.json:ro','./public:/public:ro'];
  env.WORDPRESS_CONFIG_EXTRA = env.WORDPRESS_CONFIG_EXTRA.replace("'local'", new URL(config.apiUrl).protocol === 'https:' ? "'production'" : "'local'");
  fs.writeFileSync(path.join(dir,'wordpress-entrypoint.sh'),'#!/bin/sh\nset -eu\na2enmod headers rewrite expires deflate >/dev/null\nexec docker-entrypoint.sh apache2-foreground\n');
  fs.writeFileSync(path.join(dir,'api.conf'),`<VirtualHost *:80>\nDocumentRoot /var/www/html\n<Directory /var/www/html>\nAllowOverride All\nRequire all granted\n</Directory>\n<IfModule mod_headers.c>\nHeader always set Access-Control-Allow-Origin "${config.storefrontUrl}"\nHeader always set Access-Control-Allow-Credentials "true"\nHeader always set Access-Control-Allow-Headers "Content-Type, Authorization, Nonce, Cart-Token, X-WP-Nonce, X-HF-Signature, X-HF-Timestamp, X-HF-Delivery-Id, X-HF-Event"\nHeader always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"\nHeader always set Access-Control-Expose-Headers "Nonce, Cart-Token"\n</IfModule>\n</VirtualHost>`);
  fs.writeFileSync(path.join(dir,'nginx.conf'),`server {\nlisten 80; server_name _; root /public; index index.html; gzip on; gzip_types application/json application/javascript text/css image/svg+xml;\nlocation = /healthz {return 200 'ok';}\nlocation = /sitemap.xml {alias /wp/wp-content/uploads/horizon-fit-seo/sitemap.xml;}\nlocation = /robots.txt { default_type text/plain; return 200 "User-agent: *\\nAllow: /\\nDisallow: /checkout/\\nDisallow: /mi-cuenta/\\nSitemap: ${config.storefrontUrl}/sitemap.xml\\n";}\nlocation ~ \\.(js|css|woff2?|ttf|otf|jpg|jpeg|png|webp|svg|mp4|ico)$ { try_files $uri =404; expires 1y; add_header Cache-Control 'public, immutable'; }\nlocation / {root /wp/wp-content/uploads/horizon-fit-seo;try_files $uri/index.html $uri @spa; add_header Cache-Control 'no-cache';}\nlocation @spa {root /public; try_files $uri $uri/ /index.html;}\n}\n`);
  const compose={name:`hf-framework-${config.slug}`,services:{
    db:{image:'mariadb:10.6',restart:'unless-stopped',environment:{MARIADB_DATABASE:'store',MARIADB_USER:'store',MARIADB_PASSWORD:'${DB_PASSWORD}',MARIADB_RANDOM_ROOT_PASSWORD:'1'},volumes:['database:/var/lib/mysql'],healthcheck:{test:['CMD','healthcheck.sh','--connect','--innodb_initialized'],interval:'5s',timeout:'5s',retries:20}},
    wordpress:{image:'wordpress:6.9.4-php8.2-apache',restart:'unless-stopped',depends_on:{db:{condition:'service_healthy'}},environment:env,ports:[`127.0.0.1:${config.ports.api}:80`],volumes:[...volumes,'./api.conf:/etc/apache2/sites-available/000-default.conf:ro','./wordpress-entrypoint.sh:/framework-entrypoint.sh:ro'],entrypoint:['sh','/framework-entrypoint.sh'],healthcheck:{test:['CMD','php','-r',"exit(is_file('/var/www/html/wp-config.php') && str_contains(file_get_contents('/var/www/html/wp-config.php'),'wp-settings.php') ? 0 : 1);"],interval:'3s',timeout:'3s',retries:30}},
    storefront:{image:'nginx:1.27-alpine',restart:'unless-stopped',ports:[`127.0.0.1:${config.ports.storefront}:80`],volumes:['./public:/public:ro','wordpress:/wp:ro','./nginx.conf:/etc/nginx/conf.d/default.conf:ro']},
    cli:{image:'wordpress:cli-php8.2',profiles:['tools'],user:'33:33',environment:env,volumes,entrypoint:['wp']},
    cron:{image:'wordpress:cli-php8.2',restart:'unless-stopped',user:'33:33',environment:env,volumes,entrypoint:['sh','-c','while true; do wp cron event run --due-now --quiet; sleep 15; done'],depends_on:{wordpress:{condition:'service_healthy'}}},
  },volumes:{wordpress:{},database:{}}};
  fs.writeFileSync(path.join(dir,'compose.json'),JSON.stringify(compose,null,2));fs.writeFileSync(path.join(dir,'VERSION'),version);console.log(`Framework ${version} generado: ${dir}`);
}
function envPresent(name){const env=fs.existsSync(path.join(dir,'.env'))?fs.readFileSync(path.join(dir,'.env'),'utf8'):'';const match=env.match(new RegExp('^'+name+'=(.*)$','m'));return Boolean(match&&match[1].trim());}
function startStore(){
  docker(['up','-d','--wait','db','wordpress','storefront']);let installed=false;try{wp(['core','is-installed']);installed=true}catch{}
  if(!installed){const env=fs.readFileSync(path.join(dir,'.env'),'utf8'),password=env.match(/^ADMIN_PASSWORD=(.+)$/m)?.[1];wp(['core','install',`--url=${config.apiUrl}`,`--title=${config.name}`,'--admin_user=platform-admin',`--admin_password=${password}`,`--admin_email=${config.email||'owner@example.com'}`,'--skip-email']);}
  wp(['plugin','activate','woocommerce','horizon-fit-commerce']);wp(['horizon','framework','init']);wp(['rewrite','structure','/%postname%/','--hard']);docker(['up','-d','cron']);
}
function seedCatalog(){
  assertLocal();
  wp(['eval',`$items=array(array('sku'=>'FRAMEWORK-SEED-1','name'=>'Producto de ejemplo 1','price'=>'4500'),array('sku'=>'FRAMEWORK-SEED-2','name'=>'Producto de ejemplo 2','price'=>'8900'));foreach($items as $item){$id=wc_get_product_id_by_sku($item['sku']);$p=$id?wc_get_product($id):new WC_Product_Simple();$p->set_name($item['name']);$p->set_slug(sanitize_title($item['name']));$p->set_sku($item['sku']);$p->set_regular_price($item['price']);$p->set_manage_stock(true);$p->set_stock_quantity(10);$p->set_status('publish');$p->save();}if(function_exists('hf_framework_rebuild'))hf_framework_rebuild();echo 'seeded';`]);
  console.log('Catálogo de ejemplo listo (2 productos genéricos).');
}
function doctor(){
  const tracking=config.tracking||{};
  const enabled=tracking.enabled===true;
  const report={store:config.name,slug:config.slug,origin:config.storefrontUrl,production:false,tracking:{
    ga4:{configured:Boolean(enabled&&tracking.ga4Id),verified:false},
    googleAds:{configured:Boolean(enabled&&tracking.googleAdsId),verified:false},
    metaPixel:{configured:Boolean(enabled&&tracking.metaPixelId),verified:false},
    metaCapi:{configured:Boolean(enabled&&tracking.metaPixelId&&envPresent('HF_META_CAPI_ACCESS_TOKEN')),verified:false},
  },secrets:{webhook:envPresent('HF_CACHE_WEBHOOK_SECRET'),metaCapi:envPresent('HF_META_CAPI_ACCESS_TOKEN'),dbPassword:envPresent('DB_PASSWORD')},note:'configured is not connected. verified stays false until a live credential check.'};
  const serialized=JSON.stringify(report);
  if(/HF_CACHE_WEBHOOK_SECRET|ck_|cs_|EAAG|ya29/.test(serialized))throw new Error('Doctor refused to print a credential-shaped value');
  fs.mkdirSync(path.join(root,'reports'),{recursive:true});
  fs.writeFileSync(path.join(root,`reports/framework-doctor-${config.slug}.json`),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
if(action==='backup') {backup();
} else if(action==='start') {startStore();console.log(`Storefront: ${config.storefrontUrl}\nWooCommerce: ${config.apiUrl}/wp-admin\nCredenciales locales: ${path.join(dir,'.env')}`);
} else if(action==='reset') {assertLocal();if(!fs.existsSync(path.join(dir,'compose.json')))throw new Error('La instancia no existe');docker(['down','-v','--remove-orphans']);startStore();seedCatalog();console.log(`Instancia local reiniciada: ${config.storefrontUrl}`);
} else if(action==='seed') {seedCatalog();
} else if(action==='doctor') {doctor();
} else if(action==='rebuild') console.log(wp(['horizon','cache','rebuild']));
else if(action==='status')console.log(docker(['ps']));
else if(action==='stop')console.log(docker(['stop']));

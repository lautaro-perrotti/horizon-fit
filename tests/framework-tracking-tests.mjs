import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../design-system/js/ga4.js',import.meta.url),'utf8');
function tracker(config){const storage=new Map(),scripts=[];const window={HF_STOREFRONT_CONFIG:config,location:{hostname:'shop.example',search:''},dataLayer:[],sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},localStorage:{getItem:()=>null}};const document={querySelector:()=>null,createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}};vm.runInNewContext(source,{window,document,URL,console});return{window,scripts};}
const disabled=tracker({name:'Brand',storefrontOrigin:'https://shop.example',trackingEnabled:false,ga4Id:'',googleAdsId:''});assert.equal(disabled.scripts.length,0,'unconfigured store must not load Horizon analytics');
const active=tracker({name:'Brand',storefrontOrigin:'https://shop.example',trackingEnabled:true,ga4Id:'G-EXAMPLE',googleAdsId:'AW-123456',googleAdsPurchaseLabel:'label'});
assert.equal(active.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id=G-EXAMPLE');
const purchase={orderId:42,orderNumber:'42',order:{items:[],totals:{total_price:'150000',currency_code:'ARS',currency_minor_unit:2}}};active.window.hfGa4.purchase(purchase);active.window.hfGa4.purchase(purchase);
const events=active.window.dataLayer.map(args=>Array.from(args));assert.equal(events.filter(e=>e[1]==='purchase').length,1,'purchase deduplicated');const ads=events.filter(e=>e[1]==='conversion');assert.equal(ads.length,1,'ads conversion deduplicated');assert.equal(ads[0][2].send_to,'AW-123456/label');assert.equal(ads[0][2].value,1500);assert.equal(ads[0][2].transaction_id,'42');
assert.ok(!JSON.stringify(events).includes('G-8TL56B3B8X'),'no original store measurement ID');console.log('OK per-store GA4 + Google Ads + purchase deduplication; no network calls');

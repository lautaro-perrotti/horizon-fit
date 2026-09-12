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
assert.ok(!JSON.stringify(events).includes('G-8TL56B3B8X'),'no original store measurement ID');
const example=JSON.parse(fs.readFileSync(new URL('../framework/store.example.json',import.meta.url),'utf8'));
const isolated=tracker({
  name:example.name,
  storefrontOrigin:example.storefrontUrl,
  trackingEnabled:example.tracking.enabled,
  ga4Id:example.tracking.ga4Id,
  googleAdsId:example.tracking.googleAdsId,
  googleAdsPurchaseLabel:example.tracking.googleAdsPurchaseLabel,
  metaPixelId:example.tracking.metaPixelId,
  whatsappUrl:example.whatsappUrl,
  social:example.social,
  payments:example.payments,
});
assert.equal(isolated.scripts.length,0,'Casa Sur must not load Horizon analytics');
assert.ok(!JSON.stringify(isolated.window.HF_STOREFRONT_CONFIG).includes('horizonfit'));
assert.ok(!JSON.stringify(isolated.window.HF_STOREFRONT_CONFIG).includes('G-8TL56B3B8X'));
assert.ok(!JSON.stringify(isolated.window.HF_STOREFRONT_CONFIG).includes('541131150999'));
assert.equal(isolated.window.HF_STOREFRONT_CONFIG.payments.installments.length,0);
console.log('OK per-store GA4 + Google Ads + purchase deduplication; Casa Sur loads no Horizon tracking');

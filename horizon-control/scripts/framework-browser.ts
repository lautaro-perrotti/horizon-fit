import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin=process.env.FRAMEWORK_URL||'http://127.0.0.1:8920';
const browser=await chromium.launch({channel:'chrome'});
const report:any={origin,profile:'Chrome; local network; no CPU throttling',at:new Date().toISOString(),pages:[]};
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390});
  for(const route of ['/','/producto/producto-de-prueba-reutilizable/','/coleccion/','/checkout/']) {
   const page=await context.newPage(),errors:string[]=[],requests:string[]=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
   await page.addInitScript(()=>{(window as any).__perf={lcp:0,cls:0};new PerformanceObserver(list=>{for(const e of list.getEntries())(window as any).__perf.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries() as any[])if(!e.hadRecentInput)(window as any).__perf.cls+=e.value}).observe({type:'layout-shift',buffered:true});});
   const response=await page.goto(origin+route,{waitUntil:'domcontentloaded'});assert.equal(response?.status(),200);
   await page.waitForFunction(()=>document.documentElement.dataset.pageBuilderReady==='true',null,{timeout:30000});
   await page.waitForTimeout(1500);
   const metrics=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;return {title:document.title,h1:document.querySelector('h1')?.textContent,ttfb:n.responseStart-n.requestStart,...(window as any).__perf,overflow:document.documentElement.scrollWidth>innerWidth+1,text:document.body.innerText}});
   assert.deepEqual(errors,[],`${width} ${route}`);
   assert.ok(!requests.some(url=>/horizonfit\.com\.ar|\/editor\/|react-dom/.test(url)),'No requests to original store or editor');
   assert.ok(!metrics.text.includes('Horizon Fit'),'No inherited brand in visible content');
   assert.ok(!metrics.overflow,`Horizontal overflow: ${width} ${route}`);
   const {text,...summary}=metrics;report.pages.push({width,route,...summary,requests:requests.length});
   if(route==='/') {fs.mkdirSync('reports',{recursive:true});await page.screenshot({path:`reports/framework-${width}.png`,fullPage:true});}
   await page.close();
  }await context.close();
 }
}finally{await browser.close();fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/framework-browser.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));

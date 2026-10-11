import { chromium } from '@playwright/test';
import fs from 'node:fs';
const origin = process.env.BASELINE_URL || 'http://127.0.0.1:8088';
const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2});
const report:any = {origin,at:new Date().toISOString(),profile:'mobile viewport; local network; no CPU throttling',routes:[]};
for(const route of ['/','/coleccion/','/checkout/']) {
  const page = await context.newPage();
  await page.addInitScript(()=>{ (window as any).__perf={cls:0,lcp:0}; new PerformanceObserver(list=>{for(const entry of list.getEntries() as any[])if(!entry.hadRecentInput)(window as any).__perf.cls+=entry.value}).observe({type:'layout-shift',buffered:true}); new PerformanceObserver(list=>{for(const entry of list.getEntries())(window as any).__perf.lcp=entry.startTime}).observe({type:'largest-contentful-paint',buffered:true}); });
  try { const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:20000}); await page.waitForFunction(()=>['true','error'].includes(document.documentElement.dataset.pageBuilderReady || ''),{},{timeout:20000}).catch(()=>{});
    report.routes.push({route,status:response?.status(),...(await page.evaluate(()=>{const nav=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming; return {ttfb:nav.responseStart-nav.requestStart,domContentLoaded:nav.domContentLoadedEventEnd,ready:document.documentElement.dataset.pageBuilderReady || 'not-reported',...((window as any).__perf),transferred:performance.getEntriesByType('resource').reduce((sum,e)=>sum+(e as PerformanceResourceTiming).transferSize,0),title:document.title}}))});
  } catch(error) {report.routes.push({route,error:String(error)});} finally {await page.close();}
}
await browser.close();fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/storefront-baseline.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

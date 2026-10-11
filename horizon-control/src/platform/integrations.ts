import { createAnalyticsAdapter } from '../adapters/analytics.js';
import { createCommerceAdapter } from '../adapters/commerce.js';
import { connectionFor } from './catalog.js';
import type { PlatformServices } from './commands.js';
export async function integrationReport(s:PlatformServices,storeId:string,source:'ga4'|'searchConsole'|'sales') {
  const config=connectionFor(s.repo,storeId,s.connections);
  if(source==='sales') {
    const adapter=createCommerceAdapter({baseUrl:config.baseUrl,storefrontUrl:config.baseUrl,user:config.user,appPassword:config.password,extraHosts:[new URL(config.baseUrl).hostname]});
    return {...await adapter.sales(),store_id:storeId};
  }
  const site=config.gscSiteUrl || config.baseUrl;
  const adapter=createAnalyticsAdapter({saPath:config.googleServiceAccountPath,ga4PropertyId:config.ga4PropertyId,gscSiteUrl:site,allowedGscSites:[site]});
  return {...await adapter[source](),store_id:storeId};
}

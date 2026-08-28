import { createDb } from "./db/client.js";
import { extraAllowedHosts } from "./http/allowlist.js";
import { loadConfig, type Config } from "./config.js";
import { createResourceServer, type ResourceServerOptions } from "./auth/resource-server.js";
import { createCatalogAdapter, type CatalogAdapter } from "./adapters/woo.js";
import { createCommerceAdapter, type CommerceAdapter } from "./adapters/commerce.js";
import { createWarehouse, type Warehouse } from "./adapters/warehouse.js";
import { createAssistantAdapter } from "./adapters/assistant.js";
import { createSeoReportAdapter, type SeoReportAdapter } from "./adapters/seo-report.js";
import { createAnalyticsAdapter, type AnalyticsAdapter } from "./adapters/analytics.js";
import { createCompetitorsAdapter, parseCompetitorUrls, type CompetitorsAdapter } from "./adapters/competitors.js";
import { createStorefrontAdapter, type StorefrontAdapter } from "./adapters/storefront.js";
import { createMerchantAdapter, type MerchantAdapter } from "./adapters/merchant.js";
import { createHealthAdapter } from "./adapters/health.js";
import { createGitAdapter, type GitAdapter } from "./adapters/git.js";
import { createGithubAdapter } from "./adapters/github.js";
import { createAuditLog } from "./audit/log.js";
import { createJobQueue } from "./jobs/queue.js";
import { createDefaultJobRunner, startJobWorker, type JobRunner } from "./jobs/runner.js";
import type { AppServices } from "./app-context.js";

export type CreateServicesOptions = {
  config?: Config;
  env?: Record<string, string | number | undefined>;
  jwks?: ResourceServerOptions["jwks"];
  clockToleranceSec?: number;
  catalog?: CatalogAdapter;
  woo?: CatalogAdapter;
  commerce?: CommerceAdapter;
  warehouse?: Warehouse;
  seo?: SeoReportAdapter;
  analytics?: AnalyticsAdapter;
  competitors?: CompetitorsAdapter;
  storefront?: StorefrontAdapter;
  merchant?: MerchantAdapter;
  git?: GitAdapter;
  runner?: JobRunner;
  fetchImpl?: typeof fetch;
  sqlitePath?: string;
  startWorker?: boolean;
};

export function createServices(options: CreateServicesOptions = {}): AppServices {
  const config = options.config ?? loadConfig(options.env);
  const { db, sqlite } = createDb(options.sqlitePath ?? config.sqlitePath);
  const extraHosts = extraAllowedHosts([config.storefrontUrl, config.wooBaseUrl, config.HORIZON_MERCHANT_DIAGNOSTICS_URL]);
  const auth = createResourceServer({
    config,
    jwks: options.jwks,
    clockToleranceSec: options.clockToleranceSec,
  });
  const catalog =
    options.catalog ??
    options.woo ??
    createCatalogAdapter({
      baseUrl: config.wooBaseUrl,
      extraHosts,
      fetchImpl: options.fetchImpl,
    });
  const commerce =
    options.commerce ??
    createCommerceAdapter({
      baseUrl: config.wooBaseUrl,
      storefrontUrl: config.storefrontUrl,
      key: config.HORIZON_WOO_KEY,
      secret: config.HORIZON_WOO_SECRET,
      user: config.WOO_USER,
      appPassword: config.WOO_APP_PASSWORD,
      extraHosts,
      fetchImpl: options.fetchImpl,
    });
  const storefront =
    options.storefront ??
    createStorefrontAdapter({
      cacheDir: config.HORIZON_CACHE_DIR,
      apiBaseUrl: config.wooBaseUrl,
      extraHosts,
      fetchImpl: options.fetchImpl,
    });
  const merchant =
    options.merchant ??
    createMerchantAdapter({
      localPath: config.merchantDiagnosticsPath,
      endpointUrl: config.HORIZON_MERCHANT_DIAGNOSTICS_URL || undefined,
      extraHosts,
      fetchImpl: options.fetchImpl,
    });
  const git =
    options.git ??
    createGitAdapter({
      repoDir: config.repoPath,
      allowFetch: config.allowFetch,
    });
  const github = createGithubAdapter();
  const audit = createAuditLog(db);
  const jobs = createJobQueue(db);
  const seo = options.seo ?? createSeoReportAdapter({ reportDir: config.seoReportDir });
  const analytics =
    options.analytics ??
    createAnalyticsAdapter({
      saPath: config.HORIZON_GOOGLE_SA_PATH,
      saJson: config.HORIZON_GOOGLE_SA_JSON,
      gscSiteUrl: config.HORIZON_GSC_SITE_URL,
      ga4PropertyId: config.HORIZON_GA4_PROPERTY_ID,
      extraHosts,
      fetchImpl: options.fetchImpl,
    });
  const competitors =
    options.competitors ??
    createCompetitorsAdapter({
      urls: parseCompetitorUrls(config.HORIZON_COMPETITOR_URLS),
      fetchImpl: options.fetchImpl,
    });
  const runner = options.runner ?? createDefaultJobRunner({ config, merchant, seo });
  const worker = startJobWorker({
    queue: jobs,
    runner,
    intervalMs: options.startWorker === false ? 60_000 : 200,
  });
  if (options.startWorker === false) {
    worker.stop();
  }
  const startedAt = Date.now();
  const health = createHealthAdapter({
    storefrontUrl: config.storefrontUrl,
    apiUrl: config.wooBaseUrl,
    extraHosts,
    fetchImpl: options.fetchImpl,
    gitStatus: () => git.status(),
    dbPing: () => {
      try {
        sqlite.prepare("SELECT 1").get();
        return true;
      } catch {
        return false;
      }
    },
    worker,
    startedAt,
  });
  const warehouse =
    options.warehouse ??
    createWarehouse({
      db,
      health,
      catalog,
      commerce,
      jobs,
      seo,
      analytics,
      competitors,
    });
  const assistant = createAssistantAdapter({
    health,
    catalog,
    commerce,
    warehouse,
    seo,
    analytics,
    competitors,
  });
  if (options.startWorker !== false) {
    const timer = setInterval(() => {
      void warehouse.evaluate().catch(() => undefined);
    }, 60_000);
    timer.unref?.();
  }
  return {
    config,
    db,
    sqlite,
    auth,
    catalog,
    woo: catalog,
    commerce,
    warehouse,
    assistant,
    seo,
    analytics,
    competitors,
    storefront,
    merchant,
    health,
    git,
    github,
    audit,
    jobs,
    runner,
    worker,
    startedAt,
  };
}

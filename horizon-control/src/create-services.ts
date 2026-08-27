import { createDb } from "./db/client.js";
import { loadConfig, type Config } from "./config.js";
import { createResourceServer, type ResourceServerOptions } from "./auth/resource-server.js";
import { createWooAdapter, type WooAdapter } from "./adapters/woo.js";
import { createCacheAdapter, type CacheAdapter } from "./adapters/wp-cli.js";
import { createVpsAdapter, type VpsAdapter } from "./adapters/vps.js";
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
  woo?: WooAdapter;
  cache?: CacheAdapter;
  vps?: VpsAdapter;
  git?: GitAdapter;
  runner?: JobRunner;
  sqlitePath?: string;
  startWorker?: boolean;
};

export function createServices(options: CreateServicesOptions = {}): AppServices {
  const config = options.config ?? loadConfig(options.env);
  const { db } = createDb(options.sqlitePath ?? config.HORIZON_SQLITE_PATH);
  const auth = createResourceServer({
    config,
    jwks: options.jwks,
    clockToleranceSec: options.clockToleranceSec,
  });
  const woo =
    options.woo ??
    createWooAdapter({
      baseUrl: config.WOO_BASE_URL,
      user: config.WOO_USER,
      appPassword: config.WOO_APP_PASSWORD,
    });
  const cache =
    options.cache ??
    createCacheAdapter({
      cacheDir: config.HORIZON_CACHE_DIR,
      merchantDir: config.HORIZON_MERCHANT_DIR,
      seoReportDir: config.HORIZON_SEO_REPORT_DIR,
    });
  const vps =
    options.vps ??
    createVpsAdapter({
      repoDir: config.HORIZON_REPO_DIR,
      spaUrl: config.HORIZON_SPA_URL,
      wpUrl: config.HORIZON_WP_URL,
    });
  const git = options.git ?? createGitAdapter({ repoDir: config.HORIZON_REPO_DIR });
  const github = createGithubAdapter();
  const audit = createAuditLog(db);
  const jobs = createJobQueue(db);
  const runner = options.runner ?? createDefaultJobRunner({ config, vps, cache });
  const worker = startJobWorker({
    queue: jobs,
    runner,
    intervalMs: options.startWorker === false ? 60_000 : 200,
  });
  if (options.startWorker === false) {
    worker.stop();
  }
  return { config, db, auth, woo, cache, vps, git, github, audit, jobs, runner, worker };
}

import type { Config } from "../config.js";
import type { HorizonDb } from "../db/client.js";
import type { WooAdapter } from "../adapters/woo.js";
import type { CacheAdapter } from "../adapters/wp-cli.js";
import type { VpsAdapter } from "../adapters/vps.js";
import type { GitAdapter } from "../adapters/git.js";
import type { GithubAdapter } from "../adapters/github.js";
import type { AuditLog } from "../audit/log.js";
import type { JobQueue } from "../jobs/queue.js";
import type { JobRunner } from "../jobs/runner.js";
import type { ResourceServer } from "../auth/resource-server.js";

export type AppServices = {
  config: Config;
  db: HorizonDb;
  auth: ResourceServer;
  woo: WooAdapter;
  cache: CacheAdapter;
  vps: VpsAdapter;
  git: GitAdapter;
  github: GithubAdapter;
  audit: AuditLog;
  jobs: JobQueue;
  runner: JobRunner;
  worker: { stop: () => void; tick: () => Promise<void> };
};

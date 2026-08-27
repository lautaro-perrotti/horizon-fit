import { extraAllowedHosts, allowlistedFetch } from "../http/allowlist.js";
import type { GitStatus } from "./git.js";
import type { HealthStatus } from "../types.js";

export type Probe = {
  url: string;
  status: number | null;
  latency_ms: number | null;
  ok: boolean;
};

export type HealthReport = {
  status: HealthStatus;
  storefront: Probe;
  api: Probe;
  repo: { head: string | null; branch: string | null };
  control_plane: { uptime_s: number; worker: { healthy: boolean; last_tick_at: number | null } };
  db: { healthy: boolean };
};

export type HealthAdapter = {
  report: () => Promise<HealthReport>;
};

async function probeUrl(url: string, extraHosts: string[], fetchImpl: typeof fetch): Promise<Probe> {
  const started = Date.now();
  try {
    const response = await allowlistedFetch(url, extraHosts, { method: "GET", timeoutMs: 4000, redirect: "manual" }, fetchImpl);
    const latency = Date.now() - started;
    return { url, status: response.status, latency_ms: latency, ok: response.status > 0 && response.status < 500 };
  } catch {
    return { url, status: null, latency_ms: Date.now() - started, ok: false };
  }
}

function rollup(storefront: Probe, api: Probe, dbOk: boolean, workerOk: boolean): HealthStatus {
  if (!storefront.ok && !api.ok) return "unavailable";
  if (!storefront.ok || !api.ok || !dbOk || !workerOk) return "degraded";
  return "healthy";
}

export function createHealthAdapter(options: {
  storefrontUrl: string;
  apiUrl: string;
  extraHosts?: string[];
  fetchImpl?: typeof fetch;
  gitStatus: () => Promise<Pick<GitStatus, "head" | "branch">>;
  dbPing: () => boolean;
  worker: { lastTickAt: number | null; stopped: boolean };
  startedAt: number;
}): HealthAdapter {
  const extraHosts = options.extraHosts ?? extraAllowedHosts([options.storefrontUrl, options.apiUrl]);
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async report() {
      const [storefront, api, repo] = await Promise.all([
        probeUrl(options.storefrontUrl, extraHosts, fetchImpl),
        probeUrl(options.apiUrl, extraHosts, fetchImpl),
        options.gitStatus(),
      ]);
      const dbOk = options.dbPing();
      const workerOk = !options.worker.stopped;
      return {
        status: rollup(storefront, api, dbOk, workerOk),
        storefront,
        api,
        repo: { head: repo.head, branch: repo.branch },
        control_plane: {
          uptime_s: Math.round((Date.now() - options.startedAt) / 1000),
          worker: { healthy: workerOk, last_tick_at: options.worker.lastTickAt },
        },
        db: { healthy: dbOk },
      };
    },
  };
}

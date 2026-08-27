import path from "node:path";
import { SEO_AUDIT_ALLOWLIST } from "../config.js";
import type { Config } from "../config.js";
import type { VpsAdapter } from "../adapters/vps.js";
import type { CacheAdapter } from "../adapters/wp-cli.js";
import type { AllowedJobType } from "./queue.js";

export type JobRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  mocked?: boolean;
  extra?: unknown;
};

export type JobRunner = (type: AllowedJobType, args: Record<string, unknown>) => Promise<JobRunResult>;

function assertAllowlistedSeoUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = "/";
  const normalized = parsed.origin;
  if (!SEO_AUDIT_ALLOWLIST.includes(normalized)) {
    throw new Error(`seo_url_not_allowlisted:${url}`);
  }
  return `${normalized}/`;
}

export function createDefaultJobRunner(options: {
  config: Config;
  vps: VpsAdapter;
  cache: CacheAdapter;
}): JobRunner {
  const repo = options.config.HORIZON_REPO_DIR || process.cwd();

  return async (type, args) => {
    if (type === "seo.audit") {
      const requested = String(args.url ?? "https://horizonfit.com.ar");
      const url = assertAllowlistedSeoUrl(requested);
      return options.vps.typedJob({
        command: options.config.NODE_BIN,
        args: [path.join("scripts", "seo-audit.js"), url, "--all"],
        cwd: repo,
      });
    }
    if (type === "tests.run") {
      const php = await options.vps.typedJob({
        command: options.config.PHP_BIN,
        args: [path.join("tests", "search-merchant-tests.php")],
        cwd: repo,
      });
      const node = await options.vps.typedJob({
        command: options.config.NODE_BIN,
        args: [path.join("scripts", "validate-home-v1.js")],
        cwd: repo,
      });
      return {
        stdout: [php.stdout, node.stdout].filter(Boolean).join("\n"),
        stderr: [php.stderr, node.stderr].filter(Boolean).join("\n"),
        exitCode: php.exitCode || node.exitCode,
        extra: { php: php.exitCode, validateHome: node.exitCode },
      };
    }
    if (type === "merchant.audit") {
      const snapshot = await options.cache.readMerchantDiagnostics();
      return {
        stdout: snapshot.diagnosticsTxt ?? "",
        stderr: "",
        exitCode: 0,
        extra: {
          regenerated: false,
          path: snapshot.path,
          hasProductsJson: snapshot.productsJson !== null,
        },
      };
    }
    throw new Error(`unsupported_job_type:${type}`);
  };
}

export function startJobWorker(options: {
  queue: { claimNext: () => Promise<{ id: string; type: string; args: Record<string, unknown> } | null>; finish: (id: string, result: unknown) => Promise<void>; fail: (id: string, error: string) => Promise<void> };
  runner: JobRunner;
  intervalMs?: number;
}): { stop: () => void; tick: () => Promise<void> } {
  let stopped = false;
  const intervalMs = options.intervalMs ?? 250;

  async function tick() {
    const job = await options.queue.claimNext();
    if (!job) return;
    try {
      const result = await options.runner(job.type as AllowedJobType, job.args);
      if (result.exitCode !== 0) {
        await options.queue.fail(job.id, result.stderr || `exit_${result.exitCode}`);
        return;
      }
      await options.queue.finish(job.id, result);
    } catch (error) {
      await options.queue.fail(job.id, error instanceof Error ? error.message : String(error));
    }
  }

  const timer = setInterval(() => {
    if (!stopped) void tick();
  }, intervalMs);
  timer.unref?.();

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    tick,
  };
}

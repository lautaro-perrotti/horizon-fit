import { SEO_AUDIT_ORIGIN } from "../config.js";
import type { Config } from "../config.js";
import type { MerchantAdapter } from "../adapters/merchant.js";
import type { SeoReportAdapter } from "../adapters/seo-report.js";
import { runTypedJob } from "../adapters/process.js";
import type { AllowedJobType } from "./queue.js";
import { sanitizeError } from "../auth/redact.js";

export type JobRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  mocked?: boolean;
  extra?: unknown;
};

export type JobRunner = (type: AllowedJobType, args: Record<string, unknown>) => Promise<JobRunResult>;

export function createDefaultJobRunner(options: {
  config: Config;
  merchant: MerchantAdapter;
  seo?: SeoReportAdapter;
}): JobRunner {
  const repo = options.config.repoPath || process.cwd();

  return async (type) => {
    if (type === "seo.audit") {
      const run = await runTypedJob({
        command: options.config.NODE_BIN,
        script: "scripts/seo-audit.js",
        extraArgs: [SEO_AUDIT_ORIGIN, "--all"],
        cwd: repo,
      });
      const latest = options.seo?.readLatest();
      return {
        ...run,
        extra: {
          summary: run.exitCode === 0 ? latest?.summary ?? null : null,
          reportPath: latest?.summary?.reportPath ?? null,
        },
      };
    }
    if (type === "tests.run") {
      const php = await runTypedJob({
        command: options.config.PHP_BIN,
        script: "tests/search-merchant-tests.php",
        cwd: repo,
      });
      const node = await runTypedJob({
        command: options.config.NODE_BIN,
        script: "scripts/validate-home-v1.js",
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
      const snapshot = await options.merchant.readDiagnostics();
      return {
        stdout: snapshot.diagnosticsTxt ?? "",
        stderr: snapshot.error ?? "",
        exitCode: snapshot.error ? 1 : 0,
        extra: {
          regenerated: false,
          path: snapshot.path,
          source: snapshot.source,
          hasProductsJson: snapshot.productsJson !== null,
          error: snapshot.error,
        },
      };
    }
    throw new Error(`unsupported_job_type:${type}`);
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`job_timeout:${timeoutMs}`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function startJobWorker(options: {
  queue: {
    claimNext: () => Promise<{ id: string; type: string; args: Record<string, unknown>; timeoutMs: number; attempt: number; maxAttempts: number } | null>;
    finish: (id: string, result: unknown) => Promise<void>;
    fail: (id: string, error: string, retry?: boolean) => Promise<void>;
  };
  runner: JobRunner;
  intervalMs?: number;
}): { stop: () => void; tick: () => Promise<void>; lastTickAt: number | null; stopped: boolean } {
  let stopped = false;
  let lastTickAt: number | null = null;
  const intervalMs = options.intervalMs ?? 250;

  async function tick() {
    lastTickAt = Date.now();
    const job = await options.queue.claimNext();
    if (!job) return;
    try {
      const result = await withTimeout(options.runner(job.type as AllowedJobType, job.args), job.timeoutMs);
      if (result.exitCode !== 0) {
        await options.queue.fail(job.id, sanitizeError(result.stderr || `exit_${result.exitCode}`), job.attempt < job.maxAttempts);
        return;
      }
      await options.queue.finish(job.id, result);
    } catch (error) {
      await options.queue.fail(
        job.id,
        sanitizeError(error instanceof Error ? error.message : String(error)),
        job.attempt < job.maxAttempts,
      );
    }
  }

  const timer = setInterval(() => {
    if (!stopped) void tick();
  }, intervalMs);
  timer.unref?.();

  return {
    get lastTickAt() {
      return lastTickAt;
    },
    get stopped() {
      return stopped;
    },
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    tick,
  };
}

import fs from "node:fs/promises";
import path from "node:path";
import { extraAllowedHosts, allowlistedFetch, isAllowedUrl } from "../http/allowlist.js";
import { PathTraversalError, safeJoin } from "../http/paths.js";

export type MerchantProblem = {
  sku: string;
  title: string | null;
  ready: boolean;
  issues: Array<{ severity?: string; code?: string; message?: string }>;
};

export type MerchantDiagnostics = {
  diagnosticsTxt: string | null;
  productsJson: unknown | null;
  path: string | null;
  source: "local" | "endpoint" | "unavailable";
  summary: {
    ready: number | null;
    blocked: number | null;
    problems: MerchantProblem[];
  };
  error?: "diagnostics_unavailable";
};

export type MerchantAdapter = {
  readDiagnostics: () => Promise<MerchantDiagnostics>;
};

function unavailable(): MerchantDiagnostics {
  return {
    diagnosticsTxt: null,
    productsJson: null,
    path: null,
    source: "unavailable",
    summary: { ready: null, blocked: null, problems: [] },
    error: "diagnostics_unavailable",
  };
}

export function summarizeMerchantProblems(productsJson: unknown): MerchantDiagnostics["summary"] {
  if (!productsJson || typeof productsJson !== "object") {
    return { ready: null, blocked: null, problems: [] };
  }
  const obj = productsJson as Record<string, unknown>;
  const items = Array.isArray(obj.items) ? obj.items : [];
  const problems: MerchantProblem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (item.ready !== false) continue;
    const data = item.data && typeof item.data === "object" ? (item.data as Record<string, unknown>) : {};
    const issues = Array.isArray(item.issues)
      ? item.issues.filter((issue): issue is Record<string, unknown> => Boolean(issue) && typeof issue === "object")
      : [];
    problems.push({
      sku: String(item.sku ?? data.id ?? ""),
      title: typeof data.title === "string" ? data.title : null,
      ready: false,
      issues: issues.map((issue) => ({
        severity: typeof issue.severity === "string" ? issue.severity : undefined,
        code: typeof issue.code === "string" ? issue.code : undefined,
        message: typeof issue.message === "string" ? issue.message : undefined,
      })),
    });
    if (problems.length >= 50) break;
  }
  return {
    ready: typeof obj.ready === "number" ? obj.ready : null,
    blocked: typeof obj.blocked === "number" ? obj.blocked : problems.length,
    problems,
  };
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function readJson(filePath: string): Promise<unknown | null> {
  const raw = await readText(filePath);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function withSummary(
  diagnosticsTxt: string | null,
  productsJson: unknown | null,
  artifactPath: string,
  source: "local" | "endpoint",
): MerchantDiagnostics {
  return {
    diagnosticsTxt,
    productsJson,
    path: artifactPath,
    source,
    summary: summarizeMerchantProblems(productsJson),
  };
}

async function fromLocalPath(configured: string): Promise<MerchantDiagnostics | null> {
  if (!configured) return null;
  const resolved = path.resolve(configured);
  try {
    const stat = await fs.stat(resolved);
    const dir = stat.isDirectory() ? resolved : path.dirname(resolved);
    const diagnosticsTxt = await readText(safeJoin(dir, "merchant-diagnostics.txt"));
    const productsJson = await readJson(safeJoin(dir, "merchant-products.json"));
    if (diagnosticsTxt === null && productsJson === null) return null;
    return withSummary(diagnosticsTxt, productsJson, dir, "local");
  } catch (error) {
    if (error instanceof PathTraversalError) throw error;
    return null;
  }
}

function endpointPair(url: string): { txt: string; json: string; dir: string } {
  const trimmed = url.replace(/\/$/, "");
  const dir = /\.(txt|json)$/i.test(trimmed) ? trimmed.replace(/\/[^/]+$/, "") : trimmed;
  return {
    dir,
    txt: `${dir}/merchant-diagnostics.txt`,
    json: `${dir}/merchant-products.json`,
  };
}

export function createMerchantAdapter(options: {
  localPath: string;
  endpointUrl?: string;
  extraHosts?: string[];
  fetchImpl?: typeof fetch;
}): MerchantAdapter {
  const extraHosts = options.extraHosts ?? extraAllowedHosts([options.endpointUrl]);
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async readDiagnostics() {
      const local = await fromLocalPath(options.localPath);
      if (local) return local;
      if (options.endpointUrl && isAllowedUrl(options.endpointUrl, extraHosts)) {
        try {
          const pair = endpointPair(options.endpointUrl);
          const [txtRes, jsonRes] = await Promise.all([
            allowlistedFetch(pair.txt, extraHosts, { timeoutMs: 8000 }, fetchImpl).catch(() => null),
            allowlistedFetch(pair.json, extraHosts, { timeoutMs: 8000 }, fetchImpl).catch(() => null),
          ]);
          const diagnosticsTxt = txtRes?.ok ? await txtRes.text() : null;
          let productsJson: unknown | null = null;
          if (jsonRes?.ok) {
            const body = await jsonRes.text();
            try {
              productsJson = JSON.parse(body);
            } catch {
              productsJson = null;
            }
          }
          if (diagnosticsTxt !== null || productsJson !== null) {
            return withSummary(diagnosticsTxt, productsJson, pair.dir, "endpoint");
          }
        } catch {
          // fall through
        }
      }
      return unavailable();
    },
  };
}

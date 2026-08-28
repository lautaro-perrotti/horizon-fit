import fs from "node:fs";
import path from "node:path";

export const SEO_PAGE_LIMIT = 50;

export type SeoIssue = { message: string; evidence?: string };

export type SeoPageSummary = {
  url: string;
  slug: string;
  title: string;
  description: string;
  critical: number;
  warning: number;
  issues: { critical: SeoIssue[]; warning: SeoIssue[] };
};

export type SeoSummary = {
  generatedAt: string | null;
  auditedCount: number;
  totals: { critical: number; warning: number };
  pages: SeoPageSummary[];
  reportPath: string;
  age_h: number | null;
};

export type SeoLatest = {
  configured: boolean;
  summary: SeoSummary | null;
  reason?: string;
};

export type SeoReportAdapter = {
  readLatest: () => SeoLatest;
};

type RawIssue = { message?: unknown; evidence?: unknown };
type RawPage = {
  url?: unknown;
  title?: unknown;
  description?: unknown;
  issues?: { critical?: RawIssue[]; warning?: RawIssue[] };
};

function asIssue(raw: RawIssue | undefined): SeoIssue | null {
  const message = String(raw?.message ?? "").trim();
  if (!message) return null;
  const evidence = String(raw?.evidence ?? "").trim();
  return evidence ? { message, evidence } : { message };
}

export function productSlugFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\/product\/([^/]+)\/?$/i);
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

function ageHours(generatedAt: string | null): number | null {
  if (!generatedAt) return null;
  const at = Date.parse(generatedAt);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, (Date.now() - at) / 3_600_000);
}

export function summarizeSeoReport(raw: unknown, reportPath: string): SeoSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const report = raw as {
    generatedAt?: unknown;
    auditedCount?: unknown;
    totals?: { critical?: unknown; warning?: unknown };
    pages?: RawPage[];
  };
  const pages = Array.isArray(report.pages) ? report.pages : [];
  const problematic = pages
    .map((page) => {
      const url = String(page.url ?? "");
      if (!url) return null;
      const critical = (page.issues?.critical ?? []).map(asIssue).filter((item): item is SeoIssue => Boolean(item));
      const warning = (page.issues?.warning ?? []).map(asIssue).filter((item): item is SeoIssue => Boolean(item));
      if (!critical.length && !warning.length) return null;
      return {
        url,
        slug: productSlugFromUrl(url),
        title: String(page.title ?? ""),
        description: String(page.description ?? ""),
        critical: critical.length,
        warning: warning.length,
        issues: { critical: critical.slice(0, 8), warning: warning.slice(0, 8) },
      };
    })
    .filter((page): page is SeoPageSummary => Boolean(page))
    .slice(0, SEO_PAGE_LIMIT);

  const generatedAt = typeof report.generatedAt === "string" ? report.generatedAt : null;
  return {
    generatedAt,
    auditedCount: Number(report.auditedCount) || pages.length,
    totals: {
      critical: Number(report.totals?.critical) || 0,
      warning: Number(report.totals?.warning) || 0,
    },
    pages: problematic,
    reportPath,
    age_h: ageHours(generatedAt),
  };
}

export function summaryFromJobResult(result: unknown): SeoSummary | null {
  if (!result || typeof result !== "object") return null;
  const extra = (result as { extra?: { summary?: unknown } }).extra;
  const summary = extra?.summary;
  if (!summary || typeof summary !== "object") return null;
  const totals = (summary as SeoSummary).totals;
  if (!totals || typeof totals.critical !== "number") return null;
  return summary as SeoSummary;
}

export function compactSeoJob(job: {
  id: string;
  type: string;
  status: string;
  createdAt: number;
  finishedAt?: number | null;
  error?: string | null;
} | null) {
  if (!job) return null;
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt ?? null,
    error: job.error ?? null,
  };
}

export function resolveSeoReportDir(options: { reportDir?: string; repoPath?: string }): string {
  const explicit = options.reportDir?.trim();
  if (explicit) return explicit;
  const repo = options.repoPath?.trim();
  if (repo) return path.join(repo, "reports", "seo-audit");
  return path.join(process.cwd(), "reports", "seo-audit");
}

export function createSeoReportAdapter(options: { reportDir: string }): SeoReportAdapter {
  const latestPath = path.join(options.reportDir, "latest.json");
  return {
    readLatest() {
      if (!fs.existsSync(latestPath) || !fs.statSync(latestPath).isFile()) {
        return { configured: false, summary: null, reason: "missing_seo_report" };
      }
      try {
        const raw = JSON.parse(fs.readFileSync(latestPath, "utf8"));
        const summary = summarizeSeoReport(raw, path.relative(process.cwd(), latestPath) || latestPath);
        if (!summary) return { configured: false, summary: null, reason: "invalid_seo_report" };
        return { configured: true, summary };
      } catch {
        return { configured: false, summary: null, reason: "invalid_seo_report" };
      }
    },
  };
}

import fs from "node:fs/promises";
import path from "node:path";

const CACHE_FILES = [
  "featured-products.json",
  "featured-categories.json",
  "featured-sets.json",
  "home-layout.json",
  "menu.json",
  "info-pages.json",
] as const;

export type CacheAdapter = {
  readStorefrontConfig: () => Promise<{ path: string | null; files: Record<string, unknown> }>;
  readMerchantDiagnostics: () => Promise<{
    diagnosticsTxt: string | null;
    productsJson: unknown | null;
    path: string | null;
  }>;
  readLatestSeoAudit: () => Promise<{ path: string | null; report: unknown | null }>;
};

async function readJsonIfPresent(filePath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readTextIfPresent(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export function createCacheAdapter(options: {
  cacheDir: string;
  merchantDir: string;
  seoReportDir: string;
}): CacheAdapter {
  return {
    async readStorefrontConfig() {
      if (!options.cacheDir) {
        return { path: null, files: {} };
      }
      const files: Record<string, unknown> = {};
      for (const name of CACHE_FILES) {
        const parsed = await readJsonIfPresent(path.join(options.cacheDir, name));
        if (parsed !== null) files[name] = parsed;
      }
      return { path: options.cacheDir, files };
    },
    async readMerchantDiagnostics() {
      if (!options.merchantDir) {
        return { diagnosticsTxt: null, productsJson: null, path: null };
      }
      const diagnosticsTxt = await readTextIfPresent(path.join(options.merchantDir, "merchant-diagnostics.txt"));
      const productsJson = await readJsonIfPresent(path.join(options.merchantDir, "merchant-products.json"));
      return { diagnosticsTxt, productsJson, path: options.merchantDir };
    },
    async readLatestSeoAudit() {
      if (!options.seoReportDir) {
        return { path: null, report: null };
      }
      try {
        const entries = await fs.readdir(options.seoReportDir);
        const jsonFiles = entries.filter((name) => name.endsWith(".json")).sort();
        const latest = jsonFiles.at(-1);
        if (!latest) return { path: null, report: null };
        const full = path.join(options.seoReportDir, latest);
        return { path: full, report: await readJsonIfPresent(full) };
      } catch {
        return { path: null, report: null };
      }
    },
  };
}

import { describe, expect, it } from "vitest";
import { createCatalogAdapter } from "../src/adapters/woo.js";
import { createMerchantAdapter } from "../src/adapters/merchant.js";
import { createGitAdapter } from "../src/adapters/git.js";
import { createHealthAdapter } from "../src/adapters/health.js";

const enabled = process.env.HORIZON_INTEGRATION === "1";

describe.skipIf(!enabled)("opt-in integration (HORIZON_INTEGRATION=1)", () => {
  const wooBase = process.env.HORIZON_WOO_BASE_URL ?? "";
  const storefrontUrl = process.env.HORIZON_STOREFRONT_URL ?? "";
  const repoPath = process.env.HORIZON_REPO_PATH ?? "";
  const merchantPath = process.env.HORIZON_MERCHANT_DIAGNOSTICS_PATH ?? "";

  it("catalog.search hits the configured Store API only", async () => {
    expect(wooBase).toBeTruthy();
    const catalog = createCatalogAdapter({ baseUrl: wooBase });
    const result = await catalog.searchProducts({ query: "dynamic", limit: 5 });
    expect(Array.isArray(result.products)).toBe(true);
  });

  it("repo.status reads HORIZON_REPO_PATH", async () => {
    expect(repoPath).toBeTruthy();
    const git = createGitAdapter({ repoDir: repoPath, allowFetch: false });
    const status = await git.status();
    expect(status.head).toMatch(/^[0-9a-f]{7,40}$/i);
    expect(status.fetched).toBe(false);
  });

  it("merchant diagnostics reads the configured path or returns unavailable", async () => {
    const merchant = createMerchantAdapter({ localPath: merchantPath });
    const snapshot = await merchant.readDiagnostics();
    expect(["local", "endpoint", "unavailable"]).toContain(snapshot.source);
  });

  it("ops.health probes configured HTTP endpoints", async () => {
    expect(storefrontUrl).toBeTruthy();
    expect(wooBase).toBeTruthy();
    const health = createHealthAdapter({
      storefrontUrl,
      apiUrl: wooBase,
      gitStatus: async () => ({ head: null, branch: null }),
      dbPing: () => true,
      worker: { lastTickAt: Date.now(), stopped: false },
      startedAt: Date.now(),
    });
    const report = await health.report();
    expect(["healthy", "degraded", "unavailable"]).toContain(report.status);
  });
});

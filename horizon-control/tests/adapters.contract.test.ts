import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { createCatalogAdapter } from "../src/adapters/woo.js";
import { createMerchantAdapter } from "../src/adapters/merchant.js";
import { createStorefrontAdapter } from "../src/adapters/storefront.js";
import { createGitAdapter } from "../src/adapters/git.js";
import { createHealthAdapter } from "../src/adapters/health.js";
import { runTypedJob } from "../src/adapters/process.js";
import { allowlistedFetch, SsrfError } from "../src/http/allowlist.js";
import { createDefaultJobRunner } from "../src/jobs/runner.js";
import { loadConfig } from "../src/config.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const parentProduct = JSON.parse(readFileSync(path.join(fixtures, "store-product-001-top-azu.json"), "utf8"));
const variationS = JSON.parse(readFileSync(path.join(fixtures, "store-variation-001-top-azu-s.json"), "utf8"));
const variationM = JSON.parse(readFileSync(path.join(fixtures, "store-variation-001-top-azu-m.json"), "utf8"));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function storeFetch(): typeof fetch {
  return async (input) => {
    const url = new URL(String(input));
    expect(url.hostname).toBe("api.horizonfit.com.ar");
    expect(url.pathname.startsWith("/wp-json/wc/store/v1/")).toBe(true);
    if (url.pathname === "/wp-json/wc/store/v1/products/99") return jsonResponse(parentProduct);
    if (url.pathname === "/wp-json/wc/store/v1/products") {
      const sku = url.searchParams.get("sku");
      const search = url.searchParams.get("search");
      const slug = url.searchParams.get("slug");
      const include = url.searchParams.get("include");
      const type = url.searchParams.get("type");
      if (include) {
        const ids = include.split(",").map(Number);
        const vars = [variationS, variationM].filter((item) => ids.includes(item.id));
        return jsonResponse(type === "variation" || vars.length ? vars : vars);
      }
      if (sku === "001-TOP-AZU" || slug === "top-liso-azul" || search === "dynamic") {
        return jsonResponse([parentProduct]);
      }
      if (sku === "001-TOP-AZU-S") return jsonResponse([variationS]);
      return jsonResponse([]);
    }
    return jsonResponse({ code: "not_found" }, 404);
  };
}

describe("catalog Store API contract (mocked HTTP)", () => {
  it("maps 001-TOP-AZU with parent SKU, variations, and read-only price/stock", async () => {
    const catalog = createCatalogAdapter({
      baseUrl: "https://api.horizonfit.com.ar",
      fetchImpl: storeFetch(),
    });
    const product = await catalog.getProduct("001-TOP-AZU");
    expect(product).toMatchObject({
      id: 99,
      sku: "001-TOP-AZU",
      parent_sku: "001-TOP-AZU",
      slug: "top-liso-azul",
      name: "Top Dynamic blue",
      status: "publish",
      stock_status: "instock",
    });
    expect(product?.price.amount).toBe("67000.00");
    expect(product?.price.currency).toBe("ARS");
    expect(product?.variations.map((row) => row.sku).sort()).toEqual(["001-TOP-AZU-M", "001-TOP-AZU-S"]);
    expect(product?.attributes.Talle).toEqual(["S", "M", "L"]);
    expect(product?.attributes.Color).toEqual(["Azul"]);
  });

  it("search by query, sku, category, color, talle, and pagination never mutates", async () => {
    const methods: string[] = [];
    const catalog = createCatalogAdapter({
      baseUrl: "https://api.horizonfit.com.ar",
      fetchImpl: async (input, init) => {
        methods.push(String(init?.method ?? "GET"));
        return storeFetch()(input, init);
      },
    });
    const bySku = await catalog.searchProducts({ sku: "001-TOP-AZU", page: 1, limit: 10 });
    expect(bySku.products[0]?.sku).toBe("001-TOP-AZU");
    const byQuery = await catalog.searchProducts({ query: "dynamic" });
    expect(byQuery.products[0]?.name).toMatch(/Dynamic/i);
    const byColor = await catalog.searchProducts({ sku: "001-TOP-AZU", color: "azul", talle: "S" });
    expect(byColor.products).toHaveLength(1);
    expect(methods.every((method) => method === "GET")).toBe(true);
  });

  it("rejects non-allowlisted catalog hosts", async () => {
    const catalog = createCatalogAdapter({
      baseUrl: "https://evil.example",
      fetchImpl: async () => jsonResponse([]),
    });
    await expect(catalog.searchProducts({ query: "x" })).rejects.toThrow(SsrfError);
  });
});

describe("merchant artifacts are read-only", () => {
  it("reads local diagnostics then summarizes blocked products", async () => {
    const merchant = createMerchantAdapter({ localPath: fixtures });
    const snapshot = await merchant.readDiagnostics();
    expect(snapshot.source).toBe("local");
    expect(snapshot.error).toBeUndefined();
    expect(snapshot.diagnosticsTxt).toMatch(/Bloqueados: 1/);
    expect(snapshot.summary.blocked).toBe(1);
    expect(snapshot.summary.problems[0]?.sku).toBe("001-TOP-AZU-M");
    expect(snapshot.summary.problems[0]?.issues[0]?.code).toBe("missing_image");
  });

  it("falls back to diagnostics_unavailable when nothing is readable", async () => {
    const merchant = createMerchantAdapter({ localPath: path.join(os.tmpdir(), "missing-horizon-merchant") });
    const snapshot = await merchant.readDiagnostics();
    expect(snapshot.source).toBe("unavailable");
    expect(snapshot.error).toBe("diagnostics_unavailable");
  });

  it("uses an allowlisted HTTP endpoint only after local miss", async () => {
    const merchant = createMerchantAdapter({
      localPath: path.join(os.tmpdir(), "missing-horizon-merchant"),
      endpointUrl: "https://api.horizonfit.com.ar/wp-content/uploads/horizon-fit-merchant/",
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith("merchant-diagnostics.txt")) {
          return new Response("endpoint diagnostics\n", { status: 200 });
        }
        if (url.endsWith("merchant-products.json")) {
          return jsonResponse({ ready: 0, blocked: 0, items: [] });
        }
        return new Response("no", { status: 404 });
      },
    });
    const snapshot = await merchant.readDiagnostics();
    expect(snapshot.source).toBe("endpoint");
    expect(snapshot.diagnosticsTxt).toMatch(/endpoint diagnostics/);
  });
});

describe("storefront config", () => {
  it("reads menu and home sections from cache and does not invent hero/marquee", async () => {
    const storefront = createStorefrontAdapter({
      cacheDir: fixtures,
      apiBaseUrl: "https://api.horizonfit.com.ar",
      fetchImpl: async () => new Response("no", { status: 404 }),
    });
    const config = await storefront.getConfig();
    expect(config.menu.status).toBe("ok");
    expect(config.home_sections.status).toBe("ok");
    expect(config.hero.status).toBe("ok");
    expect(config.marquee.status).toBe("ok");
    expect((config.hero.data as { type?: string }).type).toBe("hero");
  });

  it("marks pieces unavailable instead of fabricating them", async () => {
    const empty = await mkdtemp(path.join(os.tmpdir(), "hf-cache-"));
    const storefront = createStorefrontAdapter({
      cacheDir: empty,
      apiBaseUrl: "https://api.horizonfit.com.ar",
      fetchImpl: async () => new Response("no", { status: 404 }),
    });
    const config = await storefront.getConfig();
    expect(config.menu.status).toBe("unavailable");
    expect(config.hero.data).toBeNull();
    expect(config.marquee.data).toBeNull();
  });
});

describe("repo.status git adapter", () => {
  it("runs read-only status and never fetch/checkout/reset by default", async () => {
    const calls: string[][] = [];
    const git = createGitAdapter({
      repoDir: "/repo",
      allowFetch: false,
      execFileImpl: async (command, args) => {
        expect(command).toBe("git");
        calls.push(args as string[]);
        const verb = (args as string[])[0];
        if (verb === "rev-parse") return { stdout: (args as string[])[1] === "HEAD" ? "abc123\n" : "feat/horizon-control\n", stderr: "" };
        if (verb === "status") return { stdout: " M src/index.ts\n", stderr: "" };
        if (verb === "remote") return { stdout: "origin\n", stderr: "" };
        if (verb === "rev-list") return { stdout: "2 1\n", stderr: "" };
        throw new Error(`unexpected ${verb}`);
      },
    });
    const status = await git.status();
    expect(status).toMatchObject({
      branch: "feat/horizon-control",
      head: "abc123",
      dirty: true,
      remote: "origin",
      ahead: 1,
      behind: 2,
      fetched: false,
    });
    expect(status.dirty_files).toEqual(["src/index.ts"]);
    expect(calls.some((args) => args[0] === "fetch")).toBe(false);
    expect(calls.some((args) => ["checkout", "reset", "clean", "commit", "push"].includes(args[0]))).toBe(false);
  });
});

describe("ops.health local probes", () => {
  it("returns healthy/degraded/unavailable with HTTP latency and repo HEAD", async () => {
    const health = createHealthAdapter({
      storefrontUrl: "https://horizonfit.com.ar",
      apiUrl: "https://api.horizonfit.com.ar",
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.startsWith("https://horizonfit.com.ar")) return new Response("ok", { status: 200 });
        if (url.startsWith("https://api.horizonfit.com.ar")) return new Response("ok", { status: 200 });
        throw new Error("unexpected host");
      },
      gitStatus: async () => ({ head: "abc123", branch: "feat/horizon-control" }),
      dbPing: () => true,
      worker: { lastTickAt: Date.now(), stopped: false },
      startedAt: Date.now() - 5000,
    });
    const report = await health.report();
    expect(report.status).toBe("healthy");
    expect(report.storefront.status).toBe(200);
    expect(report.api.status).toBe(200);
    expect(report.repo.head).toBe("abc123");
    expect(report.db.healthy).toBe(true);
    expect(report.control_plane.uptime_s).toBeGreaterThanOrEqual(0);
  });
});

describe("SSRF allowlist", () => {
  it("blocks arbitrary URLs and userinfo", async () => {
    await expect(allowlistedFetch("https://evil.example/", [], { timeoutMs: 10 })).rejects.toThrow(SsrfError);
    await expect(
      allowlistedFetch("https://user:pass@horizonfit.com.ar/", [], { timeoutMs: 10 }),
    ).rejects.toThrow(SsrfError);
  });
});

describe("typed jobs argv allowlist", () => {
  it("wraps seo-audit.js with allowlisted origin only", async () => {
    await expect(
      runTypedJob(
        {
          command: "node",
          script: "scripts/seo-audit.js",
          extraArgs: ["https://evil.example"],
          cwd: process.cwd(),
        },
        async () => ({ stdout: "", stderr: "" }),
      ),
    ).rejects.toThrow(/job_args_denied/);
    const ok = await runTypedJob(
      {
        command: "node",
        script: "scripts/seo-audit.js",
        extraArgs: ["https://horizonfit.com.ar", "--all"],
        cwd: process.cwd(),
      },
      async (command, args) => {
        expect(command).toBe("node");
        expect(args).toContain("https://horizonfit.com.ar");
        expect(args).toContain("--all");
        return { stdout: "ok", stderr: "" };
      },
    );
    expect(ok.exitCode).toBe(0);
  });
});

describe("merchant.audit never regenerates", () => {
  it("records regenerated:false from existing artifacts", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "hf-merch-"));
    await writeFile(path.join(dir, "merchant-diagnostics.txt"), "ok\n");
    await writeFile(path.join(dir, "merchant-products.json"), JSON.stringify({ ready: 1, blocked: 0, items: [] }));
    const merchant = createMerchantAdapter({ localPath: dir });
    const runner = createDefaultJobRunner({
      config: loadConfig({ HORIZON_REPO_PATH: dir }),
      merchant,
    });
    const result = await runner("merchant.audit", {});
    expect(result.exitCode).toBe(0);
    expect(result.extra).toMatchObject({ regenerated: false, source: "local" });
  });
});

import { allowlistedFetch, extraAllowedHosts } from "../http/allowlist.js";
import type { CatalogAdapter } from "./woo.js";
import {
  competitorFromHost,
  extractPage,
  robotsAllows,
  segmentForUrl,
  shopifyCollectionJsonUrl,
  type ExtractedPage,
} from "./competitor-extract.js";
import { createCompetitorStore, type CompetitorStore, type StoredSnapshot } from "./competitor-store.js";
import type { HorizonDb } from "../db/client.js";
import { parseCompetitorUrls } from "./competitors.js";

const STORE_ID = "horizon-fit";
const UA = "HorizonControl/0.1 (+https://horizonfit.com.ar)";

export type CompetitionList = {
  configured: boolean;
  reason?: string;
  store_id: string;
  fetched_at: string | null;
  snapshots: StoredSnapshot[];
};

export type CompetitionAdapter = {
  list: () => CompetitionList;
  get: (url: string) => { configured: boolean; reason?: string; snapshot: StoredSnapshot | null; products: ReturnType<CompetitorStore["productsOf"]> };
  changes: () => { configured: boolean; reason?: string; changes: ReturnType<CompetitorStore["changes"]> };
  compareProduct: (id: string) => Promise<{
    configured: boolean;
    reason?: string;
    found: boolean;
    parent_sku?: string;
    segment: string | null;
    horizon_price: number | null;
    price_index: ReturnType<CompetitorStore["indexForSegment"]> | null;
    peers: ReturnType<CompetitorStore["productsInSegment"]>;
    assortment: ReturnType<CompetitorStore["assortmentGap"]> | null;
  }>;
  runSnapshot: () => Promise<{
    status: "ok" | "not_configured" | "error";
    reason?: string;
    pages: number;
    skipped_robots: number;
  }>;
  latestPages: () => { configured: boolean; pages: Array<{ host: string; url: string; status: number | null; ok: boolean }> };
};

export function createCompetitionAdapter(options: {
  db: HorizonDb;
  urls: string[];
  catalog?: CatalogAdapter;
  fetchImpl?: typeof fetch;
}): CompetitionAdapter {
  const urls = parseCompetitorUrls(options.urls.join(","));
  const extraHosts = extraAllowedHosts(urls);
  const fetchImpl = options.fetchImpl ?? fetch;
  const store = createCompetitorStore(options.db);

  function configuredReason(): { configured: boolean; reason?: string } {
    if (!urls.length) return { configured: false, reason: "missing_competitor_urls" };
    return { configured: true };
  }

  async function readRobots(origin: string, cache: Map<string, string | null>): Promise<string | null> {
    if (cache.has(origin)) return cache.get(origin) ?? null;
    try {
      const response = await allowlistedFetch(
        `${origin}/robots.txt`,
        extraHosts,
        { timeoutMs: 8_000, headers: { "user-agent": UA } },
        fetchImpl,
      );
      const text = response.ok ? await response.text() : null;
      cache.set(origin, text);
      return text;
    } catch {
      cache.set(origin, null);
      return null;
    }
  }

  async function readJson(url: string): Promise<unknown | null> {
    try {
      const response = await allowlistedFetch(url, extraHosts, { timeoutMs: 12_000, headers: { "user-agent": UA } }, fetchImpl);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  return {
    list() {
      const cfg = configuredReason();
      const snapshots = store.latest();
      return {
        ...cfg,
        store_id: STORE_ID,
        fetched_at: snapshots[0]?.checked_at ?? null,
        snapshots,
      };
    },
    get(url) {
      const cfg = configuredReason();
      const snapshot = store.latestForUrl(url);
      return {
        ...cfg,
        reason: snapshot ? cfg.reason : cfg.reason ?? "snapshot_not_found",
        snapshot,
        products: snapshot ? store.productsOf(snapshot.id) : [],
      };
    },
    changes() {
      const cfg = configuredReason();
      return { ...cfg, changes: store.changes() };
    },
    async compareProduct(id) {
      const cfg = configuredReason();
      const product = options.catalog ? await options.catalog.getProduct(id) : null;
      if (!product) {
        return { ...cfg, found: false, segment: null, horizon_price: null, price_index: null, peers: [], assortment: null };
      }
      const segment = segmentForUrl("", product.categories.map((row) => `${row.slug} ${row.name}`).join(" "))
        ?? product.categories[0]?.slug
        ?? null;
      const horizonPrice = product.price.amount != null ? Number(product.price.amount) : null;
      const peers = segment ? store.productsInSegment(segment) : [];
      return {
        ...cfg,
        found: true,
        parent_sku: product.parent_sku,
        segment,
        horizon_price: Number.isFinite(horizonPrice) ? horizonPrice : null,
        price_index: segment ? store.indexForSegment(segment, Number.isFinite(horizonPrice) ? horizonPrice : null) : null,
        peers: peers.slice(0, 30),
        assortment: segment ? store.assortmentGap(segment, [product.name]) : null,
      };
    },
    latestPages() {
      const cfg = configuredReason();
      const snapshots = store.latest();
      return {
        configured: cfg.configured && snapshots.length > 0,
        pages: snapshots.map((row) => ({
          host: (() => {
            try {
              return new URL(row.url).host;
            } catch {
              return row.competitor;
            }
          })(),
          url: row.url,
          status: row.status,
          ok: !row.error && (row.status == null || row.status < 400) && row.robots_allowed !== false,
        })),
      };
    },
    async runSnapshot() {
      if (!urls.length) return { status: "not_configured", reason: "missing_competitor_urls", pages: 0, skipped_robots: 0 };
      const robotsCache = new Map<string, string | null>();
      let skipped = 0;
      let errors = 0;
      const checkedAt = Date.now();
      for (const url of urls) {
        const parsed = new URL(url);
        const competitor = competitorFromHost(parsed.host);
        const robots = await readRobots(parsed.origin, robotsCache);
        const allow = robotsAllows(robots, parsed.pathname || "/");
        if (allow.allowed === false) {
          skipped += 1;
          store.saveSnapshot({
            competitor,
            segment: segmentForUrl(url),
            url,
            checkedAt,
            status: null,
            page: null,
            robotsAllowed: false,
            error: `robots_disallow:${allow.rule}`,
          });
          continue;
        }
        try {
          let response = await allowlistedFetch(url, extraHosts, { timeoutMs: 12_000, headers: { "user-agent": UA }, redirect: "manual" }, fetchImpl);
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (location) {
              response = await allowlistedFetch(new URL(location, url).toString(), extraHosts, { timeoutMs: 12_000, headers: { "user-agent": UA }, redirect: "manual" }, fetchImpl);
            }
          }
          const html = (await response.text()).slice(0, 400_000);
          const shopifyUrl = shopifyCollectionJsonUrl(url);
          const shopifyJson = shopifyUrl ? await readJson(shopifyUrl) : null;
          const page: ExtractedPage = extractPage(html, shopifyJson, url);
          store.saveSnapshot({
            competitor,
            segment: segmentForUrl(url, `${page.title} ${page.h1}`),
            url,
            checkedAt,
            status: response.status,
            page,
            robotsAllowed: allow.allowed,
            error: response.ok ? undefined : `http_${response.status}`,
          });
          if (!response.ok) errors += 1;
        } catch (error) {
          errors += 1;
          store.saveSnapshot({
            competitor,
            segment: segmentForUrl(url),
            url,
            checkedAt,
            status: null,
            page: null,
            robotsAllowed: allow.allowed,
            error: error instanceof Error ? error.message : "fetch_failed",
          });
        }
      }
      return { status: errors === urls.length ? "error" : "ok", pages: urls.length, skipped_robots: skipped };
    },
  };
}

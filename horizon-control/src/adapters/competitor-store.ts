import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { HorizonDb } from "../db/client.js";
import { competitorProductHistory, competitorProducts, competitorSnapshots } from "../db/schema.js";
import { priceIndex, priceStats, productKey, type ExtractedPage, type ExtractedProduct } from "./competitor-extract.js";

const STORE_ID = "horizon-fit";

export type StoredSnapshot = {
  id: string;
  competitor: string;
  segment: string | null;
  url: string;
  checked_at: string;
  status: number | null;
  title: string;
  description: string;
  h1: string;
  product_count: number | null;
  price_min: number | null;
  price_max: number | null;
  robots_allowed: boolean | null;
  extractor: string | null;
  error: string | null;
};

export type StoredProduct = {
  product_key: string;
  product_id: string | null;
  product_url: string | null;
  title: string;
  price: number | null;
  compare_at: number | null;
  currency: string | null;
};

export type CompetitorChange = {
  type: "new" | "removed" | "price_up" | "price_down" | "promo_change" | "title_change" | "h1_change";
  url: string;
  product_key?: string;
  title?: string;
  before?: string | number | null;
  after?: string | number | null;
};

export function createCompetitorStore(db: HorizonDb) {
  function saveSnapshot(input: {
    competitor: string;
    segment: string | null;
    url: string;
    checkedAt: number;
    status: number | null;
    page: ExtractedPage | null;
    robotsAllowed: boolean | null;
    error?: string;
  }): StoredSnapshot {
    const products = input.page?.products ?? [];
    const stats = priceStats(products.map((row) => row.price).filter((value): value is number => value != null));
    const id = randomUUID();
    db.insert(competitorSnapshots)
      .values({
        id,
        storeId: STORE_ID,
        competitor: input.competitor,
        segment: input.segment,
        url: input.url,
        checkedAt: input.checkedAt,
        status: input.status,
        title: input.page?.title ?? "",
        description: input.page?.description ?? "",
        h1: input.page?.h1 ?? "",
        productCount: products.length ? products.length : null,
        priceMin: stats.min,
        priceMax: stats.max,
        robotsAllowed: input.robotsAllowed == null ? null : input.robotsAllowed ? 1 : 0,
        extractor: input.page?.extractor ?? null,
        error: input.error ?? null,
      })
      .run();
    for (const product of products) {
      const key = productKey(product);
      if (!key) continue;
      db.insert(competitorProducts)
        .values({
          id: randomUUID(),
          snapshotId: id,
          storeId: STORE_ID,
          competitor: input.competitor,
          segment: input.segment,
          url: input.url,
          productUrl: product.product_url,
          productId: product.product_id,
          title: product.title,
          price: product.price,
          compareAt: product.compare_at,
          currency: product.currency,
          inStock: product.in_stock == null ? null : product.in_stock ? 1 : 0,
          checkedAt: input.checkedAt,
        })
        .run();
      db.insert(competitorProductHistory)
        .values({
          storeId: STORE_ID,
          competitor: input.competitor,
          productKey: key,
          checkedAt: input.checkedAt,
          title: product.title,
          price: product.price,
          compareAt: product.compare_at,
          currency: product.currency,
          inStock: product.in_stock == null ? null : product.in_stock ? 1 : 0,
        })
        .onConflictDoNothing()
        .run();
    }
    return getSnapshot(id)!;
  }

  function getSnapshot(id: string): StoredSnapshot | null {
    const row = db.select().from(competitorSnapshots).where(eq(competitorSnapshots.id, id)).get();
    return row ? asSnapshot(row) : null;
  }

  function latest(): StoredSnapshot[] {
    const rows = db.select().from(competitorSnapshots).orderBy(desc(competitorSnapshots.checkedAt)).all();
    const seen = new Set<string>();
    const out: StoredSnapshot[] = [];
    for (const row of rows) {
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      out.push(asSnapshot(row));
    }
    return out;
  }

  function latestForUrl(url: string): StoredSnapshot | null {
    const row = db
      .select()
      .from(competitorSnapshots)
      .where(eq(competitorSnapshots.url, url))
      .orderBy(desc(competitorSnapshots.checkedAt))
      .get();
    return row ? asSnapshot(row) : null;
  }

  function previousForUrl(url: string, beforeId: string): StoredSnapshot | null {
    const rows = db
      .select()
      .from(competitorSnapshots)
      .where(eq(competitorSnapshots.url, url))
      .orderBy(desc(competitorSnapshots.checkedAt))
      .all();
    const next = rows.find((row) => row.id !== beforeId);
    return next ? asSnapshot(next) : null;
  }

  function productsOf(snapshotId: string): StoredProduct[] {
    return db
      .select()
      .from(competitorProducts)
      .where(eq(competitorProducts.snapshotId, snapshotId))
      .all()
      .map((row) => ({
        product_key: row.productId || row.productUrl || (row.title ?? ""),
        product_id: row.productId,
        product_url: row.productUrl,
        title: row.title ?? "",
        price: row.price,
        compare_at: row.compareAt,
        currency: row.currency,
      }));
  }

  function productsInSegment(segment: string): StoredProduct[] {
    const snaps = latest().filter((row) => row.segment === segment);
    return snaps.flatMap((snap) => productsOf(snap.id));
  }

  function diffSnapshots(current: StoredSnapshot, previous: StoredSnapshot | null): CompetitorChange[] {
    const changes: CompetitorChange[] = [];
    if (!previous) return changes;
    if ((current.title || "") !== (previous.title || "")) {
      changes.push({ type: "title_change", url: current.url, before: previous.title, after: current.title });
    }
    if ((current.h1 || "") !== (previous.h1 || "")) {
      changes.push({ type: "h1_change", url: current.url, before: previous.h1, after: current.h1 });
    }
    const now = productsOf(current.id);
    const then = productsOf(previous.id);
    const nowMap = new Map(now.map((row) => [row.product_key.toLowerCase(), row]));
    const thenMap = new Map(then.map((row) => [row.product_key.toLowerCase(), row]));
    for (const [key, product] of nowMap) {
      const older = thenMap.get(key);
      if (!older) {
        changes.push({ type: "new", url: current.url, product_key: key, title: product.title, after: product.price });
        continue;
      }
      if (product.price != null && older.price != null && product.price !== older.price) {
        changes.push({
          type: product.price > older.price ? "price_up" : "price_down",
          url: current.url,
          product_key: key,
          title: product.title,
          before: older.price,
          after: product.price,
        });
      }
      if ((product.compare_at ?? null) !== (older.compare_at ?? null)) {
        changes.push({
          type: "promo_change",
          url: current.url,
          product_key: key,
          title: product.title,
          before: older.compare_at,
          after: product.compare_at,
        });
      }
    }
    for (const [key, product] of thenMap) {
      if (!nowMap.has(key)) {
        changes.push({ type: "removed", url: current.url, product_key: key, title: product.title, before: product.price });
      }
    }
    return changes;
  }

  function changes(): CompetitorChange[] {
    return latest().flatMap((snap) => diffSnapshots(snap, previousForUrl(snap.url, snap.id)));
  }

  function indexForSegment(segment: string, horizonPrice: number | null) {
    const prices = productsInSegment(segment)
      .map((row) => row.price)
      .filter((value): value is number => value != null);
    return { segment, ...priceIndex(horizonPrice, prices) };
  }

  function assortmentGap(segment: string, horizonNames: string[]) {
    const peers = productsInSegment(segment);
    const hay = horizonNames.map((name) => name.toLowerCase());
    const unmatched = peers.filter((row) => {
      const title = row.title.toLowerCase();
      return title && !hay.some((name) => name.includes(title) || title.includes(name));
    });
    return {
      segment,
      horizon_count: horizonNames.length,
      competitor_count: peers.length,
      unmatched_titles: unmatched.map((row) => row.title).slice(0, 20),
    };
  }

  return {
    saveSnapshot,
    latest,
    latestForUrl,
    previousForUrl,
    productsOf,
    productsInSegment,
    diffSnapshots,
    changes,
    indexForSegment,
    assortmentGap,
  };
}

function asSnapshot(row: typeof competitorSnapshots.$inferSelect): StoredSnapshot {
  return {
    id: row.id,
    competitor: row.competitor,
    segment: row.segment,
    url: row.url,
    checked_at: new Date(row.checkedAt).toISOString(),
    status: row.status,
    title: row.title ?? "",
    description: row.description ?? "",
    h1: row.h1 ?? "",
    product_count: row.productCount,
    price_min: row.priceMin,
    price_max: row.priceMax,
    robots_allowed: row.robotsAllowed == null ? null : Boolean(row.robotsAllowed),
    extractor: row.extractor,
    error: row.error,
  };
}

export type CompetitorStore = ReturnType<typeof createCompetitorStore>;

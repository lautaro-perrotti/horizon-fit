import type { CatalogProduct } from "../types.js";
import type { CatalogAdapter } from "./woo.js";
import type { CommerceAdapter, CommerceSales, ProductSalesRollup } from "./commerce.js";
import type { AnalyticsAdapter, Ga4ProductReport, GscProductReport } from "./analytics.js";
import { resolveProductIdentity, type ProductIdentity } from "./product-identity.js";
import {
  errorSlice,
  isoDay,
  notConfiguredSlice,
  notJoinedSlice,
  okSlice,
  withStaleness,
  unknownSlice,
  zeroSlice,
  type SourceSlice,
} from "../core/slice.js";

export type { SourceSlice, SliceStatus, JoinConfidence } from "../core/slice.js";

const STORE_ID = "horizon-fit";
const SALES_STALE_MS = 10 * 60_000;
const GA4_STALE_MS = 2 * 3_600_000;
const GSC_STALE_MS = 36 * 3_600_000;

export type DeterministicInsight = {
  type: string;
  severity: "info" | "warning" | "critical";
  entity: string;
  metrics: Record<string, number | string | null>;
  reason: string;
  source: string;
  period: string;
};

export type ProductInsight = {
  found: true;
  store_id: string;
  keys: ProductIdentity;
  catalog: SourceSlice<{
    name: string;
    price: { amount: string | null; currency: string };
    stock_status: string;
    variants: Array<{ sku: string; size: string | null; in_stock: boolean }>;
    categories: string[];
    images: string[];
  }>;
  sales: SourceSlice<{
    currency: string;
    d7: ProductSalesRollup["d7"] | null;
    d30: ProductSalesRollup["d30"] | null;
    d90: ProductSalesRollup["d90"] | null;
    last_sale_at: string | null;
    velocity_30d: number | null;
    orders: number | null;
    units: number | null;
    revenue: number | null;
    aov: number | null;
  }>;
  analytics: SourceSlice<{
    period: "28d";
    join: { item_id: string | null; page_path: string | null };
    pdp_views: number | null;
    view_item: number | null;
    add_to_cart: number | null;
    begin_checkout: number | null;
    purchase: number | null;
    purchase_revenue: number | null;
    atc_rate: number | null;
    checkout_rate: number | null;
    cvr: number | null;
  }>;
  search: SourceSlice<{
    page: string | null;
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    position: number | null;
    queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  }>;
  seo: SourceSlice<null>;
  merchant: SourceSlice<null>;
  competition: SourceSlice<null>;
  insights: DeterministicInsight[];
};

export type InsightsAdapter = {
  getProduct: (id: string | number) => Promise<ProductInsight | null>;
};

function variantSize(sku: string, parent: string): string | null {
  if (!sku.startsWith(parent) || sku.length <= parent.length + 1) return null;
  return sku.slice(parent.length + 1) || null;
}

export function catalogSlice(product: CatalogProduct, fetched_at: string): ProductInsight["catalog"] {
  return okSlice(
    "woo_store_api",
    {
      name: product.name,
      price: { amount: product.price.amount, currency: product.price.currency },
      stock_status: product.stock_status,
      variants: product.variations.map((row) => ({
        sku: row.sku,
        size: variantSize(row.sku, product.parent_sku) ?? row.attributes.find((attribute) => /talle|size/i.test(attribute.name))?.value ?? null,
        in_stock: row.in_stock,
      })),
      categories: product.categories.map((row) => row.slug || row.name).filter(Boolean),
      images: product.images,
    },
    { fetched_at, join_confidence: "exact" },
  );
}

export function salesSlice(sales: CommerceSales, parentSku: string): ProductInsight["sales"] {
  const source = "woo_rest_orders";
  const period = { start: isoDay(90), end: isoDay(0), label: "90d con ventanas d7/d30/d90" };
  if (!sales.configured) return notConfiguredSlice(source, sales.reason ?? "missing_woo_rest_credentials");
  if (sales.reason && !sales.fetched_at) return errorSlice(source, sales.reason, { period });
  const rollup = (sales.products ?? []).find((row) => row.parent_sku === parentSku) ?? null;
  const meta = { fetched_at: sales.fetched_at, period, join_confidence: "exact" as const, stale_after_ms: SALES_STALE_MS };
  if (!rollup) {
    if (sales.incomplete) {
      return unknownSlice(source, "orders_page_cap", { ...meta, join_confidence: "none" });
    }
    return zeroSlice(
      source,
      {
        currency: sales.currency,
        d7: null,
        d30: null,
        d90: null,
        last_sale_at: null,
        velocity_30d: null,
        orders: 0,
        units: 0,
        revenue: 0,
        aov: null,
      },
      meta,
    );
  }
  const data = {
    currency: sales.currency,
    d7: rollup.d7,
    d30: rollup.d30,
    d90: rollup.d90,
    last_sale_at: rollup.last_sale_at,
    velocity_30d: rollup.velocity_30d,
    orders: rollup.d30.orders,
    units: rollup.d30.units,
    revenue: rollup.d30.revenue,
    aov: rollup.d30.aov,
  };
  const anyActivity = rollup.d90.units > 0 || rollup.d90.orders > 0;
  return anyActivity ? okSlice(source, data, { ...meta, reason: sales.reason }) : zeroSlice(source, data, meta);
}

export function analyticsSlice(report: Ga4ProductReport, fetched_at: string): ProductInsight["analytics"] {
  const source = "ga4";
  const period = { start: isoDay(28), end: isoDay(0), label: "28d" };
  if (!report.configured) return notConfiguredSlice(source, report.reason ?? "missing_google_credentials");
  if (!report.ok && report.pdp_views == null && report.view_item == null) {
    return errorSlice(source, report.reason ?? "ga4_error", { fetched_at, period });
  }
  if (!report.join.item_id && !report.join.page_path) {
    return unknownSlice(source, report.reason ?? "ga4_join_unavailable", { fetched_at, period });
  }
  const data = {
    period: report.period,
    join: report.join,
    pdp_views: report.pdp_views,
    view_item: report.view_item,
    add_to_cart: report.add_to_cart,
    begin_checkout: report.begin_checkout,
    purchase: report.purchase,
    purchase_revenue: report.purchase_revenue,
    atc_rate: report.atc_rate,
    checkout_rate: report.checkout_rate,
    cvr: report.cvr,
  };
  const meta = {
    fetched_at,
    period,
    join_confidence: (report.join.item_id ? "exact" : "inferred") as "exact" | "inferred",
    stale_after_ms: GA4_STALE_MS,
    reason: report.ok ? undefined : report.reason,
  };
  const activity = (report.pdp_views ?? 0) + (report.view_item ?? 0) + (report.add_to_cart ?? 0) + (report.purchase ?? 0);
  return activity > 0 ? okSlice(source, data, meta) : zeroSlice(source, data, meta);
}

export function searchSlice(report: GscProductReport, fetched_at: string): ProductInsight["search"] {
  const source = "gsc";
  const period = { start: report.start_date, end: report.end_date, label: "28d" };
  if (!report.configured) return notConfiguredSlice(source, report.reason ?? "missing_google_credentials");
  if (!report.ok) {
    if (report.reason === "missing_canonical_url") return unknownSlice(source, report.reason, { fetched_at, period });
    return errorSlice(source, report.reason ?? "gsc_error", { fetched_at, period });
  }
  const data = {
    page: report.page,
    clicks: report.clicks,
    impressions: report.impressions,
    ctr: report.ctr,
    position: report.position,
    queries: report.queries,
  };
  const meta = { fetched_at, period, join_confidence: "exact" as const, stale_after_ms: GSC_STALE_MS };
  const activity = (report.clicks ?? 0) + (report.impressions ?? 0);
  return activity > 0 ? okSlice(source, data, meta) : zeroSlice(source, data, meta);
}

export function createInsightsAdapter(options: {
  catalog: CatalogAdapter;
  commerce: CommerceAdapter;
  analytics: AnalyticsAdapter;
}): InsightsAdapter {
  return {
    async getProduct(id) {
      const resolved = await resolveProductIdentity(options.catalog, String(id));
      if (!resolved) return null;
      const fetched_at = new Date().toISOString();
      const itemIds = [
        resolved.identity.parent_sku,
        resolved.identity.variant_sku,
        ...resolved.product.variations.map((row) => row.sku),
        resolved.identity.product_id != null ? String(resolved.identity.product_id) : null,
      ].filter((value): value is string => Boolean(value));
      const [sales, ga4, gsc] = await Promise.all([
        options.commerce.sales(),
        options.analytics.ga4Product({
          parent_sku: resolved.identity.parent_sku,
          page_path: resolved.identity.canonical_url,
          item_ids: itemIds,
        }),
        options.analytics.gscProduct({
          page_url: resolved.identity.canonical_url,
          slug: resolved.identity.slug,
        }),
      ]);
      return {
        found: true,
        store_id: STORE_ID,
        keys: resolved.identity,
        catalog: catalogSlice(resolved.product, fetched_at),
        sales: withStaleness(salesSlice(sales, resolved.identity.parent_sku)),
        analytics: withStaleness(analyticsSlice(ga4, fetched_at)),
        search: withStaleness(searchSlice(gsc, fetched_at)),
        seo: notJoinedSlice("seo_audit"),
        merchant: notJoinedSlice("merchant_feed"),
        competition: notJoinedSlice("competitors"),
        insights: [],
      };
    },
  };
}

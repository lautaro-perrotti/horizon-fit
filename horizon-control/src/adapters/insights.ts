import type { CatalogProduct } from "../types.js";
import type { CatalogAdapter } from "./woo.js";
import type { CommerceAdapter, ProductSalesRollup } from "./commerce.js";
import type { AnalyticsAdapter, Ga4ProductReport, GscProductReport } from "./analytics.js";
import { resolveProductIdentity, type ProductIdentity } from "./product-identity.js";

const STORE_ID = "horizon-fit";

export type SourceSlice<T> = {
  available: boolean;
  configured: boolean;
  reason?: string;
  fetched_at: string | null;
  data: T | null;
};

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

function unavailable(reason: string): SourceSlice<null> {
  return { available: false, configured: false, reason, fetched_at: null, data: null };
}

function variantSize(sku: string, parent: string): string | null {
  if (!sku.startsWith(parent) || sku.length <= parent.length + 1) return null;
  return sku.slice(parent.length + 1) || null;
}

function catalogSlice(product: CatalogProduct, fetched_at: string): ProductInsight["catalog"] {
  return {
    available: true,
    configured: true,
    fetched_at,
    data: {
      name: product.name,
      price: { amount: product.price.amount, currency: product.price.currency },
      stock_status: product.stock_status,
      variants: product.variations.map((row) => ({
        sku: row.sku,
        size: variantSize(row.sku, product.parent_sku) ?? row.attributes.find((attribute) => /talle|size/i.test(attribute.name))?.value ?? null,
        in_stock: row.in_stock,
      })),
      categories: product.categories.map((row) => row.slug || row.name).filter(Boolean),
    },
  };
}

function analyticsSlice(report: Ga4ProductReport, fetched_at: string): ProductInsight["analytics"] {
  if (!report.configured) {
    return {
      available: false,
      configured: false,
      reason: report.reason ?? "missing_google_credentials",
      fetched_at: null,
      data: null,
    };
  }
  return {
    available: true,
    configured: true,
    reason: report.ok ? undefined : report.reason,
    fetched_at,
    data: {
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
    },
  };
}

function searchSlice(report: GscProductReport, fetched_at: string): ProductInsight["search"] {
  if (!report.configured) {
    return {
      available: false,
      configured: false,
      reason: report.reason ?? "missing_google_credentials",
      fetched_at: null,
      data: null,
    };
  }
  return {
    available: true,
    configured: true,
    reason: report.ok ? undefined : report.reason,
    fetched_at,
    data: {
      page: report.page,
      clicks: report.clicks,
      impressions: report.impressions,
      ctr: report.ctr,
      position: report.position,
      queries: report.queries,
    },
  };
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
      const rollup = (sales.products ?? []).find((row) => row.parent_sku === resolved.identity.parent_sku) ?? null;
      const salesSlice: ProductInsight["sales"] = !sales.configured
        ? {
            available: false,
            configured: false,
            reason: sales.reason ?? "missing_woo_rest_credentials",
            fetched_at: sales.fetched_at,
            data: null,
          }
        : {
            available: true,
            configured: true,
            fetched_at: sales.fetched_at,
            data: {
              currency: sales.currency,
              d7: rollup?.d7 ?? null,
              d30: rollup?.d30 ?? null,
              d90: rollup?.d90 ?? null,
              last_sale_at: rollup?.last_sale_at ?? null,
              velocity_30d: rollup?.velocity_30d ?? null,
              orders: rollup?.d30.orders ?? 0,
              units: rollup?.d30.units ?? 0,
              revenue: rollup?.d30.revenue ?? null,
              aov: rollup?.d30.aov ?? null,
            },
          };
      return {
        found: true,
        store_id: STORE_ID,
        keys: resolved.identity,
        catalog: catalogSlice(resolved.product, fetched_at),
        sales: salesSlice,
        analytics: analyticsSlice(ga4, fetched_at),
        search: searchSlice(gsc, fetched_at),
        seo: unavailable("not_joined_yet"),
        merchant: unavailable("not_joined_yet"),
        competition: unavailable("not_joined_yet"),
        insights: [],
      };
    },
  };
}

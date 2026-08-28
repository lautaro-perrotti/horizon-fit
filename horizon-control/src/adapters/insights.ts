import type { CatalogProduct } from "../types.js";
import type { CatalogAdapter } from "./woo.js";
import type { CommerceAdapter, ProductSalesRollup } from "./commerce.js";
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
  analytics: SourceSlice<null>;
  search: SourceSlice<null>;
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

export function createInsightsAdapter(options: {
  catalog: CatalogAdapter;
  commerce: CommerceAdapter;
}): InsightsAdapter {
  return {
    async getProduct(id) {
      const resolved = await resolveProductIdentity(options.catalog, String(id));
      if (!resolved) return null;
      const fetched_at = new Date().toISOString();
      const sales = await options.commerce.sales();
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
        analytics: unavailable("not_joined_yet"),
        search: unavailable("not_joined_yet"),
        seo: unavailable("not_joined_yet"),
        merchant: unavailable("not_joined_yet"),
        competition: unavailable("not_joined_yet"),
        insights: [],
      };
    },
  };
}

import type { CatalogProduct } from "../types.js";
import type { CatalogAdapter } from "./woo.js";
import type { CommerceAdapter, CommerceSales, ProductSalesRollup } from "./commerce.js";
import type { AnalyticsAdapter, Ga4ProductReport, Ga4Report, GscProductReport, GscReport } from "./analytics.js";
import { resolveProductIdentity, type ProductIdentity } from "./product-identity.js";
import type { SeoReportAdapter, SeoProductPage } from "./seo-report.js";
import { merchantItemsForProduct, type MerchantAdapter, type MerchantDiagnostics, type MerchantVariantRow } from "./merchant.js";
import { peersForSegment, segmentForCategories, type CompetitorsAdapter, type CompetitorsReport } from "./competitors.js";
import type { HealthAdapter } from "./health.js";
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
  seo: SourceSlice<{
    title: string;
    description: string;
    h1: string[];
    canonical: string;
    indexable: boolean;
    schema: string[];
    in_sitemap: boolean;
    critical: number;
    warning: number;
    issues: SeoProductPage["issues"];
    last_audit: string | null;
  }>;
  merchant: SourceSlice<{
    included: boolean;
    ready: number;
    blocked: number;
    variants: MerchantVariantRow[];
    generated_path: string | null;
  }>;
  competition: SourceSlice<{
    segment: string | null;
    peers: Array<{ competitor: string; url: string; status: number | null; title: string; ok: boolean }>;
  }>;
  insights: DeterministicInsight[];
};

export type OverviewProblem = { type: string; severity: "info" | "warning" | "critical"; title: string };

export type StoreOverview = {
  store_id: string;
  fetched_at: string;
  revenue: SourceSlice<{ currency: string; orders: number; units: number; revenue: number | null; aov: number | null }>;
  demand: SourceSlice<{ sessions: number | null; users: number | null; clicks: number | null; impressions: number | null }>;
  conversion: SourceSlice<{ sessions: number | null; purchases: number | null; cvr: number | null }>;
  opportunities: SourceSlice<{ items: DeterministicInsight[] }>;
  problems: SourceSlice<{ items: OverviewProblem[] }>;
};

export type InsightsAdapter = {
  getProduct: (id: string | number) => Promise<ProductInsight | null>;
  overview: () => Promise<StoreOverview>;
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

const SEO_STALE_MS = 36 * 3_600_000;

export function seoSlice(page: SeoProductPage | null, latestConfigured: boolean, reason?: string): ProductInsight["seo"] {
  const source = "seo_audit";
  if (!latestConfigured) return notConfiguredSlice(source, reason ?? "missing_seo_report");
  if (!page) return unknownSlice(source, "seo_page_not_in_audit", { join_confidence: "none" });
  const data = {
    title: page.title,
    description: page.description,
    h1: page.h1,
    canonical: page.canonical,
    indexable: page.indexable,
    schema: page.schema,
    in_sitemap: page.in_sitemap,
    critical: page.critical,
    warning: page.warning,
    issues: page.issues,
    last_audit: page.generated_at,
  };
  const meta = { fetched_at: page.generated_at, join_confidence: "exact" as const, stale_after_ms: SEO_STALE_MS };
  return page.critical + page.warning > 0 ? okSlice(source, data, meta) : zeroSlice(source, data, meta);
}

export function merchantSlice(diag: MerchantDiagnostics, parentSku: string, variantSkus: string[]): ProductInsight["merchant"] {
  const source = "merchant_feed";
  if (diag.source === "unavailable") return notConfiguredSlice(source, diag.error ?? "diagnostics_unavailable");
  const variants = merchantItemsForProduct(diag.productsJson, parentSku, variantSkus);
  const ready = variants.filter((row) => row.ready).length;
  const blocked = variants.filter((row) => !row.ready).length;
  const meta = { fetched_at: new Date().toISOString(), join_confidence: "exact" as const };
  if (!variants.length) return unknownSlice(source, "merchant_sku_not_in_feed", { ...meta, join_confidence: "none" });
  const data = { included: true, ready, blocked, variants, generated_path: diag.path };
  return blocked > 0 ? okSlice(source, data, meta) : zeroSlice(source, data, meta);
}

export function competitionSlice(report: CompetitorsReport, categories: string[]): ProductInsight["competition"] {
  const source = "competitors";
  if (!report.configured) return notConfiguredSlice(source, report.reason ?? "missing_competitor_urls");
  const segment = segmentForCategories(categories);
  const peers = peersForSegment(report.pages, segment).map((page) => ({
    competitor: page.host,
    url: page.url,
    status: page.status,
    title: page.title,
    ok: page.ok,
  }));
  const meta = { fetched_at: new Date().toISOString(), join_confidence: "inferred" as const };
  const data = { segment, peers };
  return peers.length ? okSlice(source, data, meta) : zeroSlice(source, data, meta);
}

export function overviewFromSources(input: {
  sales: CommerceSales;
  ga4: Ga4Report;
  gsc: GscReport;
  seoConfigured: boolean;
  seoCritical: number;
  merchantBlocked: number | null;
  merchantAvailable: boolean;
  storefrontOk: boolean;
}): StoreOverview {
  const fetched_at = new Date().toISOString();
  const revenue = !input.sales.configured
    ? notConfiguredSlice<StoreOverview["revenue"] extends SourceSlice<infer T> ? T : never>(
        "woo_rest_orders",
        input.sales.reason ?? "missing_woo_rest_credentials",
      )
    : okSlice(
        "woo_rest_orders",
        {
          currency: input.sales.currency,
          orders: input.sales.month.orders,
          units: input.sales.month.units,
          revenue: input.sales.month.revenue,
          aov: input.sales.month.aov,
        },
        { fetched_at: input.sales.fetched_at, period: { start: isoDay(30), end: isoDay(0), label: "30d" } },
      );
  const demandConfigured = input.ga4.configured || input.gsc.configured;
  const demand = !demandConfigured
    ? notConfiguredSlice<StoreOverview["demand"] extends SourceSlice<infer T> ? T : never>(
        "ga4+gsc",
        input.ga4.reason ?? input.gsc.reason ?? "missing_google_credentials",
      )
    : okSlice(
        "ga4+gsc",
        {
          sessions: input.ga4.ok ? input.ga4.sessions : null,
          users: input.ga4.ok ? input.ga4.users : null,
          clicks: input.gsc.ok ? input.gsc.clicks : null,
          impressions: input.gsc.ok ? input.gsc.impressions : null,
        },
        { fetched_at },
      );
  const conversion =
    input.ga4.configured && input.ga4.ok && input.ga4.sessions != null && input.ga4.purchases != null
      ? input.ga4.sessions > 0
        ? okSlice(
            "ga4",
            { sessions: input.ga4.sessions, purchases: input.ga4.purchases, cvr: input.ga4.purchases / input.ga4.sessions },
            { fetched_at },
          )
        : zeroSlice("ga4", { sessions: input.ga4.sessions, purchases: input.ga4.purchases, cvr: null }, { fetched_at })
      : unknownSlice<StoreOverview["conversion"] extends SourceSlice<infer T> ? T : never>(
          "ga4",
          "conversion_needs_ga4_sessions_and_purchases",
        );
  const problems: OverviewProblem[] = [];
  if (!input.storefrontOk) problems.push({ type: "storefront_down", severity: "critical", title: "Storefront no responde" });
  if (input.seoConfigured && input.seoCritical > 0) {
    problems.push({ type: "seo_critical", severity: "critical", title: `${input.seoCritical} issues críticos de SEO` });
  }
  if (input.merchantAvailable && (input.merchantBlocked ?? 0) > 0) {
    problems.push({ type: "merchant_blocked", severity: "warning", title: `${input.merchantBlocked} variantes bloqueadas en Merchant` });
  }
  return {
    store_id: STORE_ID,
    fetched_at,
    revenue,
    demand,
    conversion,
    opportunities: notJoinedSlice("growth_engine", "growth_engine_not_shipped"),
    problems: problems.length ? okSlice("warehouse", { items: problems }, { fetched_at }) : zeroSlice("warehouse", { items: [] }, { fetched_at }),
  };
}

export function createInsightsAdapter(options: {
  catalog: CatalogAdapter;
  commerce: CommerceAdapter;
  analytics: AnalyticsAdapter;
  seo?: SeoReportAdapter;
  merchant?: MerchantAdapter;
  competitors?: CompetitorsAdapter;
  health?: HealthAdapter;
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
      const [sales, ga4, gsc, merchant, competitors] = await Promise.all([
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
        options.merchant ? options.merchant.readDiagnostics() : Promise.resolve(null),
        options.competitors ? options.competitors.snapshot() : Promise.resolve(null),
      ]);
      const seoLatest = options.seo?.readLatest();
      const seoPage = options.seo?.pageFor(resolved.identity.slug, resolved.identity.canonical_url) ?? null;
      const categories = resolved.product.categories.map((row) => row.slug || row.name).filter(Boolean);
      const variantSkus = resolved.product.variations.map((row) => row.sku);
      return {
        found: true,
        store_id: STORE_ID,
        keys: resolved.identity,
        catalog: catalogSlice(resolved.product, fetched_at),
        sales: withStaleness(salesSlice(sales, resolved.identity.parent_sku)),
        analytics: withStaleness(analyticsSlice(ga4, fetched_at)),
        search: withStaleness(searchSlice(gsc, fetched_at)),
        seo: withStaleness(seoSlice(seoPage, Boolean(seoLatest?.configured), seoLatest?.reason)),
        merchant: merchant
          ? merchantSlice(merchant, resolved.identity.parent_sku, variantSkus)
          : notJoinedSlice("merchant_feed"),
        competition: competitors ? competitionSlice(competitors, categories) : notJoinedSlice("competitors"),
        insights: [],
      };
    },
    async overview() {
      const [sales, ga4, gsc, merchant, health] = await Promise.all([
        options.commerce.sales(),
        options.analytics.ga4(),
        options.analytics.searchConsole(),
        options.merchant ? options.merchant.readDiagnostics() : Promise.resolve(null),
        options.health ? options.health.report() : Promise.resolve(null),
      ]);
      const seo = options.seo?.readLatest();
      return overviewFromSources({
        sales,
        ga4,
        gsc,
        seoConfigured: Boolean(seo?.configured),
        seoCritical: seo?.summary?.totals.critical ?? 0,
        merchantBlocked: merchant && merchant.source !== "unavailable" ? merchant.summary.blocked : null,
        merchantAvailable: Boolean(merchant && merchant.source !== "unavailable"),
        storefrontOk: health?.storefront.ok ?? true,
      });
    },
  };
}

import { allowlistedFetch } from "../http/allowlist.js";
import { GA4_READONLY, GOOGLE_API_HOSTS, GSC_READONLY, googleAccessToken, loadGoogleServiceAccount, type GoogleServiceAccount } from "./google-sa.js";

const STORE_ID = "horizon-fit";

export const GSC_SITE_ALLOWLIST = [
  "https://horizonfit.com.ar/",
  "https://horizonfit.com.ar",
  "https://www.horizonfit.com.ar/",
  "https://www.horizonfit.com.ar",
  "sc-domain:horizonfit.com.ar",
];

export type GscQueryRow = { query: string; clicks: number; impressions: number; ctr: number; position: number };

export type GscReport = {
  configured: boolean;
  ok: boolean;
  reason?: string;
  store_id: string;
  site_url: string;
  start_date: string;
  end_date: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  queries: GscQueryRow[];
};

export type Ga4Channel = { channel: string; sessions: number };

export type Ga4Report = {
  configured: boolean;
  ok: boolean;
  reason?: string;
  store_id: string;
  property_id: string;
  sessions: number | null;
  users: number | null;
  purchases: number | null;
  channels: Ga4Channel[];
};

export type Ga4ProductRef = {
  parent_sku: string;
  page_path?: string | null;
  item_ids?: string[];
};

export type Ga4ProductReport = {
  configured: boolean;
  ok: boolean;
  reason?: string;
  store_id: string;
  property_id: string;
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
};

export type GscProductRef = {
  page_url?: string | null;
  slug?: string | null;
};

export type GscProductReport = {
  configured: boolean;
  ok: boolean;
  reason?: string;
  store_id: string;
  site_url: string;
  page: string | null;
  start_date: string;
  end_date: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  queries: GscQueryRow[];
};

export type AnalyticsAdapter = {
  searchConsole: () => Promise<GscReport>;
  ga4: () => Promise<Ga4Report>;
  ga4Product: (ref: Ga4ProductRef) => Promise<Ga4ProductReport>;
  gscProduct: (ref: GscProductRef) => Promise<GscProductReport>;
};

const GA4_PRODUCT_TTL_MS = 30 * 60 * 1000;
const GSC_PRODUCT_TTL_MS = 12 * 60 * 60 * 1000;

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function emptyGsc(reason: string, site: string): GscReport {
  return {
    configured: false,
    ok: false,
    reason,
    store_id: STORE_ID,
    site_url: site,
    start_date: isoDate(28),
    end_date: isoDate(0),
    clicks: null,
    impressions: null,
    ctr: null,
    position: null,
    queries: [],
  };
}

function emptyGa4(reason: string, propertyId: string): Ga4Report {
  return {
    configured: false,
    ok: false,
    reason,
    store_id: STORE_ID,
    property_id: propertyId,
    sessions: null,
    users: null,
    purchases: null,
    channels: [],
  };
}

function metric(row: { metricValues?: Array<{ value?: string }> } | undefined, index: number): number | null {
  const raw = row?.metricValues?.[index]?.value;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function normalizeGscSite(raw: string): string {
  const trimmed = raw.trim() || "https://horizonfit.com.ar/";
  if (GSC_SITE_ALLOWLIST.includes(trimmed) || GSC_SITE_ALLOWLIST.includes(trimmed.replace(/\/$/, ""))) {
    return trimmed.endsWith("/") || trimmed.startsWith("sc-domain:") ? trimmed : `${trimmed}/`;
  }
  return "https://horizonfit.com.ar/";
}

export function pagePathFromUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!url.hostname.toLowerCase().endsWith("horizonfit.com.ar")) return null;
    const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    return path.startsWith("/product/") ? path : null;
  } catch {
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    const normalized = path.endsWith("/") ? path : `${path}/`;
    return normalized.startsWith("/product/") ? normalized : null;
  }
}

function uniqueIds(values: Array<string | number | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const id = String(value ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 20) break;
  }
  return out;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return numerator / denominator;
}

function emptyGa4Product(reason: string, propertyId: string): Ga4ProductReport {
  return {
    configured: false,
    ok: false,
    reason,
    store_id: STORE_ID,
    property_id: propertyId,
    period: "28d",
    join: { item_id: null, page_path: null },
    pdp_views: null,
    view_item: null,
    add_to_cart: null,
    begin_checkout: null,
    purchase: null,
    purchase_revenue: null,
    atc_rate: null,
    checkout_rate: null,
    cvr: null,
  };
}

function emptyGscProduct(reason: string, site: string, page: string | null): GscProductReport {
  return {
    configured: false,
    ok: false,
    reason,
    store_id: STORE_ID,
    site_url: site,
    page,
    start_date: isoDate(28),
    end_date: isoDate(0),
    clicks: null,
    impressions: null,
    ctr: null,
    position: null,
    queries: [],
  };
}

export function createAnalyticsAdapter(options: {
  saPath?: string;
  saJson?: string;
  gscSiteUrl?: string;
  ga4PropertyId?: string;
  extraHosts?: string[];
  fetchImpl?: typeof fetch;
  getAccessToken?: (scopes: string[]) => Promise<string>;
}): AnalyticsAdapter {
  const extraHosts = [...GOOGLE_API_HOSTS, ...(options.extraHosts ?? [])];
  const site = normalizeGscSite(options.gscSiteUrl ?? "https://horizonfit.com.ar/");
  const propertyId = (options.ga4PropertyId ?? "").replace(/^properties\//, "").trim();
  const sa: GoogleServiceAccount | null = loadGoogleServiceAccount(options.saPath ?? "", options.saJson ?? "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const ga4ProductCache = new Map<string, { exp: number; value: Ga4ProductReport }>();
  const gscProductCache = new Map<string, { exp: number; value: GscProductReport }>();
  const googleReady = Boolean(sa || options.getAccessToken);

  async function token(scopes: string[]): Promise<string> {
    if (options.getAccessToken) return options.getAccessToken(scopes);
    if (!sa) throw new Error("missing_google_credentials");
    return googleAccessToken({ sa, scopes, extraHosts, fetchImpl });
  }

  return {
    async searchConsole() {
      if (!sa && !options.getAccessToken) return emptyGsc("missing_google_credentials", site);
      const start = isoDate(28);
      const end = isoDate(0);
      try {
        const access = await token([GSC_READONLY]);
        const encoded = encodeURIComponent(site);
        const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`;
        const [totalsRes, queriesRes] = await Promise.all([
          allowlistedFetch(
            url,
            extraHosts,
            {
              method: "POST",
              headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
              body: JSON.stringify({ startDate: start, endDate: end, rowLimit: 1 }),
              timeoutMs: 15_000,
            },
            fetchImpl,
          ),
          allowlistedFetch(
            url,
            extraHosts,
            {
              method: "POST",
              headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
              body: JSON.stringify({ startDate: start, endDate: end, dimensions: ["query"], rowLimit: 10 }),
              timeoutMs: 15_000,
            },
            fetchImpl,
          ),
        ]);
        if (!totalsRes.ok) {
          return { ...emptyGsc(`gsc_http_${totalsRes.status}`, site), configured: true, start_date: start, end_date: end };
        }
        const totalsJson = (await totalsRes.json()) as {
          rows?: Array<{ clicks?: number; impressions?: number; ctr?: number; position?: number }>;
        };
        const queriesJson = queriesRes.ok
          ? ((await queriesRes.json()) as {
              rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>;
            })
          : { rows: [] };
        const row = totalsJson.rows?.[0];
        return {
          configured: true,
          ok: true,
          store_id: STORE_ID,
          site_url: site,
          start_date: start,
          end_date: end,
          clicks: row?.clicks ?? 0,
          impressions: row?.impressions ?? 0,
          ctr: row?.ctr ?? null,
          position: row?.position ?? null,
          queries: (queriesJson.rows ?? []).slice(0, 10).map((item) => ({
            query: String(item.keys?.[0] ?? ""),
            clicks: Number(item.clicks) || 0,
            impressions: Number(item.impressions) || 0,
            ctr: Number(item.ctr) || 0,
            position: Number(item.position) || 0,
          })),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "gsc_error";
        return { ...emptyGsc(message, site), configured: Boolean(sa || options.getAccessToken), start_date: start, end_date: end };
      }
    },

    async ga4() {
      if (!sa && !options.getAccessToken) return emptyGa4("missing_google_credentials", propertyId);
      if (!propertyId) return emptyGa4("missing_ga4_property_id", "");
      try {
        const access = await token([GA4_READONLY]);
        const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
        const payload = {
          dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
          metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "ecommercePurchases" }],
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          limit: 10,
        };
        const response = await allowlistedFetch(
          url,
          extraHosts,
          {
            method: "POST",
            headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
            body: JSON.stringify(payload),
            timeoutMs: 15_000,
          },
          fetchImpl,
        );
        if (!response.ok) {
          return { ...emptyGa4(`ga4_http_${response.status}`, propertyId), configured: true };
        }
        const json = (await response.json()) as {
          rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
        };
        const rows = json.rows ?? [];
        let sessions = 0;
        let users = 0;
        let purchases = 0;
        const channels: Ga4Channel[] = [];
        for (const row of rows) {
          const s = metric(row, 0) ?? 0;
          const u = metric(row, 1) ?? 0;
          const p = metric(row, 2) ?? 0;
          sessions += s;
          users += u;
          purchases += p;
          channels.push({ channel: String(row.dimensionValues?.[0]?.value ?? "(other)"), sessions: s });
        }
        return {
          configured: true,
          ok: true,
          store_id: STORE_ID,
          property_id: propertyId,
          sessions,
          users,
          purchases,
          channels: channels.slice(0, 10),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "ga4_error";
        return { ...emptyGa4(message, propertyId), configured: true };
      }
    },

    async ga4Product(ref) {
      const pagePath = pagePathFromUrl(ref.page_path) ?? (ref.page_path?.startsWith("/product/") ? ref.page_path : null);
      const itemIds = uniqueIds([ref.parent_sku, ...(ref.item_ids ?? [])]);
      const cacheKey = `${propertyId}:${ref.parent_sku}:${pagePath ?? ""}:${itemIds.join(",")}`;
      const hit = ga4ProductCache.get(cacheKey);
      if (hit && hit.exp > Date.now()) return hit.value;

      if (!googleReady) return emptyGa4Product("missing_google_credentials", propertyId);
      if (!propertyId) return emptyGa4Product("missing_ga4_property_id", "");
      if (!pagePath && itemIds.length === 0) return emptyGa4Product("missing_product_join_keys", propertyId);

      const run = async (payload: unknown): Promise<{ status: number; json: Record<string, unknown> }> => {
        const access = await token([GA4_READONLY]);
        const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
        const response = await allowlistedFetch(
          url,
          extraHosts,
          {
            method: "POST",
            headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
            body: JSON.stringify(payload),
            timeoutMs: 15_000,
          },
          fetchImpl,
        );
        const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        return { status: response.status, json };
      };

      try {
        const viewsFilter = pagePath
          ? {
              filter: {
                fieldName: "pagePath",
                stringFilter: { matchType: "CONTAINS" as const, value: pagePath.replace(/\/$/, "") },
              },
            }
          : null;
        const viewsReq = viewsFilter
          ? run({
              dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
              dimensions: [{ name: "pagePath" }],
              metrics: [{ name: "screenPageViews" }],
              dimensionFilter: viewsFilter,
              limit: 20,
            })
          : Promise.resolve({ status: 0, json: {} as Record<string, unknown> });
        const eventsReq =
          itemIds.length > 0
            ? run({
                dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
                dimensions: [{ name: "itemId" }],
                metrics: [
                  { name: "itemsViewed" },
                  { name: "itemsAddedToCart" },
                  { name: "itemsCheckedOut" },
                  { name: "itemsPurchased" },
                  { name: "itemRevenue" },
                ],
                dimensionFilter: { filter: { fieldName: "itemId", inListFilter: { values: itemIds } } },
                limit: 50,
              })
            : Promise.resolve({ status: 0, json: {} as Record<string, unknown> });

        const [viewsRes, eventsRes] = await Promise.all([viewsReq, eventsReq]);
        const reasons: string[] = [];
        if (viewsRes.status && !String(viewsRes.status).startsWith("2") && viewsRes.status !== 0) {
          reasons.push(`ga4_views_http_${viewsRes.status}`);
        }
        if (eventsRes.status && !String(eventsRes.status).startsWith("2") && eventsRes.status !== 0) {
          reasons.push(`ga4_events_http_${eventsRes.status}`);
        }

        type Row = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> };
        const viewRows = viewsRes.status && viewsRes.status < 400 ? ((viewsRes.json.rows as Row[] | undefined) ?? []) : [];
        let pdpViews = 0;
        let joinedPath: string | null = null;
        for (const row of viewRows) {
          pdpViews += metric(row, 0) ?? 0;
          joinedPath = joinedPath ?? String(row.dimensionValues?.[0]?.value ?? pagePath ?? "");
        }
        if (pagePath && viewsRes.status >= 200 && viewsRes.status < 400) {
          joinedPath = joinedPath || pagePath;
        }

        const eventRows = eventsRes.status && eventsRes.status < 400 ? ((eventsRes.json.rows as Row[] | undefined) ?? []) : [];
        const byItem = new Map<string, Row[]>();
        for (const row of eventRows) {
          const itemId = String(row.dimensionValues?.[0]?.value ?? "");
          const list = byItem.get(itemId) ?? [];
          list.push(row);
          byItem.set(itemId, list);
        }
        const parentRows = byItem.get(ref.parent_sku) ?? [];
        const chosenRows = parentRows.length > 0 ? parentRows : eventRows;
        const joinItem = parentRows.length > 0 ? ref.parent_sku : eventRows.length > 0 ? String(eventRows[0]?.dimensionValues?.[0]?.value ?? "") : null;

        let viewItem = 0;
        let addToCart = 0;
        let checkout = 0;
        let purchase = 0;
        let purchaseRevenue = 0;
        for (const row of chosenRows) {
          viewItem += metric(row, 0) ?? 0;
          addToCart += metric(row, 1) ?? 0;
          checkout += metric(row, 2) ?? 0;
          purchase += metric(row, 3) ?? 0;
          purchaseRevenue += metric(row, 4) ?? 0;
        }
        const eventsOk = eventsRes.status >= 200 && eventsRes.status < 400;

        const views = pdpViews > 0 ? pdpViews : null;
        const viewItemN = eventsOk ? viewItem : null;
        const addToCartN = eventsOk ? addToCart : null;
        const checkoutN = eventsOk ? checkout : null;
        const purchaseN = eventsOk ? purchase : null;
        const traffic = views ?? viewItemN;
        const value: Ga4ProductReport = {
          configured: true,
          ok: reasons.length === 0,
          reason: reasons[0],
          store_id: STORE_ID,
          property_id: propertyId,
          period: "28d",
          join: { item_id: joinItem || null, page_path: joinedPath },
          pdp_views: viewsRes.status >= 200 && viewsRes.status < 400 ? pdpViews : null,
          view_item: viewItemN,
          add_to_cart: addToCartN,
          begin_checkout: checkoutN,
          purchase: purchaseN,
          purchase_revenue: eventsOk ? purchaseRevenue : null,
          atc_rate: ratio(addToCartN, traffic),
          checkout_rate: ratio(checkoutN, traffic),
          cvr: ratio(purchaseN, traffic),
        };
        ga4ProductCache.set(cacheKey, { exp: Date.now() + GA4_PRODUCT_TTL_MS, value });
        return value;
      } catch (error) {
        const message = error instanceof Error ? error.message : "ga4_error";
        return { ...emptyGa4Product(message, propertyId), configured: true };
      }
    },

    async gscProduct(ref) {
      const page = ref.page_url?.trim() || (ref.slug ? `https://horizonfit.com.ar/product/${ref.slug.replace(/^\/+|\/+$/g, "")}/` : "");
      const needle = ref.slug ? `/product/${ref.slug.replace(/^\/+|\/+$/g, "")}` : pagePathFromUrl(page);
      const cacheKey = `${site}:${needle ?? page}`;
      const hit = gscProductCache.get(cacheKey);
      if (hit && hit.exp > Date.now()) return hit.value;

      if (!googleReady) return emptyGscProduct("missing_google_credentials", site, page || null);
      if (!needle) return emptyGscProduct("missing_canonical_url", site, null);

      const start = isoDate(28);
      const end = isoDate(0);
      const filter = {
        dimensionFilterGroups: [
          {
            groupType: "and",
            filters: [{ dimension: "page", operator: "contains", expression: needle }],
          },
        ],
      };
      try {
        const access = await token([GSC_READONLY]);
        const encoded = encodeURIComponent(site);
        const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`;
        const [totalsRes, queriesRes] = await Promise.all([
          allowlistedFetch(
            url,
            extraHosts,
            {
              method: "POST",
              headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
              body: JSON.stringify({ startDate: start, endDate: end, rowLimit: 1, ...filter }),
              timeoutMs: 15_000,
            },
            fetchImpl,
          ),
          allowlistedFetch(
            url,
            extraHosts,
            {
              method: "POST",
              headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
              body: JSON.stringify({ startDate: start, endDate: end, dimensions: ["query"], rowLimit: 10, ...filter }),
              timeoutMs: 15_000,
            },
            fetchImpl,
          ),
        ]);
        if (!totalsRes.ok) {
          return {
            ...emptyGscProduct(`gsc_http_${totalsRes.status}`, site, page || needle),
            configured: true,
            start_date: start,
            end_date: end,
          };
        }
        const totalsJson = (await totalsRes.json()) as {
          rows?: Array<{ clicks?: number; impressions?: number; ctr?: number; position?: number }>;
        };
        const queriesJson = queriesRes.ok
          ? ((await queriesRes.json()) as {
              rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>;
            })
          : { rows: [] };
        const row = totalsJson.rows?.[0];
        const value: GscProductReport = {
          configured: true,
          ok: true,
          store_id: STORE_ID,
          site_url: site,
          page: page || needle,
          start_date: start,
          end_date: end,
          clicks: row?.clicks ?? 0,
          impressions: row?.impressions ?? 0,
          ctr: row?.ctr ?? null,
          position: row?.position ?? null,
          queries: (queriesJson.rows ?? []).slice(0, 10).map((item) => ({
            query: String(item.keys?.[0] ?? ""),
            clicks: Number(item.clicks) || 0,
            impressions: Number(item.impressions) || 0,
            ctr: Number(item.ctr) || 0,
            position: Number(item.position) || 0,
          })),
        };
        gscProductCache.set(cacheKey, { exp: Date.now() + GSC_PRODUCT_TTL_MS, value });
        return value;
      } catch (error) {
        const message = error instanceof Error ? error.message : "gsc_error";
        return { ...emptyGscProduct(message, site, page || needle), configured: googleReady, start_date: start, end_date: end };
      }
    },
  };
}

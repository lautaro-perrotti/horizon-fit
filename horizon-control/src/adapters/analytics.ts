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

export type AnalyticsAdapter = {
  searchConsole: () => Promise<GscReport>;
  ga4: () => Promise<Ga4Report>;
};

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
  };
}

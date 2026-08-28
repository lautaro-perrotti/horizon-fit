import { allowlistedFetch, extraAllowedHosts } from "../http/allowlist.js";

const STORE_ID = "horizon-fit";
const MAX_COMPETITORS = 8;

export type CompetitorPage = {
  url: string;
  host: string;
  status: number | null;
  latency_ms: number | null;
  title: string;
  description: string;
  h1: string;
  canonical: string;
  ok: boolean;
  error?: string;
};

export type CompetitorsReport = {
  configured: boolean;
  reason?: string;
  store_id: string;
  pages: CompetitorPage[];
};

export type CompetitorsAdapter = {
  snapshot: () => Promise<CompetitorsReport>;
};

export function parseCompetitorUrls(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\s]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:") continue;
      if (url.username || url.password) continue;
      const host = url.hostname.toLowerCase();
      if (host === "localhost" || host.endsWith(".local")) continue;
      if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) continue;
      if (host === "horizonfit.com.ar" || host === "www.horizonfit.com.ar" || host === "api.horizonfit.com.ar") continue;
      const normalized = `${url.origin}${url.pathname.replace(/\/+$/, "") || "/"}`;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    } catch {
      continue;
    }
    if (out.length >= MAX_COMPETITORS) break;
  }
  return out;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function attr(html: string, attrName: string): string {
  const re = new RegExp(`${attrName}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = html.match(re);
  return match ? decodeHtml(match[1]) : "";
}

function extractPage(html: string): Pick<CompetitorPage, "title" | "description" | "h1" | "canonical"> {
  const title = decodeHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ")).slice(0, 200);
  const descTag = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0] ?? html.match(/<meta[^>]+content=["'][^"']*["'][^>]+name=["']description["'][^>]*>/i)?.[0] ?? "";
  const canonicalTag = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0] ?? "";
  const h1 = decodeHtml((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ")).slice(0, 200);
  return {
    title,
    description: attr(descTag, "content").slice(0, 300),
    h1,
    canonical: attr(canonicalTag, "href").slice(0, 300),
  };
}

export function createCompetitorsAdapter(options: {
  urls: string[];
  fetchImpl?: typeof fetch;
}): CompetitorsAdapter {
  const urls = options.urls.slice(0, MAX_COMPETITORS);
  const extraHosts = extraAllowedHosts(urls);
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async snapshot() {
      if (!urls.length) {
        return { configured: false, reason: "missing_competitor_urls", store_id: STORE_ID, pages: [] };
      }
      const pages: CompetitorPage[] = [];
      for (const url of urls) {
        const started = Date.now();
        try {
          let response = await allowlistedFetch(url, extraHosts, { timeoutMs: 12_000, redirect: "manual" }, fetchImpl);
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (location) {
              const next = new URL(location, url).toString();
              response = await allowlistedFetch(next, extraHosts, { timeoutMs: 12_000, redirect: "manual" }, fetchImpl);
            }
          }
          const html = (await response.text()).slice(0, 400_000);
          const extracted = extractPage(html);
          pages.push({
            url,
            host: new URL(url).host,
            status: response.status,
            latency_ms: Date.now() - started,
            ok: response.ok,
            ...extracted,
          });
        } catch (error) {
          pages.push({
            url,
            host: new URL(url).host,
            status: null,
            latency_ms: Date.now() - started,
            title: "",
            description: "",
            h1: "",
            canonical: "",
            ok: false,
            error: error instanceof Error ? error.message : "fetch_failed",
          });
        }
      }
      return { configured: true, store_id: STORE_ID, pages };
    },
  };
}

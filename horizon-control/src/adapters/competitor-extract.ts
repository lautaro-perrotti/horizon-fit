import { COMPETITOR_SEGMENTS } from "./competitors.js";

export type ExtractedProduct = {
  product_id: string | null;
  product_url: string | null;
  title: string;
  price: number | null;
  compare_at: number | null;
  currency: string | null;
  in_stock: boolean | null;
};

export type ExtractedPage = {
  extractor: "shopify_json" | "jsonld" | "html";
  title: string;
  description: string;
  h1: string;
  products: ExtractedProduct[];
};

export function competitorFromHost(host: string): string {
  const h = host.replace(/^www\./, "").toLowerCase();
  if (h === "touchesport.com" || h.endsWith(".touchesport.com")) return "touche";
  if (h === "adidas.com.ar" || h.endsWith(".adidas.com.ar")) return "adidas-ar";
  return h;
}

export function segmentForUrl(url: string, text = ""): string | null {
  const hay = `${url} ${text}`.toLowerCase();
  for (const segment of COMPETITOR_SEGMENTS) {
    if (segment.needles.some((needle) => hay.includes(needle))) return segment.id;
  }
  return null;
}

export function productKey(product: ExtractedProduct): string {
  return (product.product_id || product.product_url || product.title).toLowerCase().trim();
}

export function parsePrice(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const compact = raw.trim().replace(/[^\d,.-]/g, "");
  if (!compact) return null;
  if (/^\d+\.\d{1,2}$/.test(compact)) {
    const n = Number(compact);
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d+,\d{1,2}$/.test(compact)) {
    const n = Number(compact.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(compact)) {
    const n = Number(compact.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)) {
    const n = Number(compact.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(compact);
  return Number.isFinite(n) ? n : null;
}

export function robotsAllows(robotsTxt: string | null, pathName: string): { allowed: boolean | null; rule?: string } {
  if (robotsTxt == null) return { allowed: null, rule: "robots_unavailable" };
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let current: { agents: string[]; rules: Array<{ allow: boolean; path: string }> } | null = null;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const ua = line.match(/^user-agent\s*:\s*(.+)$/i);
    if (ua) {
      const agent = ua[1].trim().toLowerCase();
      if (current && current.rules.length === 0 && current.agents.length) {
        current.agents.push(agent);
      } else {
        current = { agents: [agent], rules: [] };
        groups.push(current);
      }
      continue;
    }
    const allow = line.match(/^(allow|disallow)\s*:\s*(.*)$/i);
    if (allow && current) {
      current.rules.push({ allow: allow[1].toLowerCase() === "allow", path: allow[2].trim() || "/" });
    }
  }
  const ua = "horizoncontrol";
  const group = groups.find((row) => row.agents.some((agent) => agent !== "*" && ua.startsWith(agent.replace("*", ""))))
    ?? groups.find((row) => row.agents.includes("*"));
  if (!group) return { allowed: true, rule: "no_matching_group" };
  let matched: { allow: boolean; path: string } | null = null;
  for (const rule of group.rules) {
    if (!rule.path) continue;
    if (pathName.startsWith(rule.path) || rule.path === "/") {
      if (!matched || rule.path.length >= matched.path.length) matched = rule;
    }
  }
  if (!matched) return { allowed: true, rule: "no_path_rule" };
  return { allowed: matched.allow, rule: `${matched.allow ? "Allow" : "Disallow"}: ${matched.path}` };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

export function extractHtmlShell(html: string): Pick<ExtractedPage, "title" | "description" | "h1"> {
  const title = decodeHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ")).slice(0, 200);
  const descTag = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0]
    ?? html.match(/<meta[^>]+content=["'][^"']*["'][^>]+name=["']description["'][^>]*>/i)?.[0]
    ?? "";
  const h1 = decodeHtml((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").replace(/<[^>]+>/g, " ")).slice(0, 200);
  return { title, description: attr(descTag, "content").slice(0, 300), h1 };
}

export function shopifyCollectionJsonUrl(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl);
    const match = url.pathname.match(/^\/collections\/([^/]+)/i);
    if (!match) return null;
    return `${url.origin}/collections/${match[1]}/products.json`;
  } catch {
    return null;
  }
}

export function extractShopifyProducts(json: unknown, pageUrl: string): ExtractedProduct[] {
  if (!json || typeof json !== "object") return [];
  const products = Array.isArray((json as { products?: unknown }).products) ? (json as { products: unknown[] }).products : [];
  const out: ExtractedProduct[] = [];
  for (const raw of products.slice(0, 80)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const variants = Array.isArray(item.variants) ? item.variants : [];
    const first = variants[0] && typeof variants[0] === "object" ? (variants[0] as Record<string, unknown>) : {};
    const handle = typeof item.handle === "string" ? item.handle : "";
    const origin = (() => {
      try {
        return new URL(pageUrl).origin;
      } catch {
        return "";
      }
    })();
    out.push({
      product_id: item.id != null ? String(item.id) : null,
      product_url: handle && origin ? `${origin}/products/${handle}` : null,
      title: typeof item.title === "string" ? item.title.slice(0, 200) : "",
      price: parsePrice(first.price),
      compare_at: parsePrice(first.compare_at_price),
      currency: null,
      in_stock: first.available == null ? null : Boolean(first.available),
    });
  }
  return out;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function ldTypes(node: Record<string, unknown>): string[] {
  const raw = node["@type"];
  if (typeof raw === "string") return [raw.toLowerCase()];
  if (Array.isArray(raw)) return raw.filter((row): row is string => typeof row === "string").map((row) => row.toLowerCase());
  return [];
}

function offerPrice(offers: unknown): { price: number | null; currency: string | null } {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const raw of list) {
    const offer = asObject(raw);
    if (!offer) continue;
    const price = parsePrice(offer.price ?? offer.lowPrice);
    if (price != null) {
      return { price, currency: typeof offer.priceCurrency === "string" ? offer.priceCurrency : null };
    }
  }
  return { price: null, currency: null };
}

function productFromLd(node: Record<string, unknown>): ExtractedProduct | null {
  const types = ldTypes(node);
  if (!types.includes("product")) return null;
  const offers = offerPrice(node.offers);
  const title = typeof node.name === "string" ? node.name : "";
  if (!title && offers.price == null) return null;
  return {
    product_id: node.sku != null ? String(node.sku) : node.productID != null ? String(node.productID) : null,
    product_url: typeof node.url === "string" ? node.url : null,
    title: title.slice(0, 200),
    price: offers.price,
    compare_at: null,
    currency: offers.currency,
    in_stock: null,
  };
}

export function extractJsonLdProducts(html: string): ExtractedProduct[] {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const out: ExtractedProduct[] = [];
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1]);
    } catch {
      continue;
    }
    const queue = Array.isArray(parsed) ? parsed : [parsed];
    while (queue.length) {
      const node = asObject(queue.shift());
      if (!node) continue;
      const product = productFromLd(node);
      if (product) out.push(product);
      const graph = node["@graph"];
      if (Array.isArray(graph)) queue.push(...graph);
      const elements = node.itemListElement;
      if (Array.isArray(elements)) {
        for (const el of elements) {
          const row = asObject(el);
          if (row?.item) queue.push(row.item);
          else if (row) queue.push(row);
        }
      }
    }
  }
  return out.slice(0, 80);
}

export function extractPage(html: string, shopifyJson?: unknown, pageUrl = ""): ExtractedPage {
  const shell = extractHtmlShell(html);
  const shopify = shopifyJson != null ? extractShopifyProducts(shopifyJson, pageUrl) : [];
  if (shopify.length) return { extractor: "shopify_json", ...shell, products: shopify };
  const jsonld = extractJsonLdProducts(html);
  if (jsonld.length) return { extractor: "jsonld", ...shell, products: jsonld };
  return { extractor: "html", ...shell, products: [] };
}

export function priceStats(prices: number[]): { min: number | null; max: number | null; median: number | null; n: number } {
  const values = prices.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!values.length) return { min: null, max: null, median: null, n: 0 };
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return { min: values[0], max: values[values.length - 1], median, n: values.length };
}

export function priceIndex(horizonPrice: number | null, competitorPrices: number[]): {
  horizon: number | null;
  median: number | null;
  index: number | null;
  n: number;
} {
  const stats = priceStats(competitorPrices);
  if (horizonPrice == null || stats.median == null || stats.median === 0) {
    return { horizon: horizonPrice, median: stats.median, index: null, n: stats.n };
  }
  return { horizon: horizonPrice, median: stats.median, index: horizonPrice / stats.median, n: stats.n };
}

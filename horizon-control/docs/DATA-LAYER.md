# Horizon Control — data layer (audit + design)

Horizon Control is the **internal operating system for Horizon Fit**. It does not rebuild GA4, Search Console, WooCommerce, Merchant Center, PostHog, or Metabase. It **integrates, normalizes, relates, and operates** Horizon-specific data from one Tailscale `/app` + `/v1` + MCP surface.

This document is the Phase 0 deliverable: inventory, credentials, normalized model, endpoints, Product 360, insight rules, cache/jobs, and implementation order. Build-vs-integrate decisions live in [`BUILD-VS-INTEGRATE.md`](./BUILD-VS-INTEGRATE.md).

**Do not implement Ads, Meta Ads, LLM Consulta, catalog writes, agent deploys, a generic BI layer, session replay, heatmaps, or a dedicated data warehouse in this phase.**

Live VPS (2026-08-28): `feat/horizon-control` @ `9386cf8f`. Storefront and API healthy. Google SA and competitor URLs **not** in env.

---

## 1. Inventory

| Domain | Current adapter | Real data | Missing | Recommendation |
| --- | --- | --- | --- | --- |
| Catalog | `woo.ts` Store API `GET /wp-json/wc/store/v1` (no keys) | Published products, variants, price, stock, slug, categories. Live. | Join key contract with GA4 `itemId` / GSC page. | **Keep.** Do not add a second catalog client. |
| Orders | `commerce.ts` Woo REST v3 `orders` (90d, `per_page=100`, max 5 pages) | Line items, parent SKU, units, AOV of containing orders, 7/30/90d, last sale, `fetched_at`. Store buckets = **order totals**; SKU revenue = **line totals** (they will not match). `incomplete: true` if page cap hit. | Catalog slug/stock join (Product 360). Previous-period delta. | **Phase A done** on the adapter. Dedicated read-only REST key. Keep `commerce.read`. |
| Revenue | same `commerce.sales` from **orders** (not `reports/sales`) | Store: today / 7d / 30d / 90d orders + units + revenue + AOV. Products: top 50 by 30d line revenue. | Catalog velocity vs stock. | **Do not** reintroduce `reports/sales` as SoT — it would disagree with SKU rollups. |
| GA4 | `analytics.ts` `ga4()` Data API | 28d sessions, users, purchases, channel group. Code on VPS. | Credentials. `date`, `pagePath`, `landingPage`, `itemId`/`itemName`, `addToCarts`, `purchaseRevenue`, tracking audit, `fetched_at`. | **Extend `analytics.ga4`.** Unavailable ≠ estimate. |
| Search Console | `analytics.ts` `searchConsole()` | 28d site totals + top 10 queries. Code on VPS. | Credentials. `page`, `date`, device, country, previous 28d, page→slug→SKU, `fetched_at`. | **Extend same adapter.** One Google SA. |
| Merchant | `merchant.ts` local `merchant-diagnostics.txt` + `merchant-products.json` | Ready/blocked counts + blocked SKU issues when path is set. Job `merchant.audit` does **not** regenerate. | Dashboard scope (`merchant.read` not on SPA). Per-variant chip. Join to catalog. | **Unlock dashboard + join.** No Merchant Content API this phase. |
| Competition | `competitors.ts` allowlisted GET | HTML title/H1/meta/status/latency. Empty env → `configured: false`. | Touche/Adidas **segment** URLs in env. Product count, price range, `segment`, historical rows. | **Extend adapter.** No new crawler, no anti-bot. |
| SEO | `seo-report.ts` + job `seo.audit` | On-page crawl of `horizonfit.com.ar`: pages with issues, totals, slug from `/product/{slug}/`. | GSC overlap (impressions on issue URLs). | **Keep crawl.** GSC is demand; crawl is on-page. |
| Repo | `git.ts` | Local HEAD/branch/dirty. Live. | Fetch/ahead unless `HORIZON_GIT_FETCH=1`. | **Keep.** Cursor-only. |
| Health | `health.ts` | Storefront HTTP, API HTTP, DB, worker. Live. | — | **Keep.** |

Do **not** add a second Woo client, a second Google client, or a generic HTTP scraper.

### Tools / `/v1` / scopes (today)

| Tool | HTTP | Scope | Clients |
| --- | --- | --- | --- |
| `ops.health` | `GET /v1/health` | `ops.read` | dashboard, Cursor |
| `catalog.search_products` / `get_product` | `/v1/catalog/products` | `catalog.read` | dashboard, Cursor |
| `storefront.get_config` | `/v1/storefront/config` | `storefront.read` | dashboard, Cursor |
| `commerce.sales` / `settings` | `/v1/commerce/sales` | `commerce.read` | dashboard **only** |
| `seo.*` | `/v1/seo/*` | `seo.read` / `seo.audit` | dashboard **only** |
| `analytics.ga4` / `search_console` / `competitors` | `/v1/analytics/*` | `analytics.read` | dashboard **only** |
| `merchant.*` | `/v1/merchant/*` | `merchant.read` / `merchant.audit` | Claude/admin; **not** dashboard |
| `metrics.snapshots` / `alerts.*` / `assistant.ask` | `/v1/metrics` `/v1/alerts` `/v1/assistant/ask` | `metrics.read` / `alerts.read` | dashboard |
| `repo.status` / `tests.run` / `jobs.get` / `audit.history` | matching `/v1` | repo/tests/jobs/audit | Cursor (not dashboard) |

Browser never calls Woo or Google. Secrets stay in `/etc/horizon-control.env`.

### SQLite today

`jobs`, `audit_events`, `idempotency_keys`, `stores`, `metric_snapshots`, `alerts`. KPI log + job queue — **not** a warehouse. `metric_snapshots.value` is an integer; it cannot hold CTR.

---

## 2. Credentials (human, VPS)

| Need | Env | Status |
| --- | --- | --- |
| Woo REST read-only (sales/orders) | `HORIZON_WOO_KEY` + `HORIZON_WOO_SECRET` **or** `WOO_USER` + `WOO_APP_PASSWORD` | Code ready; numbers only if keys exist. Use a **dedicated** key, not a human admin. |
| Google SA | `HORIZON_GOOGLE_SA_PATH` or `HORIZON_GOOGLE_SA_JSON` | Missing. |
| GA4 | `HORIZON_GA4_PROPERTY_ID` | Missing. |
| GSC property | `HORIZON_GSC_SITE_URL` (allowlisted Horizon origins) | Defaults to `https://horizonfit.com.ar/`. |
| Competitors | `HORIZON_COMPETITOR_URLS` | Missing. Use **segment** URLs, not brand homes. |
| Merchant files | `HORIZON_MERCHANT_DIAGNOSTICS_PATH` | Shop generator artifacts. |
| Dashboard JWT | Auth0: grant `analytics.read`; later `merchant.read`. Re-login `/app`. | `analytics.read` may still be missing on the SPA app. |

Empty credentials → `{ configured: false }` or `{ available: false }`. Never invent metrics.

---

## 3. Normalized model

Join keys for Horizon Fit:

| Key | Example | Sources |
| --- | --- | --- |
| `parent_sku` | `001-TOP-AZU` | Woo parent, Merchant item, GA4 `itemId` **if** tracking sends SKU |
| `variant_sku` | `001-TOP-AZU-S` | Woo variation, Merchant variant |
| `product_id` | `99` | Woo Store API id |
| `slug` | `top-liso-azul` | Woo, SEO report, PDP path |
| `canonical_url` | `https://horizonfit.com.ar/product/top-liso-azul/` | Storefront, GSC `page`, SEO |
| `category` | `calzas` | Woo term slug; competitor `segment` |
| `date` | `2026-08-27` | All time series (UTC day) |

If GA4 `itemId` is a Woo numeric id or a name, the join is `unavailable` for that product — do not guess.

### Phase A sales shapes (`commerce.sales`)

Analytic unit is the **line item / SKU**, not only the Woo order. `slug` is null until Product 360 joins catalog.

```ts
type Order = {
  order_id: number;
  date: string;
  revenue: number | null; // order total (shipping/tax included)
  items: Array<{
    sku: string;
    parent_sku: string;
    product_id: number | null;
    slug: string | null;
    quantity: number;
    unit_price: number | null;
    line_total: number | null;
  }>;
  fetched_at: string;
};

type ProductSalesRollup = {
  parent_sku: string;
  orders: number;          // orders containing this SKU
  units: number;
  revenue: number | null;  // sum of line totals
  avg_unit_price: number | null;
  order_aov: number | null; // AOV of containing orders (order totals)
  last_sale_at: string | null;
  d7: PeriodRollup;
  d30: PeriodRollup;
  d90: PeriodRollup;
  fetched_at: string;
};
```

Store buckets (`today` / `week` / `month` / `ninety`) use **order totals**. Product rollups use **line totals**. Do not expect them to match.

### `SourceSlice<T>`

Every payload from an integration is wrapped:

```ts
type SourceSlice<T> = {
  available: boolean;
  configured: boolean;
  reason?: string;           // missing_google_credentials, ga4_event_not_found, …
  fetched_at: string | null; // ISO
  period?: { start: string; end: string; compared_to?: { start: string; end: string } };
  data: T | null;
};
```

Dashboard and MCP read **slices**, never raw Google/Woo payloads.

### `ProductInsight` (Product 360)

`GET /v1/insights/products/001-TOP-AZU` (parent SKU, id, or slug).

```ts
type ProductInsight = {
  store_id: "horizon-fit";
  keys: { product_id: number | null; parent_sku: string; slug: string; canonical_url: string };
  catalog: SourceSlice<{
    name: string;
    price: { amount: string | null; currency: string };
    stock_status: string;
    variants: Array<{ sku: string; size: string | null; in_stock: boolean }>;
    categories: string[];
  }>;
  sales: SourceSlice<{
    orders: number | null;
    units: number | null;
    revenue: number | null;
    aov: number | null;
    currency: string;
  }>;
  analytics: SourceSlice<{
    views: number | null;
    add_to_carts: number | null;
    purchases: number | null;
    revenue: number | null;
  }>;
  search: SourceSlice<{
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    position: number | null;
    queries: Array<{ query: string; clicks: number; impressions: number }>;
  }>;
  seo: SourceSlice<{ critical: number; warning: number; title: string | null; issues: unknown }>;
  merchant: SourceSlice<{
    ready: number | null;
    blocked: number | null;
    variants: Array<{ sku: string; ready: boolean; issues: unknown[] }>;
  }>;
  competition: SourceSlice<{
    segment: string;
    peers: Array<{ competitor: string; url: string; status: number | null; title: string; price_min: number | null; price_max: number | null }>;
  }>;
  insights: DeterministicInsight[];
};
```

New adapter **`insights.ts`** composes existing adapters. It does not call Google or Woo except through them.

### Store overview

`GET /v1/insights/overview` — five blocks only: revenue+orders, demand/traffic, conversion (only if both Woo and GA4 available), opportunities, problems. Each block is a `SourceSlice`.

---

## 4. Proposed `/v1` + MCP

Reuse existing routes for source reads. Add insight reads (dashboard + later MCP). **Do not** expose Google/Woo URLs to agents.

| Method | Path | Tool | Scope | Phase |
| --- | --- | --- | --- | --- |
| GET | `/v1/commerce/sales` | `commerce.sales` | `commerce.read` | A (SKU rollups live) |
| GET | `/v1/analytics/ga4` | `analytics.ga4` | `analytics.read` | B (extend body) |
| GET | `/v1/analytics/search-console` | `analytics.search_console` | `analytics.read` | C (extend body) |
| GET | `/v1/merchant/diagnostics` | `merchant.get_diagnostics` | `merchant.read` | D (grant dashboard) |
| GET | `/v1/analytics/competitors` | `analytics.competitors` | `analytics.read` | E (extend body) |
| GET | `/v1/insights/overview` | `insights.overview` | `insights.read` | H |
| GET | `/v1/insights/products/:id` | `insights.get_product` | `insights.read` | F |
| GET | `/v1/insights/opportunities` | `insights.list_opportunities` | `insights.read` | G |

Keep `commerce.read`. Do not add `sales.read` or `catalog.write`. Cursor **does not** get `insights.read`, `commerce.read`, `analytics.read`, or `merchant.read`.

---

## 5. Deterministic insights (no LLM)

Each row: `{ type, severity, entity, metrics, reason, source, period }`.

| `type` | When (transparent) | Needs |
| --- | --- | --- |
| `HIGH_TRAFFIC_LOW_CONVERSION` | PDP views in top quartile and purchases = 0 or conversion << store median | GA4 item + Woo or GA4 purchase |
| `HIGH_IMPRESSIONS_LOW_CTR` | Impressions ≥ threshold and CTR &lt; site median (or &lt; 2%) | GSC page |
| `LOW_STOCK_HIGH_DEMAND` | `outofstock` (or units ≤ N) and (GSC clicks or GA4 views) high | Catalog + GSC or GA4 |
| `MERCHANT_BLOCKED_HIGH_TRAFFIC` | Merchant not ready and (views or impressions) high | Merchant + GA4/GSC |
| `SEO_ISSUE_HIGH_IMPRESSIONS` | SEO critical/warning on URL with GSC impressions | SEO + GSC |
| `PRODUCT_DECLINING_REVENUE` | This 28d revenue ≤ 50% of previous 28d and previous ≥ floor | Woo by product |

If a required slice is `available: false`, **omit** the insight. Do not estimate CTR or conversion.

---

## 6. Cache / freshness / jobs

Sync in **Horizon jobs** (in-process adapter calls, not browser, not generic shell).

| Job | Writes | TTL before next sync | Typical `fetched_at` lag |
| --- | --- | --- | --- |
| `sales.sync` | sales slice + optional `metric_snapshots` | 2 min | seconds–minutes (Woo) |
| `ga4.sync` | GA4 slice cache | 30 min | GA4 processing delay |
| `gsc.sync` | GSC slice cache | 12 h | GSC often ~1–2 days |
| `merchant.ingest` | read existing files only | on file mtime / 15 min | generator clock |
| `competitor.snapshot` | competitor rows | 12 h | check time |
| `seo.audit` | **already exists** | 12 h schedule | crawl time |

UI always shows `fetched_at` per slice (e.g. “GSC · 8 h ago”). Do not mix a 28d GSC window with “today” Woo without labeling both periods.

**Do not** hit Google on every tab focus. Dashboard reads last successful job/cache.

Existing `ALLOWED_JOB_TYPES`: `seo.audit`, `tests.run`, `merchant.audit`. Add the sync types above as first-class job types (adapter runners), not new shop PHP scripts.

---

## 7. Competition model (Phase E)

Not brand homes. Segments that match Horizon (calzas, tops, training mujer).

```ts
type CompetitorSnapshot = {
  competitor: "touche" | "adidas-ar";
  segment: "calzas" | "tops" | "training-mujer";
  url: string;
  checked_at: string;
  status: number | null;
  title: string;
  description: string;
  h1: string;
  product_count: number | null;  // only if a robust count is visible
  price_min: number | null;      // visible list price only
  price_max: number | null;
  error?: string;
};
```

Rate limit: max 8 URLs, ≥ 12 h between full snapshots, one redirect hop, allowlist only. No login, captcha bypass, or fingerprint evasion. Persist rows (SQLite table `competitor_snapshots` when Phase E lands — still not a warehouse).

Env example (segment URLs, confirm slugs on VPS):

```
HORIZON_COMPETITOR_URLS=https://touchesport.com/collections/leggings,https://touchesport.com/collections/tops,https://www.adidas.com.ar/calzas-mujer,https://www.adidas.com.ar/mujer-training
```

---

## 8. Merchant API vs local diagnostics

This phase: **local JSON is enough** (what we generate and upload). Dashboard should join `sku` → catalog → insights.

**When to add Merchant Content API:** Google’s live disapproval/approval diverges from our file (item rejected in GMC but `ready: true` locally), or we need impression-level Shopping data. Until then, do not build a second Merchant client.

---

## 9. SQLite → warehouse trigger (evaluate only)

Stay on SQLite + adapter cache until **one** of:

- `ga4.sync` / `gsc.sync` need **≥ 90 daily product rows** queried interactively (Product 360 history), or
- `metric_snapshots` / competitor rows make Overview slow, or
- two writers contend (second CP process).

Then: Postgres tables `daily_product_metrics`, `daily_channel_metrics`, `search_queries`, `merchant_snapshots`, `competitor_snapshots`. Not before.

---

## 10. GA4 tracking audit (Phase B)

`GET /v1/analytics/ga4` (extended) should include:

```ts
{
  connected: boolean;
  property_reachable: boolean;
  events_detected: string[];      // names actually returned
  purchase_detected: boolean;
  item_id_coverage: number | null; // share of purchases with itemId, or null
}
```

If `addToCarts` or `itemId` is absent in the property → `available: false` on that metric. Horizon Fit should send `item_id` = parent SKU (`001-TOP-AZU`) for the join to work.

---

## 11. Product 360 + Overview (UI)

Both consume **`insights.*` only**. Browser does not fan-out to five APIs.

**Overview (5, not 20):** (1) revenue + orders (2) demand/traffic (3) conversion if both sources available (4) opportunities from rules (5) problems (health, merchant blocked, SEO critical).

**Product 360:** catalog, sales, analytics, search, SEO, merchant, competition slices for one parent SKU. Render `unavailable` copy when a slice is off. Inspector “Ver PDP” already exists; 360 is the data view.

**Consulta / LLM:** later. Flow = user → LLM → MCP `insights.*` → slices. The model never computes revenue and never talks to Woo/Google.

**Ads (later):** spend → session → purchase → SKU. Not this phase.

---

## 12. Implementation phases

| Phase | Work | Unblocked by |
| --- | --- | --- |
| **A** | Woo sales: line items, SKU, AOV, 7/30/90d product rollups, `fetched_at` — **done in code** | Dedicated REST key on VPS for live numbers |
| **B** | GA4: dimensions/metrics listed, tracking audit, cache job | Google SA + property |
| **C** | GSC: page/query/date, previous 28d, page→slug | same SA + GSC share |
| **D** | Merchant on dashboard + SKU join; grant `merchant.read` | Path to diagnostics |
| **E** | Competitor snapshots by segment + history | Env URLs |
| **F** | `insights.get_product` + Product 360 UI — **done in code** (catalog + sales; other slices unavailable) | Woo key for live sales |
| **G** | Deterministic opportunity list + alerts | F |
| **H** | Overview rewritten to five insight blocks | F–G |
| **I** | Re-read PostHog / Metabase against real pain | After H |
| **J** | Google Ads / Meta | After I |
| **K** | LLM Consulta over MCP insights | After J |

Do not skip to J/K. Phases B–C can proceed in parallel with A once the SA exists. **F can ship with holes** (`available: false`); that is success, not a mock.

---

## Success

Opening `001-TOP-AZU` shows what it is, price, stock, views, queries, conversion, revenue, SEO, Merchant, and comparable Touche/Adidas **segments** — each labeled with source and `fetched_at`. Horizon Control is the join layer. The mature products remain the systems of record.

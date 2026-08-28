# Horizon Control — Growth Engine (design)

Horizon Control is the internal OS for Horizon Fit. After catalog + SKU sales, the product goal is: **detect, prioritize, and inspect opportunities to sell more**. Not a second GA4. Not Ads. Not an LLM strategist.

This document is the pre-implementation deliverable: foundation status, adapters, `ProductInsight`, joins, growth rules, opportunity score, endpoints, storage, jobs, commit order.

Build-vs-integrate: [`BUILD-VS-INTEGRATE.md`](./BUILD-VS-INTEGRATE.md). Data inventory: [`DATA-LAYER.md`](./DATA-LAYER.md).

**Do not merge `main`. Do not write catalog/orders. Do not invent metrics. Do not implement Ads or LLM in this stage.**

Live check (2026-08-28 ~08:38 UTC): `ops.health` healthy. Shop repo `HORIZON_REPO_PATH` = **`main` @ `dd2fd78f`**. CP process listening on Tailscale `:8787`. Code worktree: `/opt/horizon-control-plane` (systemd drop-in `WorkingDirectory`). Google SA and Woo REST key **not confirmed** in this session.

---

## 1. Foundation status (FASE 1)

| Point | Status | Owner |
| --- | --- | --- |
| CP runs from `/opt/horizon-control-plane` | **Done on VPS** (drop-in override). Unit file in git still said `/root/horizon-fit` until the foundation commit. | Human did override; git unit updated in-repo |
| `/root/horizon-fit` on `main` | **Done** (`ops.health` branch `main`) | Human |
| Woo REST read-only key | **Blocked on human** — Product 360 catalog works; sales slice is `configured:false` without `HORIZON_WOO_KEY`/`SECRET` | Human |
| Product 360 + real sales | **Code live** (`insights.get_product`). Real units/revenue only after Woo key | Both |
| drizzle-orm GHSA-gpj5-g38j-94v9 | **Patch to 0.45.2** (not `npm audit fix --force`). We do not call `sql.identifier()` / user-controlled `.as()`. Still patch. Pin exact version. Stay on 0.x; do not jump to Drizzle v1 beta | Code |
| SIGTERM / systemd | **Was broken**: `server.close` + in-flight `warehouse.evaluate` + open MCP could exceed `TimeoutStopSec=20` → SIGKILL. Shutdown now drains HTTP, stops worker + evaluate timer, closes SQLite, force-exits before systemd kill | Code |
| Deny-list (no shell/SSH/writes/deploy) | **Keep** | — |

Human parallel track: dedicated Woo read-only key + Google SA (GA4 property + GSC share). No admin Woo user.

---

## 2. Adapters today (do not duplicate)

| Domain | Adapter | Real now | Next |
| --- | --- | --- | --- |
| Identity | `product-identity.ts` | variation / parent SKU / Woo id / slug / PDP URL → `parent_sku` | Reuse for GA4 `itemId`, GSC page, Merchant SKU |
| Catalog | `woo.ts` Store API | Live products, stock, price | Keep |
| Sales | `commerce.ts` REST orders | Line items, 7/30/90d SKU rollups, `fetched_at`. Order totals ≠ line totals | Key on VPS |
| Join | `insights.ts` | Catalog + sales slices; others `not_joined_yet` | Fill slices from existing adapters only |
| GA4 / GSC | `analytics.ts` | Site totals 28d if SA exists | Extend body + tracking audit |
| Merchant | `merchant.ts` | Local diagnostics files | Dashboard join via identity |
| Competition | `competitors.ts` | Env URL probes | Segment URLs + SQLite history |
| SEO | `seo-report.ts` | On-page crawl | Join slug → GSC later |
| Health / repo | `health.ts` / `git.ts` | Live | Repo path = shop `main`; CP code is the worktree |

Cursor MCP still has no `commerce` / `insights` / `analytics`. Dashboard has `commerce.read`.

---

## 3. `ProductInsight` (normalized core)

One entity. Browser never joins. `GET /v1/insights/products/:identity` already exists; **extend the body**, do not add a second product endpoint.

```ts
type SourceSlice<T> = {
  available: boolean;
  configured: boolean;
  reason?: string;
  fetched_at: string | null;
  period?: { start: string; end: string };
  data: T | null;
};

type ProductInsight = {
  store_id: "horizon-fit";
  keys: {
    kind: "parent_sku" | "variant_sku" | "product_id" | "slug" | "url";
    parent_sku: string;
    variant_sku: string | null;
    product_id: number | null;
    slug: string | null;
    canonical_url: string | null;
  };
  catalog: SourceSlice<{ name; price; stock_status; variants; categories; images }>;
  sales: SourceSlice<{
    currency;
    store_note: "order totals ≠ line totals";
    d7; d30; d90;          // line revenue / units / containing-order AOV
    last_sale_at; velocity_30d;
  }>;
  analytics: SourceSlice<{ views; add_to_carts; checkouts; purchases; revenue; conversion }>;
  search: SourceSlice<{ impressions; clicks; ctr; position; queries }>;
  seo: SourceSlice<{ title; meta; h1; issues }>;
  merchant: SourceSlice<{ ready; blocked; variants[] }>;
  competition: SourceSlice<{ segment; peers[] }>;
  opportunities: GrowthOpportunity[];  // deterministic; may be []
  freshness: { catalog; sales; analytics; search; seo; merchant; competition };
};
```

Missing slice → `available: false`, never a guess. Conversion only if **both** analytics purchases (or Woo units) and views exist.

---

## 4. Joins (single resolver)

`resolveProductIdentity(ref)` is mandatory for every source:

| Source | Raw key | Join |
| --- | --- | --- |
| Woo catalog | id, sku, slug | identity |
| Woo sales | `line.sku` → `parent_sku` | already |
| GA4 | `itemId` **if** parent SKU; else `pagePath` → slug | identity; else `unavailable` |
| GSC | `page` URL → slug | identity |
| SEO | `/product/{slug}/` | identity |
| Merchant | variant SKU | identity |
| Competition | `segment` = category slug (`calzas` / `tops` / `training-mujer`) | not SKU-level |

If GA4 `itemId` is a numeric Woo id or a name → do not guess; mark analytics product join unavailable.

---

## 5. Growth rules (deterministic, no LLM)

Emit only when required slices are `available`. Omit the row otherwise.

| `type` | When | Needs | `recommended_next_check` |
| --- | --- | --- | --- |
| `HIGH_TRAFFIC_LOW_CONVERSION` | PDP views ≥ store/category P75 and conversion ≤ 50% of that baseline | GA4 item + purchases or Woo units | PDP, price, offer |
| `HIGH_IMPRESSIONS_LOW_CTR` | Impressions ≥ floor and CTR < site median (or < 2%) and position ≤ 15 | GSC page | Title/snippet |
| `HIGH_IMPRESSIONS_LOW_CONVERSION` | GSC clicks or impressions high and conversion low | GSC + GA4 or Woo | PDP / intent match |
| `MERCHANT_BLOCKED_HIGH_VALUE` | Variant not ready and (30d line revenue or views) above floor | Merchant + sales or GA4 | Feed / GMC |
| `SEO_ISSUE_HIGH_DEMAND` | SEO critical/warning and GSC impressions above floor | SEO + GSC | On-page |
| `LOW_STOCK_HIGH_DEMAND` | `outofstock` or coverage days < N and (velocity or views) high | Catalog + sales or GA4 | Replenish |
| `HIGH_STOCK_LOW_VELOCITY` | In stock, units/day 30d low vs catalog depth | Catalog + sales | Merchandising |
| `REVENUE_DECLINING` | This 28d line revenue ≤ 50% of previous 28d and previous ≥ floor | Sales (needs previous window — not yet) | Cause check |
| `CONVERSION_DECLINING` | Views stable/up, conversion down vs previous | GA4 two periods | PDP |
| `PRICE_OUTLIER` | Our price outside observed competitor min–max for **same segment** | Catalog + competitor prices | **Fact only** — never “lower the price” |

Each row:

`id, type, severity, parent_sku, product, period, metrics, baseline, evidence, source, reason, detected_at, freshness, potential_impact?, recommended_next_check`

`potential_impact` only if we can state a **transparent** arithmetic (e.g. views × category conversion × AOV − current revenue) and both inputs exist. Otherwise omit the field.

---

## 6. Opportunity score (visible parts, not a magic number)

Not a black-box. UI shows each component 0–100 and the weighted sum.

| Component | 0–100 from | Weight |
| --- | --- | --- |
| `revenue_importance` | 30d line revenue vs top SKU (log scale) | 0.22 |
| `demand` | GSC impressions or clicks vs site P75 | 0.16 |
| `traffic` | GA4 PDP views vs P75 | 0.16 |
| `conversion_gap` | (baseline − actual) / baseline, clamped | 0.18 |
| `stock_exposure` | out of stock or low days-of-cover while demand high | 0.10 |
| `merchant_exposure` | blocked × revenue_importance | 0.08 |
| `seo_opportunity` | issue severity × GSC impressions | 0.05 |
| `competitive_pressure` | price outlier or peer count in segment | 0.05 |

`score = Σ weight_i × component_i`. Missing component → **drop its weight and renormalize** (do not fill with 50). Caption: “score uses sales+catalog only; GA4 not configured”.

Severity: `critical` if merchant blocked + revenue_importance ≥ 60 or conversion_gap ≥ 70 with traffic ≥ 60; else `warning` if score ≥ 40; else `info`.

---

## 7. Endpoints (reuse, then add)

| Method | Path | Tool | Scope | When |
| --- | --- | --- | --- | --- |
| GET | `/v1/insights/products/:id` | `insights.get_product` | `commerce.read` | **Exists** — extend slices |
| GET | `/v1/growth/opportunities` | `growth.list_opportunities` | `commerce.read` until Auth0 `growth.read` | After rules have ≥1 live slice pair |
| GET | `/v1/growth/opportunities/:id` | `growth.get_opportunity` | same | same |
| GET | `/v1/insights/overview` | `insights.overview` | later | 5 blocks, not 20 cards |

Cursor does **not** get these. Do not add `sales.read`. Do not expose Google/Woo URLs to MCP.

Future MCP names: `insights_get_product`, `growth_list_opportunities`, … after the engine is stable.

---

## 8. Storage / cache (still not a warehouse)

Keep SQLite. New tables only when a job must remember history:

| Table | When | Rows |
| --- | --- | --- |
| (none new) | Now | Adapter instance TTL: Woo 2 min, GA4 30 min, GSC 12 h, competitors 12 h |
| `competitor_snapshots` | Phase competition history | url, segment, checked_at, title, h1, price_min/max, product_count |
| `growth_opportunities` | Optional cache of last evaluate | type, parent_sku, score, payload_json, detected_at |
| `daily_product_metrics` | **Trigger only** (see DATA-LAYER §9) | Not now |

`metric_snapshots.value` is integer — do not store CTR there.

---

## 9. Jobs

| Job | Role | TTL |
| --- | --- | --- |
| `seo.audit` | Exists | 12 h |
| `merchant.audit` | Exists (read files) | file mtime |
| `sales.sync` | Warm commerce cache + snapshots | 2 min |
| `ga4.sync` | Warm GA4 cache | 30 min |
| `gsc.sync` | Warm GSC cache | 12 h |
| `competitor.snapshot` | Segment GETs | 12 h |
| `growth.evaluate` | Run rules server-side | after source syncs |

Browser never fans out to Google. Dashboard reads last cache/job result.

---

## 10. Commit order (no merge to `main`)

1. **Foundation** — drizzle-orm `0.45.2` pin, graceful shutdown, systemd `WorkingDirectory=/opt/...`, shutdown tests.  
2. **GA4 audit + dimensions** — extend `analytics.ga4` only.  
3. **GSC page/query + identity join** — same Google client.  
4. **Merchant slice on Product 360** — grant dashboard `merchant.read` when Auth0 is ready; until then keep unavailable.  
5. **Competitor segments + `competitor_snapshots`**.  
6. **Fill ProductInsight slices** (still one endpoint).  
7. **`growth.list_opportunities` + score + Growth UI** (dense list).  
8. **Product 360 tabs** + links from catalog/SEO/merchant.  
9. Demand Radar / competitor history — only with live GSC/GA4.  
10. Document Ads + LLM as DEFER (no code).

VPS after each CP commit: `git pull` in `/opt/horizon-control-plane`, `npm ci`, `systemctl restart horizon-control`. Shop stays on `main`.

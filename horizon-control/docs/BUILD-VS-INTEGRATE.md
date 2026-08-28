# Build vs integrate

Horizon Control must not reconstruct mature products. Before any large feature: (1) does a mature tool already do this? (2) should we integrate it? (3) what Horizon Fit–specific join or operation do we build?

| Verdict | Meaning |
| --- | --- |
| **BUILD** | Horizon-specific: join, normalize, operate, Tailscale UI for this store. |
| **INTEGRATE** | Call the system of record through a Control Plane adapter. |
| **DEFER** | Useful later; do not install until a concrete trigger. |
| **REJECT** | Out of scope or would duplicate a SoT we already integrate. |

---

## Systems of record (keep)

| Capability | Tool | Verdict | Notes |
| --- | --- | --- | --- |
| Auth | **Auth0** | INTEGRATE | Resource server JWT. No login UI in CP. |
| Catalog, cart, checkout, orders | **WooCommerce** | INTEGRATE | Store API (public catalog) + dedicated REST key (sales read-only). No writes this phase. |
| Traffic, funnels, ecommerce events | **GA4** | INTEGRATE | Analytics Data API. Do not build an analytics product. |
| Search demand | **Google Search Console** | INTEGRATE | Search Analytics API. |
| Shopping feed quality | **Local merchant diagnostics** | INTEGRATE | Existing generator files. **Defer Merchant Content API** until GMC live status diverges from the file. |
| On-page SEO crawl | **Existing `seo-audit.js`** | INTEGRATE | Allowlisted job. Not GSC. |
| Identity of the storefront | **horizonfit.com.ar** | INTEGRATE | Health + Sitio iframe. |

---

## Horizon Control (build)

| Capability | Verdict | Why it is ours |
| --- | --- | --- |
| Tailscale `/app` + `/v1` + MCP | BUILD | Internal OS for one brand. Tooljet would replace this for no gain. |
| Normalized `ProductInsight` / Product 360 | BUILD | Join SKU ↔ PDP ↔ GA4 ↔ GSC ↔ Merchant ↔ segment. No vendor does Horizon SKUs. |
| Deterministic insights / alerts | BUILD | Transparent rules (`HIGH_IMPRESSIONS_LOW_CTR`, …). Not an LLM. |
| Growth opportunities + visible score | BUILD | Prioritize SKUs to sell more. Score components are listed in `GROWTH-ENGINE.md`; missing sources renormalize weights. |
| Job queue (allowlisted types) | BUILD | `seo.audit` already; add `ga4.sync` / `gsc.sync` / `sales.sync` / `competitor.snapshot`. |
| Competitor **segment** snapshots | BUILD | Thin allowlisted HTML probe. Not a crawler company. |
| Audit log, scopes, deny-list | BUILD | Security boundary. |
| Consulta shell (deterministic today) | BUILD | Later LLM **only** as a client of `insights.*`. |

---

## Evaluated, not installed

### PostHog

Possible: product analytics, session replay, funnels, experiments.

| | |
| --- | --- |
| Overlap with GA4 | High for sessions/funnels/ecommerce if events are correct. |
| Unique | Session replay, feature flags, product-event design not in GA4. |
| Verdict | **DEFER.** GA4 is SoT for this phase. Install PostHog only if we need replay or experiments **and** refuse to put that in GA4. Do not run two session products. |

### Metabase

Possible: exploratory SQL, historical BI.

| | |
| --- | --- |
| Needs | A warehouse with `daily_product_metrics` (we do not have it). |
| Overlap | Overview / Product 360 will cover the questions that matter for ops. |
| Verdict | **DEFER** until the SQLite→Postgres trigger in `DATA-LAYER.md` fires. Then Metabase on that DB beats inventing a query UI. |

### Windmill

Possible: workflows, scripts, cron.

| | |
| --- | --- |
| Overlap | In-process job worker + `ALLOWED_JOB_TYPES`. |
| Verdict | **REJECT** for now. Migrating jobs would add a second orchestrator on the VPS. Revisit only if we outgrow one Node process. |

### Tooljet / Appsmith / Retool

Possible: admin UI on APIs.

| | |
| --- | --- |
| Overlap | `/app` is already the operator UI (Auth0, scopes, Design Canvas). |
| Verdict | **REJECT.** Replacing Horizon Control with a generic low-code admin throws away Tailscale/auth/deny-list.

---

## Explicitly out of this phase

| Capability | Verdict |
| --- | --- |
| Google Ads / Meta Ads | **DEFER** (Phase J). SoT stays the ad platforms; CP will join spend→SKU later. |
| LLM Consulta | **DEFER** (Phase K). Must sit on `insights.*`, never compute revenue. |
| Catalog / price / stock writes | **REJECT** this phase. |
| Agent deploy / cache.regenerate / shell / SSH | **REJECT** (deny-list). |
| Homegrown session replay / heatmaps | **REJECT.** If needed later: PostHog, not a CP feature. |
| Generic public data warehouse | **DEFER.** SQLite KPI log is enough until the trigger in `DATA-LAYER.md`. |
| Second Google HTTP client / generic scrape | **REJECT.** Extend `analytics.ts` / `competitors.ts`. |

---

## Decision rule (every future PR)

```
if a mature SoT already owns the metric:
  INTEGRATE via existing adapter (or one new adapter if none exists)
  BUILD only the join, cache, job, scope, and Horizon UI
else if the need is Horizon-specific (SKU 001-TOP-AZU, this feed, this PDP):
  BUILD
else:
  DEFER or REJECT
```

Do not add PostHog, Metabase, Windmill, or Tooljet in Phases A–H.

# Horizon Control Dashboard

SPA client of Horizon Control `/v1`. **Not** a WordPress plugin. **Not** on public nginx. Tailscale only (`http://<tailscale-ip>:8787/app`).

The dashboard never talks to Woo, GA, GSC, or Ads from the browser. It only calls `/v1` with a Bearer JWT. Ingest and alert rules run in the Control Plane worker.

## Architecture

```
Browser (Tailscale)
  -> GET /app            static SPA (no secrets)
  -> Auth0 PKCE          SPA app "Horizon Dashboard"
  -> /v1/*               same commands as MCP
Control Plane
  -> Store API           catalog (no keys)
  -> Woo REST v3         sales/orders if HORIZON_WOO_KEY is set
  -> Google APIs         GSC + GA4 if a service account is set
  -> Competitor URLs     homepage probes from HORIZON_COMPETITOR_URLS
  -> SQLite              jobs, audit, metric_snapshots, alerts, stores
```

Auth0 API identifier / JWT `aud` stays `http://100.123.37.74:8787/mcp`. Create a **separate Application** (SPA, PKCE). Do not reuse Horizon Cursor’s Native client.

## Routes (hash router)

Visual system and rules: [`dashboard/DESIGN.md`](../dashboard/DESIGN.md). Every view is one entry in `dashboard/core/views.js` (route, group, label, tools, keys); the rail, the Ctrl/⌘K palette and the `g`+key shortcuts are generated from it. The global window travels in the hash query (`?w=7d|28d|90d|ytd&cmp=0|1`) so every link is shareable.

| Group | Route | Source tools | Scope |
| --- | --- | --- | --- |
| Decidir | `#/` Hoy | `insights.overview`, `commerce.sales`, `metrics.series`, `growth.list_opportunities`, `alerts.list` | `commerce.read` `metrics.read` `alerts.read` |
| Decidir | `#/oportunidades/:id?` | `growth.list_opportunities` / `get_opportunity` / `update_opportunity`, `content.generate` | `commerce.read` `content.write` |
| Decidir | `#/alertas` | `alerts.list` / `alerts.evaluate` | `alerts.read` |
| Producto | `#/catalogo` | `catalog.search_products`, joined with SEO, Merchant and Growth | `catalog.read` |
| Producto | `#/producto/:ref?` Product 360 | `insights.get_product`, per-SKU `metrics.series`, drafts | `commerce.read` `metrics.read` |
| Producto | `#/sitio?u=/producto/...` | storefront iframe + `storefront.get_config` | `storefront.read` |
| Producto | `#/contenido/:id?` | `content.*` (never publishes to Fit) | `content.read` `content.write` |
| Demanda | `#/demanda` | `analytics.ga4`, `analytics.search_console`, `metrics.series` | `analytics.read` `metrics.read` |
| Demanda | `#/seo` | `seo.get_latest_audit`, `seo.audit`, `metrics.snapshots` | `seo.read` `seo.audit` |
| Demanda | `#/merchant` | `merchant.get_diagnostics` (audit needs `merchant.audit`) | `merchant.read` |
| Demanda | `#/competencia` | `competition.list` / `changes` / `compare_product` / `get` | `analytics.read` |
| Plata | `#/ventas` | `commerce.sales`, revenue `metrics.series` | `commerce.read` |
| Plata | `#/clientes/:key?` | `customers.list` / `customers.get` (hashed keys) | `commerce.read` |
| Plata | `#/campanas` | `campaigns.list` (+ Ads `not_configured`) | `commerce.read` |
| Sistema | `#/operaciones` | `ops.health`, `/healthz`, sync state from `metrics.series`, `commerce.settings`, `ai.usage`/`ai.models`; repo/jobs/audit render a 403 state until those scopes exist | `ops.read` `ai.read` |
| — | Consulta panel (Ctrl/⌘J) | `ai.chat` with SKU + window context; falls back to `assistant.ask` without model keys | `ai.chat` `alerts.read` |

The SPA reads `/v1/tools` once per session and hides actions the token cannot call; anything else that returns 403 renders a "falta scope" state instead of an error.

## Local preview with fixtures

```bash
npm run dashboard:dev   # http://127.0.0.1:8797/app/  (no Auth0, no worker, no outbound jobs)
```

`?scenario=cold` (nothing configured) and `?scenario=errors` (failures and 403s) exercise the empty and error states. Fixtures live in `dashboard/dev/fixtures.js` and are served only when `HORIZON_DASHBOARD_FIXTURES=1` and `NODE_ENV` is not `production`.

## Static serving

`/app` files come straight from `dashboard/` (no build). Allowed folders: `core`, `ui`, `views`, `fonts`, `vendor` (plus `dev` in fixture mode). HTML and JS/CSS are `no-cache` with an ETag; fonts and vendor are cached for a week. The shell carries a strict CSP: own scripts only, the storefront as the only frame, Auth0 as the only extra `connect-src`, and storefront/API hosts for product images. Fonts are the brand's Archivo and Archivo Narrow, subset to woff2 (SIL OFL).

If Woo REST keys are missing, ventas returns `{ configured: false }` — never invent revenue.
If the Google service account or GA4 property is missing, Analytics returns `{ configured: false }` — never invent sessions or clicks.
If `HORIZON_COMPETITOR_URLS` is empty, Competencia returns `{ configured: false }` — never invent rivals.

**Out of MVP:** Ads publish, visual previews, catalog writes, multi-store registry, Merchant tools unless granted, agent-supplied crawl URLs.

## Data model

- `stores` — one row `horizon-fit` (slug, storefront URL, API URL).
- `metric_snapshots` — `(store_id, period, kpi, value, at, payload)`.
- `alerts` — `(rule_id, severity, status open|resolved, title, payload)`.
- Existing `jobs` + `audit_events`.

## Woo REST credentials

Set **only** in `/etc/horizon-control.env` (`chmod 600`):

```
HORIZON_WOO_KEY=ck_...
HORIZON_WOO_SECRET=cs_...
```

Application-password fallback: `WOO_USER` + `WOO_APP_PASSWORD`. Keys never go in the SPA or git.

## Google (GSC + GA4)

Create a Google Cloud service account with **Search Console API** (read) and **Google Analytics Data API** (read). Share the GSC property `https://horizonfit.com.ar/` (or `sc-domain:horizonfit.com.ar`) and the GA4 property with that SA email. Put the JSON **only** in `/etc/horizon-control.env` or a `0600` file:

```
HORIZON_GOOGLE_SA_PATH=/etc/horizon-google.json
HORIZON_GA4_PROPERTY_ID=123456789
HORIZON_GSC_SITE_URL=https://horizonfit.com.ar/
```

`HORIZON_GSC_SITE_URL` is allowlisted to Horizon origins only. Missing credentials → `{ configured: false }`.

## Competitor URLs

Comma-separated **https** homepages, max 8. Private IPs, `horizonfit.com.ar`, and agent-supplied URLs are ignored.

```
HORIZON_COMPETITOR_URLS=https://rival-one.example/,https://rival-two.example/
```

Empty → `{ configured: false }`. Do not hardcode other stores in git.

## Auth0 (dashboard SPA)

1. Applications → Create Application → **Single Page Application**. Name: Horizon Dashboard.
2. Callbacks / logout / web origins: `http://100.123.37.74:8787/app`, `http://100.123.37.74:8787/app/callback`, plus `http://127.0.0.1:8787/app` for local.
3. Authorize this app on API **Horizon Control MCP**. Grant: `openid`, `ops.read`, `catalog.read`, `storefront.read`, `commerce.read`, `metrics.read`, `alerts.read`, `seo.read`, `seo.audit`, `analytics.read`, `merchant.read`, `ai.read`, `ai.chat`, `content.read`, `content.write`. The SPA authorize URL includes `openid` plus those API scopes. Customers / campañas / growth ride on `commerce.read`.
4. Token Sender-Constraining: **Never**. Do not enable DPoP.
5. Put the **public** Client ID in `HORIZON_DASHBOARD_CLIENT_ID` on the VPS env. Not a secret.
6. Add API permissions `commerce.read`, `metrics.read`, `alerts.read`, `seo.read`, `seo.audit`, `analytics.read`, `merchant.read`, `ai.read`, `ai.chat`, `content.read`, `content.write` (same names as CP scopes).

RBAC: either leave **Enable RBAC OFF** for this API (scopes on the authorize URL land on the JWT) **or** assign a user role that includes those permissions. Granting an application 7/11 is not enough if RBAC is on and the user has no role.

## Alert rules (deterministic, no tokens)

| `rule_id` | Trigger |
| --- | --- |
| `storefront_down` | `ops.health` storefront not ok |
| `sku_out_of_stock` | Store API sample of `outofstock` (max 10) |
| `job_failed` | latest jobs with status `failed` |
| `seo_critical` | latest SEO summary `totals.critical > 0` |
| `seo_warnings` | latest SEO summary `totals.warning > 5` |
| `seo_stale` | no SEO report, or older than 24h |
| `refresh_stale_sales` | last sales sync failed or is older than 6h |
| `competitor_down` | last `competitor.snapshot` (12h) has a page ≥400 or failed — evaluate does not re-probe every minute |

Missing Google credentials do **not** open an alert. `POST /v1/alerts/evaluate` runs rules and upserts. The in-process worker also ticks evaluate on an interval when the process starts. If the last completed `seo.audit` (or on-disk report) is older than 12h and none is queued/running, the worker enqueues another allowlisted crawl. A script exit 1 from findings is not a failed crawl. When GSC/GA4 are configured, evaluate snapshots `gsc_clicks`, `gsc_impressions`, `ga4_sessions`, `ga4_users` only if the last warehouse row is older than the sync TTL (GSC 12h, GA4 30m). Dashboard `/v1/analytics/*` still reads live.

## Assistant

`POST /v1/assistant/ask` `{ "question": "..." }` routes to health, catalog (limit 10), sales, SEO, GA4, GSC, competitors, allowlisted charts, or alerts. **No model, no full catalog dump.** Chart specs are `{ type, kpi, period, title }` from a fixed KPI list (`seo_warning`, `seo_critical`, `seo_pages`, `revenue`, `orders`, `storefront_ok`, `gsc_clicks`, `gsc_impressions`, `ga4_sessions`, `ga4_users`). A later phase can wrap the same tools with an LLM.

## Security

- Same bind rules as CP: Tailscale or loopback, never `0.0.0.0`.
- No `/app` on public nginx.
- Dashboard cannot call `deploy`, `cache.regenerate`, shell, or Woo writes (tools not registered).
- Optional wp-admin link: bookmark to the Tailscale `/app` URL.

## Local / VPS

```bash
# after npm ci in horizon-control
# env: HORIZON_DASHBOARD_CLIENT_ID=...
# open http://127.0.0.1:8787/app  or Tailscale :8787/app
```

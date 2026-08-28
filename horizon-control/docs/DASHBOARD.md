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

## MVP (this branch)

| Page | Source | Scope |
| --- | --- | --- |
| Overview | health + sales + catalog sample + alerts + SEO totals + GA4 if connected | `ops.read` `commerce.read` `catalog.read` `alerts.read` `seo.read` `analytics.read` |
| Sitio | iframe storefront (`horizonfit.com.ar`) | — (public embed) |
| Catálogo | `catalog.search_products` / `catalog.get_product` + SEO chip by slug | `catalog.read` `seo.read` |
| Analytics | `analytics.ga4` + `analytics.search_console` | `analytics.read` |
| Competencia | `analytics.competitors` (env URLs only) | `analytics.read` |
| Ventas | `commerce.sales` (orders + line-item SKU rollups) | `commerce.read` |
| Operaciones | `ops.health`; repo/jobs/audit locked | `ops.read` |
| Alertas | `alerts.list` / `alerts.evaluate` | `alerts.read` |
| SEO | `seo.get_latest_audit` / `seo.audit` | `seo.read` `seo.audit` |
| Consulta | drawer `assistant.ask` (⌘K), allowlisted charts | `alerts.read` |
| Merchant | blocked copy only | not granted |

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
3. Authorize this app on API **Horizon Control MCP**. Grant: `openid`, `ops.read`, `catalog.read`, `storefront.read`, `commerce.read`, `metrics.read`, `alerts.read`, `seo.read`, `seo.audit`, `analytics.read`. The SPA authorize URL includes `openid` plus those API scopes.
4. Token Sender-Constraining: **Never**. Do not enable DPoP.
5. Put the **public** Client ID in `HORIZON_DASHBOARD_CLIENT_ID` on the VPS env. Not a secret.
6. Add API permissions `commerce.read`, `metrics.read`, `alerts.read`, `seo.read`, `seo.audit`, `analytics.read` (same names as CP scopes).

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
| `competitor_down` | an env-allowlisted competitor probe is ≥400 or failed |

Missing Google credentials do **not** open an alert. `POST /v1/alerts/evaluate` runs rules and upserts. The in-process worker also ticks evaluate on an interval when the process starts. If the last successful `seo.audit` is older than 12h (and none is queued/running), the worker enqueues another allowlisted crawl. When GSC/GA4 are configured, evaluate also snapshots `gsc_clicks`, `gsc_impressions`, `ga4_sessions`, `ga4_users`.

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

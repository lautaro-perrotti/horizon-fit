# Horizon Platform V1 — report

Shipped locally on `feat/horizon-control` (not pushed). Control remains Tailscale `:8787`. Studio stays `127.0.0.1:8790` and is **not** deployed next to horizonfit.com.ar.

## What V1 is

Horizon Control is the internal OS for Horizon Fit: join, cache, jobs, scopes, and a Tailscale UI. It does not rebuild GA4, GSC, Woo, Merchant, Ads, or Studio as a public storefront.

| Batch | Commit | Result |
| --- | --- | --- |
| B2–B5 | history, Product 360, charts, Competitor 360 | Missing slices stay `unknown` / `not_configured`. |
| B6 | Growth opportunities | Rules skip unavailable slices; score renormalizes. |
| B7–B9 | ModelGateway, AI runtime, chat | No invented reply without keys. |
| B10 | Content drafts | Grounded copy; no publish to Fit. |
| B11 | Customer RFM + campaign shells | Hashed keys only; Ads `not_configured`. |
| B12 | Studio on ModelGateway | Local only. |
| B13 | Health, JSON logs, backup, smoke | This document. |

B1 deploy landed 2026-10-11 on `/opt/horizon-control-plane` (unit `horizon-control`). Backup at `/root/horizon-control-b1-20261011-093419`. Fit `main` `0396deae` untouched. `:8787` still binds Tailscale only.

## Live baseline (2026-10-11, Tailscale — post B13 deploy)

| Check | Result |
| --- | --- |
| `GET http://100.123.37.74:8787/healthz` | `ok`, bind `100.123.37.74`, integrations `woo/google/ga4/competitors=true`, `ai=false` (`missing_ai_provider_keys`) |
| Public `187.127.43.87:8787` | closed / timeout (correct) |
| Storefront `horizonfit.com.ar` | HTTP 200; Fit `main` `0396deae` untouched |
| Studio `:8790` | not deployed |
| Sales 90d | configured; paid orders present |
| Customers RFM | 3 hashed keys (no email) |
| Campaigns | 2 internal promos; Ads `not_configured` |
| GA4 / GSC | configured + ok (sessions / clicks present) |
| Product 360 `004-TOP-BOR` | catalog/sales/analytics `ok`; search `zero` |
| Competitor snapshot | 4 allowlisted pages, robots skip 0 |
| Growth evaluate | 20 products, 17 open (rules; no invented metrics) |
| `seo.audit` loop | Fit script exits 1 on críticos; Control treats a written report as complete and backs off 12h. Picked newest stamp over stale `latest.json` (Aug). Pruned 62k loop jobs. |
| Backup | First live copy in `/var/lib/horizon-control/backups` (0600). Timer 6h. |
| Dashboard `/app` | SPA live; Auth0 login redirects; JWT needed for `/v1` data |
| Cursor MCP commerce/analytics | **403** by design (`docs/AUTH0.md`) |

## Blockers (human)

1. Auth0 API permissions + Dashboard SPA / user role: add and grant `merchant.read`, `ai.read`, `ai.chat`, `content.read`, `content.write` (plus the existing commerce/analytics set). **Do not** grant Cursor `commerce.read` / `analytics.read`.
2. Optional: put one of `HORIZON_OPENAI_API_KEY` / `HORIZON_ANTHROPIC_API_KEY` / `HORIZON_GEMINI_API_KEY` / `HORIZON_OLLAMA_BASE_URL` in `/etc/horizon-control.env` if chat/content should call a model. Empty stays `configured:false`.

## Honest gaps

- Woo / Google / competitor / LLM keys are env-only. Empty env never invents metrics.
- Google Ads and Meta Ads adapters return `ads_adapter_not_configured`.
- Provider HTTP adapters are injectable; Vercel AI SDK is not installed.
- Live Cursor MCP can catalog/health/storefront; commerce/analytics stay 403 on purpose. Dashboard SPA is the commerce/analytics client.
- Studio `:8790` is out of production V1 on purpose.
- `npm audit --omit=dev` reports 0 high / 0 critical.

## V2 backlog

- Visual competitor diffs
- Real Ads adapters (spend → SKU join)
- PostHog / GrowthBook only if GA4 is not enough
- SQLite → Postgres when the DATA-LAYER trigger fires
- Catalog write pipeline (not this phase)
- Hermes / daily brief automation
- SSE chat after real provider adapters

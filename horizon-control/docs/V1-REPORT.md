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

B1 (VPS backup/deploy/MCP login) is still blocked on SSH as root and human Auth0/MCP/provider-key steps.

## Honest gaps

- Woo / Google / competitor / LLM keys are env-only. Empty env never invents metrics.
- Google Ads and Meta Ads adapters return `ads_adapter_not_configured`.
- Provider HTTP adapters are injectable; Vercel AI SDK is not installed.
- Cursor MCP still needs Auth0 login. Dashboard SPA still needs `merchant.read` granted in Auth0 if that permission is missing.
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

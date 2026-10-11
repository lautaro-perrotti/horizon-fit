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

B1 deploy is still blocked on SSH. MCP from Cursor is authenticated (2026-10-11). Live CP is the **pre-B2** process.

## Live baseline (2026-10-11, Tailscale)

| Check | Result |
| --- | --- |
| `GET http://100.123.37.74:8787/healthz` | `{ ok:true, service:horizon-control, bind:100.123.37.74 }` — old payload, no B13 integrations block |
| `ops.health` | healthy; storefront 200; API 301; db/worker ok; uptime ~29d; repo `main` `0396deae` |
| Storefront config | menu / home / hero / marquee `ok` from existing caches |
| `004-TOP-BOR` catalog | parent SKU, slug `top-falda-bordo`, instock, variants S/M/L |
| `commerce.sales` / `analytics.*` / `insights.get_product` via Cursor MCP | **403** `insufficient_scope` (`commerce.read`, `analytics.read`) |
| SSH `root@100.123.37.74` (and ubuntu/debian/horizon/lsper/admin/deploy) | Permission denied (publickey) |

## Blockers (human)

1. Authorize this pubkey on a sudo user (not necessarily root): `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDTDuH5QAD0ClUNVvpFSJrH6jzdXaZ9QxIyhCIK6XINZ vast-codex`
2. Auth0: grant the Cursor MCP client `commerce.read` + `analytics.read` (and dashboard `merchant.read`) so live 360/sales/GA4/GSC are callable from Cursor.
3. After SSH: backup `/etc/horizon-control.env` + sqlite + units, then deploy `feat/horizon-control` to the existing `:8787` unit. Do not touch horizonfit.com.ar.
4. After deploy: put Woo REST / Google SA / GA4 property / competitor URLs / LLM keys in `/etc/horizon-control.env` if missing. Empty env must stay `configured:false`.

## Honest gaps

- Woo / Google / competitor / LLM keys are env-only. Empty env never invents metrics.
- Google Ads and Meta Ads adapters return `ads_adapter_not_configured`.
- Provider HTTP adapters are injectable; Vercel AI SDK is not installed.
- Live Cursor MCP can catalog/health/storefront; it cannot yet read sales or analytics.
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

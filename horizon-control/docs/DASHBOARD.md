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
  -> SQLite              jobs, audit, metric_snapshots, alerts, stores
```

Auth0 API identifier / JWT `aud` stays `http://100.123.37.74:8787/mcp`. Create a **separate Application** (SPA, PKCE). Do not reuse Horizon Cursor’s Native client.

## MVP (this branch)

| Page | Source | Scope |
| --- | --- | --- |
| Sitio | iframe storefront (`horizonfit.com.ar`) | — (public embed) |
| Salud | `ops.health` | `ops.read` |
| Catálogo | `catalog.search_products` / `catalog.get_product` | `catalog.read` |
| Ventas | `commerce.sales` | `commerce.read` |
| Woo | `commerce.settings` (allowlist, no secrets) + link wp-admin | `commerce.read` |
| Alertas | `alerts.list` / `alerts.evaluate` | `alerts.read` |
| Consulta | sidebar `assistant.ask` | `alerts.read` |

If Woo REST keys are missing, ventas returns `{ configured: false }` — never invent revenue.

**Out of MVP:** Ads publish, GA4/GSC live queries from the UI, visual previews, catalog writes, multi-store registry, SEO tools for the dashboard user unless granted.

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

## Auth0 (dashboard SPA)

1. Applications → Create Application → **Single Page Application**. Name: Horizon Dashboard.
2. Callbacks / logout / web origins: `http://100.123.37.74:8787/app`, `http://100.123.37.74:8787/app/callback`, plus `http://127.0.0.1:8787/app` for local.
3. Authorize this app on API **Horizon Control MCP**. Grant: `openid`, `ops.read`, `catalog.read`, `storefront.read`, `commerce.read`, `metrics.read`, `alerts.read`. The SPA authorize URL includes `openid` plus those API scopes.
4. Token Sender-Constraining: **Never**. Do not enable DPoP.
5. Put the **public** Client ID in `HORIZON_DASHBOARD_CLIENT_ID` on the VPS env. Not a secret.
6. Add API permissions `commerce.read`, `metrics.read`, `alerts.read` (same names as CP scopes).

RBAC: either leave **Enable RBAC OFF** for this API (scopes on the authorize URL land on the JWT) **or** assign a user role that includes those permissions. Granting an application 7/11 is not enough if RBAC is on and the user has no role.

## Alert rules (deterministic, no tokens)

| `rule_id` | Trigger |
| --- | --- |
| `storefront_down` | `ops.health` storefront not ok |
| `sku_out_of_stock` | Store API sample of `outofstock` (max 10) |
| `job_failed` | latest jobs with status `failed` |

`POST /v1/alerts/evaluate` runs rules and upserts. The in-process worker also ticks evaluate on an interval when the process starts.

## Assistant

`POST /v1/assistant/ask` `{ "question": "..." }` routes to health, catalog (limit 10), sales, or alerts. **No model, no full catalog dump.** A later phase can wrap the same tools with an LLM.

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

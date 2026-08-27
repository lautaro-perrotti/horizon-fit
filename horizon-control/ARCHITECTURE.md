# Horizon Control Plane — Architecture (Phase 0 + 1 + 2 + 2.5)

Horizon Control (`horizon-control`) is the **MCP Resource Server** and HTTP command API for Horizon Fit. It is **not** an Authorization Server: it never logs users in, never stores passwords, never mints or refreshes tokens, and never shows consent screens.

Phase 2 replaced mock adapters with **real read-only** catalog, merchant, SEO, repo, health, and storefront adapters.

Phase 2.5 adds **live connectivity + security validation**: Tailscale-only bind, Auth0 JWT on `/mcp`, documented Cursor/Codex/Claude clients, systemd/env artifacts (not installed remotely), MCP-layer tests, and a scope matrix with negative cases. **Zero write capability.**

This document records the **approved** MVP decisions. Later phases (cache.regenerate, catalog writes, repo writes, patches, PRs, deploy, rollback, orders, pricing/stock, shell, SSH, generic HTTP) are out of scope.

## Specs used (auth)

Reviewed before implementation (July 2026-era MCP authorization):

| Source | What we took from it |
| --- | --- |
| [MCP Authorization spec (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) | MCP HTTP servers are OAuth **2.1 Resource Servers**. Clients are OAuth clients. A **separate** AS issues tokens. |
| Same spec + [draft CIMD](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00) | **Client ID Metadata Documents** are the preferred client registration mechanism. **DCR (RFC 7591) is optional / legacy**, not something we implement. Closed-set clients may be **pre-registered** at the AS. |
| [RFC 9728](https://datatracker.ietf.org/html/rfc9728) Protected Resource Metadata | Publish `/.well-known/oauth-protected-resource` (and path-aware `/mcp` variant). On 401, send `WWW-Authenticate: Bearer … resource_metadata="…"`. |
| [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html) Resource Indicators | Validate JWT `aud` / resource against this server. Reject tokens minted for someone else. |
| [RFC 6750](https://datatracker.ietf.org/html/rfc6750) | Bearer usage. `invalid_token` → 401. `insufficient_scope` → 403. Include `scope` on challenges when useful. |
| [MCP TS SDK — Require authorization](https://ts.sdk.modelcontextprotocol.io/v2/serving/authorization.html) | `requireBearerAuth` + `verifyAccessToken` only. **Do not** use frozen AS helpers (`mcpAuthRouter`, `ProxyOAuthServerProvider`) in `@modelcontextprotocol/server-legacy/auth`. |
| [MCP security tutorial 2026-07-28](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/authorization) | Discovery chain: 401 → PRM → AS metadata (RFC 8414 / OIDC Discovery) → token → retry. |
| [Auth0: Authorization for your MCP server](https://auth0.com/ai/docs/mcp/get-started/authorization-for-your-mcp-server) + [Resource Parameter Compatibility Profile](https://auth0.com/ai/docs/mcp/guides/resource-param-compatibility-profile) | Hosted AS that can mint **JWT access tokens** for an API identifier, custom scopes, and RFC 8707 `resource`. |

## Network (MVP)

**Tailscale only.** `horizon-control` is **not** published on public nginx. There is no `control.horizonfit.com.ar` and no public `/mcp`.

```
PC (Cursor, Claude, Codex, horizon CLI)
        -- Tailscale --
VPS horizon-control process  (:8787 bind Tailscale IP or 127.0.0.1)
        /v1  +  /mcp  +  in-process job worker
```

Bind default: `127.0.0.1`. Production bind: the VPS Tailscale address (`100.64.0.0/10`) or loopback. The process **refuses** `0.0.0.0` / `::` / WAN IPs.

See `docs/TAILSCALE.md`. **Explicit later non-goal (do not design now):** SaaS/cloud-hosted agents that cannot join Tailscale.

## Process model

One Node 22 process:

- HTTP `/v1` (Hono) — same commands as MCP
- HTTP `/mcp` — Streamable HTTP adapter (`@modelcontextprotocol/sdk`). **Zero business logic.**
- In-process SQLite job worker
- Read-only adapters: Woo Store API, local/HTTP merchant artifacts, local git, HTTP health probes, storefront cache/REST, typed job argv (`scripts/seo-audit.js`, PHP/node validators)

No second microservice. No Kubernetes. **Not** added to the shop `docker-compose.yml`. A systemd unit file exists at `ops/systemd/horizon-control.service` as a **file only** (not installed on the VPS by this branch). SQLite lives in `HORIZON_DATA_DIR` (default `/var/lib/horizon-control`), outside the git repo. Liveness: `GET /healthz`. Phase 2.5 does **not** SSH, open public nginx ports, or deploy.

## Identity: Auth0 (hosted OIDC)

**Choice: Auth0** as the external Authorization Server.

Why this and not the rejected options:

| Option | Verdict |
| --- | --- |
| **Auth0** | Smallest *hosted* AS that matches MCP-as-RS: JWT + JWKS, many applications (clients), **custom API scopes**, M2M (CLI) + Auth Code + PKCE (agents). First-party MCP RS docs and RFC 8707 `resource` via the Resource Parameter Compatibility Profile. **API first** (identifier `https://horizon-control`); pre-register Claude, Cursor, Codex, Admin, and CLI **later**. |
| Zitadel Cloud | Also a valid hosted OIDC. Slightly less MCP-specific documentation for `resource` / API scopes. Keep as fallback if Auth0 cost/terms become a problem. |
| Keycloak self-hosted | Rejected: operational surface on the VPS. |
| Minting JWTs inside horizon-control | Rejected: that would make CP an Authorization Server. |
| GitHub as the only AS | Rejected: GitHub OAuth does not give a clean custom-scope matrix (`catalog.read` vs `seo.execute` vs `tests.execute`) on JWTs meant for *this* resource. |

Auth0 tenant setup (human; exact clicks in `docs/AUTH0.md`):

1. Create an **API** (resource server) named **Horizon Control** whose identifier is `HORIZON_OIDC_AUDIENCE` (`https://horizon-control`). JWT Profile **RFC 9068**, signing **RS256**.
2. Enable **RBAC** and **Add Permissions in the Access Token** (token dialect **`rfc9068_profile_authz`**). Tenant **Settings → Advanced → Resource Parameter Compatibility Profile** → **ON** so MCP clients sending RFC 8707 `resource=https://horizon-control` get a JWT `aud` we can verify.
3. **API first:** do not create Auth0 Applications / clients yet. Pre-register `horizon-claude`, `horizon-cursor`, `horizon-codex`, `horizon-admin`, `horizon-cli` in a later pass. Do **not** enable DCR.
4. Permissions are listed below (`ops.read` is required by current code for `ops.health`). Cursor/Codex MCP config: `docs/MCP-CLIENTS.md`.

CP validates Bearer tokens only:

- `iss` == `HORIZON_OIDC_ISSUER`
- `aud` / resource includes `HORIZON_OIDC_AUDIENCE`
- `exp` (clock skew ~60s)
- signature via JWKS (`HORIZON_OIDC_JWKS_URL` or `{issuer}/.well-known/jwks.json`)
- client identity from `azp` / `client_id` / `sub`
- scopes from `scope` (space-delimited) and/or `permissions`

**Tests** never call a live IdP. They sign JWTs with a local RSA key and validate against a test JWKS. In-process JWKS is rejected unless `NODE_ENV=test`.

## Scopes and tools (MVP — 12 tools)

Scope names (Auth0 API permissions; inbound aliases `seo.execute`→`seo.audit`, `merchant.execute`→`merchant.audit`):

| Scope | Tools |
| --- | --- |
| `ops.read` | `ops.health` |
| `catalog.read` | `catalog.search_products`, `catalog.get_product` |
| `storefront.read` | `storefront.get_config` |
| `seo.read` | `seo.get_latest_audit` |
| `seo.audit` | `seo.audit` (enqueue allowlisted crawl; gitignored report) |
| `merchant.read` | `merchant.get_diagnostics` |
| `merchant.audit` | `merchant.audit` (read existing artifacts; record a job; **do not regenerate**) |
| `repo.read` | `repo.status` |
| `tests.execute` | `tests.run` (enqueue existing PHP/node validators) |
| `jobs.read` | `jobs.get` |
| `audit.read` | `audit.history` |

### Client matrix

| Client | Allowed tools | Denied |
| --- | --- | --- |
| **Claude** | health, catalog.*, storefront.get_config, seo.*, merchant.*, jobs.get, audit.history | `repo.status`, `tests.run` |
| **Cursor** | health, catalog.*, storefront.get_config, repo.status, tests.run, jobs.get, audit.history | `seo.audit`, `merchant.audit` (and seo.read / merchant.read) |
| **Codex** | same as Cursor | `seo.audit`, `merchant.audit` |
| **Admin** | all 12 | writes (not registered) |

### Hard deny list (must never be registered)

`shell.execute`, `ssh`, `wp.eval`, generic `docker exec`, `sql`, `files.write` on prod, `cache.regenerate`, `deploy`, `rollback`, `repo.merge`, catalog/price/stock writes, generic `http.request` / shell.

`seo.audit` / `tests.run` / `merchant.audit` are **controlled operational jobs**. They may write **gitignored reports**. They are **not** business-data writes.

## Layering

```
MCP tools / HTTP /v1 / CLI
        ↓  (authn + scope)
   core/commands   ← only place with business rules
        ↓
   adapters: catalog (Woo Store API GET, no credentials)
             storefront (cache JSON + public REST)
             merchant (existing artifacts only)
             git (read-only status)
             health (HTTP storefront + API + local repo)
             process (allowlisted job argv)
             github (stub)
        ↓
   SQLite: jobs, audit_events, idempotency_keys
           (NO oauth client/token tables)
```

OIDC config **never** leaves the process. Audit logs store **redacted** args (keys matching `/password|token|authorization|secret|passwd|api[_-]?key|cookie|bearer/i` plus `HORIZON_*` / `WOO_*`). Catalog filters are stored as the allowlisted query fields only. Bearer tokens, cookies, and env values are stripped from errors.

## Reused existing ops (invoke, do not rewrite)

| Concern | Existing artifact |
| --- | --- |
| Health | HTTP GET `HORIZON_STOREFRONT_URL` + `HORIZON_WOO_BASE_URL`; local `git` HEAD; CP uptime; SQLite ping; job worker. Status `healthy` / `degraded` / `unavailable`. No Docker/SSH this phase. |
| Catalog | Public Woo Store API `GET /wp-json/wc/store/v1/products` (query, sku, category, stock_status, page). Color/talle filtered locally. Tests **mock HTTP**. Never mutates Woo. |
| Storefront config | Read `uploads/horizon-fit-cache/{menu,home-sections,home-layout}.json` when `HORIZON_CACHE_DIR` is set, else public cache/REST on the API host. Missing pieces are `unavailable` (never invented). |
| SEO audit | Enqueue `node scripts/seo-audit.js` with argv allowlist **`https://horizonfit.com.ar`** (+ www if passed internally). Agent URLs are ignored. Tests mock the runner. |
| Latest SEO audit | Latest `seo.audit` **job** result (not a live crawl). |
| Merchant | **Read** `merchant-diagnostics.txt` / `merchant-products.json` from `HORIZON_MERCHANT_DIAGNOSTICS_PATH`, else an allowlisted endpoint, else `diagnostics_unavailable`. Do not regenerate. |
| Repo status | Local `git` of `HORIZON_REPO_PATH` (branch, HEAD, dirty summary, ahead/behind, remote). Fetch only if `HORIZON_GIT_FETCH=1`. No checkout/reset/clean/commit/push. |
| Tests.run | Enqueue `php tests/search-merchant-tests.php` + `node scripts/validate-home-v1.js` if binaries exist. CP unit tests mock this. |

## GitHub branch protection

Agents never receive `repo.merge`. Humans merge via PR.

**Required on `main`:** PR required, no force push, no deletions, status checks then merge. Existing VPS deploy timer (~1 min) is unchanged.

**Enabled 2026-08-27** via `gh` on `lautaro-perrotti/horizon-fit` `main`: PR required (1 approving review), `enforce_admins` true, force pushes disabled, deletions disabled. No required status-check contexts yet (none configured in CI). Agents never receive `repo.merge`.

If this rule is ever removed, restore it with:

```text
gh api -X PUT repos/lautaro-perrotti/horizon-fit/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input protection.json
```

GitHub UI fallback: Repo → Settings → Branches → rule for `main` → Require a pull request before merging, Do not allow bypassing, Block force pushes, Block deletions.

## Env (production / VPS)

```
HORIZON_BIND=127.0.0.1          # or Tailscale IP; never 0.0.0.0
HORIZON_PORT=8787
HORIZON_PUBLIC_URL=http://<tailscale-ip>:8787
HORIZON_OIDC_ISSUER=https://<tenant>.auth0.com/
HORIZON_OIDC_AUDIENCE=https://horizon-control
HORIZON_OIDC_JWKS_URI=https://<tenant>.auth0.com/.well-known/jwks.json
HORIZON_STOREFRONT_URL=https://horizonfit.com.ar
HORIZON_WOO_BASE_URL=https://api.horizonfit.com.ar
HORIZON_REPO_PATH=/root/horizon-fit
HORIZON_CACHE_DIR=.../uploads/horizon-fit-cache
HORIZON_MERCHANT_DIAGNOSTICS_PATH=.../uploads/horizon-fit-merchant
HORIZON_DATA_DIR=/var/lib/horizon-control
HORIZON_SQLITE_PATH=/var/lib/horizon-control/horizon-control.sqlite
```

Phase 2 catalog uses the **public Store API** (no Woo application password). Optional `HORIZON_MERCHANT_DIAGNOSTICS_URL` is an allowlisted HTTP fallback. `HORIZON_GIT_FETCH` defaults off.

Default `npm test` never hits production or Auth0. It exercises `/mcp` Streamable HTTP + JWT (test JWKS) + fixture adapters. `npm run test:integration` is opt-in via `HORIZON_INTEGRATION=1`. `npm run test:e2e` / `test:live` is opt-in via `HORIZON_E2E=1` plus `HORIZON_CONTROL_URL` and `HORIZON_E2E_TOKEN`. Test JWKS is allowed only when `NODE_ENV=test`.

## Leftover human setup

1. Join the VPS and operator PCs to the same Tailscale tailnet (`docs/TAILSCALE.md`). Bind CP to loopback or the Tailscale IP only.
2. Create the Auth0 **API** (Horizon Control, identifier `https://horizon-control`) and permissions (`docs/AUTH0.md`). Do **not** create Applications/clients yet. Put issuer/audience/JWKS into `/etc/horizon-control.env` (mode 0600), not git.
3. Point Cursor (then Codex/Claude) at `/mcp` (`docs/MCP-CLIENTS.md`). Tokens stay in env / client secret storage.
4. GitHub `main` branch protection was enabled (PR required, no force push, no deletions). Confirm in the UI if you want status checks added later.
5. Do **not** put `horizon-control` on public nginx or in shop `docker-compose.yml`.
6. Install the systemd unit later, by hand (`docs/DEPLOY.md`), after Tailscale + Auth0 exist. This branch only adds the file.

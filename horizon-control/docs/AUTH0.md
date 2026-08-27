# Auth0 setup — Horizon Control Resource Server (API first)

Horizon Control is an OAuth **2.1 Resource Server**. Auth0 is the Authorization Server. CP never mints tokens, never stores client secrets, and never shows login UI.

**This document is API-first.** Create the Auth0 **API** (resource server), permissions, and the tenant RFC 8707 toggle below. **Do not create Auth0 Applications / clients yet** — those come later.

Put issuer / audience / JWKS URL in `/etc/horizon-control.env` (`chmod 0600`). **Do not commit secrets or tenant-specific client secrets.**

Locked audience used in env and tokens: `HORIZON_OIDC_AUDIENCE=https://horizon-control`.

## 1. Create the API (resource server)

1. Auth0 Dashboard → **Applications → APIs → Create API**.
2. **Name:** `Horizon Control`
3. **Identifier:** `https://horizon-control`  
   This value is the JWT `aud`. It must match `HORIZON_OIDC_AUDIENCE` exactly (trailing-slash differences are tolerated in code).
4. **JSON Web Token (JWT) Profile:** RFC 9068
5. **Signing Algorithm:** RS256
6. Create the API.
7. Settings:
   - Enable **RBAC**
   - Enable **Add Permissions in the Access Token** (token dialect **`rfc9068_profile_authz`**: access token is a JWT with `permissions` + `scope`)
8. Tenant **Settings → Advanced → Resource Parameter Compatibility Profile** → **ON** (RFC 8707 `resource` for MCP). MCP clients send `resource=https://horizon-control` and receive an access token whose `aud` is this API.
9. Access token expiration: pick a short TTL (e.g. 8–24h). CP requires `exp` and checks signature via JWKS (`~60s` clock skew).

Do **not** create Applications on this pass.

## 2. Permissions (scopes)

API → **Permissions**. Add exactly these (name + description):

| Permission | Description |
| --- | --- |
| `catalog.read` | Catalog search/get |
| `storefront.read` | Storefront config |
| `seo.read` | Latest SEO audit job |
| `seo.audit` | Enqueue allowlisted SEO audit |
| `merchant.read` | Read merchant diagnostics |
| `merchant.audit` | Record merchant.audit job (no regenerate) |
| `repo.read` | Local git status |
| `tests.execute` | Enqueue existing validators |
| `jobs.read` | Read jobs |
| `audit.read` | Read redacted audit history |
| `ops.read` | Health (`ops.health`) — **additional permission required by current CP code** (`TOOL_SCOPES["ops.health"]` = `ops.read`). Add it on the API; do not omit it. |

Do **not** create write/deploy/shell scopes.

## 3. Applications (clients) — later

**Skip this section for now.** Do not create Auth0 Applications, Native/SPA/M2M clients, or authorize apps on the API until a later pass.

When clients are added later, pre-register a closed set (no Dynamic Client Registration). Suggested names and scope matrices live in `docs/MCP-CLIENTS.md` and `ARCHITECTURE.md`; they are not a create-now checklist.

## 4. What CP validates

On every `/mcp` and `/v1` request except `/healthz`:

- `iss` == `HORIZON_OIDC_ISSUER` (trailing slash normalized)
- `aud` includes `HORIZON_OIDC_AUDIENCE` (`https://horizon-control`) or the `/mcp` resource URL
- `exp` present and not expired
- RS256 signature via JWKS (`HORIZON_OIDC_JWKS_URI` or `{issuer}/.well-known/jwks.json`)
- Client identity: `azp` / `client_id` / `sub` (optional alias map)
- Scopes: union of `scope`, `permissions`, `scp`

Missing/invalid/expired/wrong iss/aud → **401**. Missing tool scope → **403**.

## 5. Env (no secrets required for RS mode)

```
HORIZON_OIDC_ISSUER=https://YOUR_TENANT.auth0.com/
HORIZON_OIDC_AUDIENCE=https://horizon-control
HORIZON_OIDC_JWKS_URI=https://YOUR_TENANT.auth0.com/.well-known/jwks.json
```

CP never sets `AUTH_DISABLED`, never accepts a master key, and never uses a static shared token.

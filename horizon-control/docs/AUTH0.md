# Auth0 setup — Horizon Control Resource Server

Horizon Control is an OAuth **2.1 Resource Server**. Auth0 is the Authorization Server. CP never mints tokens, never stores client secrets, and never shows login UI.

Put issuer / audience / JWKS URL in `/etc/horizon-control.env` (`chmod 0600`). **Do not commit secrets or tenant-specific client secrets.**

## Why a new API (identifier is immutable)

Auth0 API identifiers cannot be changed after create.

Cursor’s MCP client requires Protected Resource Metadata `resource` to equal the MCP URL (`http://100.123.37.74:8787/mcp`) **or** its origin (`http://100.123.37.74:8787`). Auth0 then looks up an API whose **Identifier** is that same `resource` string. If they differ, Auth0 returns “Service not found” and Cursor fails with a protected-resource mismatch.

A Tailscale IP inside an Auth0 API identifier is unfortunate, but it is required: Cursor checks the MCP URL it connected to, and Auth0 looks up that exact identifier. **Do not** invent a public hostname for Control Plane to “clean up” the identifier.

The old API `https://horizon-control` can stay in the tenant unused. CP still accepts that value as a legacy JWT `aud`.

Production audience / identifier (set `HORIZON_OIDC_AUDIENCE` to this exact string):

`http://100.123.37.74:8787/mcp`

## 1. Create the new API (resource server)

1. Auth0 Dashboard → **Applications → APIs → Create API**.
2. **Name:** `Horizon Control MCP` (any name; Identifier is what matters).
3. **Identifier:** `http://100.123.37.74:8787/mcp`  
   Copy this string exactly (no trailing slash, include `/mcp`). This is the JWT `aud` and the RFC 8707 `resource`.
4. **JSON Web Token (JWT) Profile:** RFC 9068
5. **Signing Algorithm:** RS256
6. Create the API.
7. Settings:
   - Enable **RBAC**
   - Enable **Add Permissions in the Access Token** (token dialect **`rfc9068_profile_authz`**: access token is a JWT with `permissions` + `scope`)
8. Tenant **Settings → Advanced → Resource Parameter Compatibility Profile** → **ON** (already on is fine). MCP clients send RFC 8707 `resource=http://100.123.37.74:8787/mcp` and receive an access token whose `aud` is this API.
9. Access token expiration: pick a short TTL (e.g. 8–24h). CP requires `exp` and checks signature via JWKS (`~60s` clock skew).

## 2. Permissions (scopes)

API → **Permissions**. Add exactly these (name + description), same set as the old Horizon Control API:

| Permission | Description |
| --- | --- |
| `ops.read` | Health (`ops.health`) |
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

Do **not** create write/deploy/shell scopes.

## 3. Authorize Horizon Cursor (7 of 11)

On the new API, authorize application **Horizon Cursor** (Client ID `SI2VlbjDYP7uDaKfPixF4iXoQCIwk5ID`) and grant **only** these permissions:

- `ops.read`
- `catalog.read`
- `storefront.read`
- `repo.read`
- `tests.execute`
- `jobs.read`
- `audit.read`

Do **not** grant `seo.read`, `seo.audit`, `merchant.read`, or `merchant.audit` to Cursor.

Client IDs are not secrets. Do not put client secrets in git.

## 4. What CP validates

On every `/mcp` and `/v1` request except `/healthz`:

- `iss` == `HORIZON_OIDC_ISSUER` (trailing slash normalized)
- `aud` is on the allowlist: values from `HORIZON_OIDC_AUDIENCE` (comma-separated allowed), plus legacy `https://horizon-control`, plus the computed MCP `resourceUrl` (`HORIZON_PUBLIC_URL/mcp`), deduped. Trailing-slash and `/mcp` suffix differences are tolerated.
- `exp` present and not expired
- RS256 signature via JWKS (`HORIZON_OIDC_JWKS_URI` or `{issuer}/.well-known/jwks.json`)
- Client identity: `azp` / `client_id` / `sub` (optional alias map)
- Scopes: union of `scope`, `permissions`, `scp`

Missing/invalid/expired/wrong iss/aud → **401**. Missing tool scope → **403**.

## 5. Env (no secrets required for RS mode)

```
HORIZON_OIDC_ISSUER=https://YOUR_TENANT.auth0.com/
HORIZON_OIDC_AUDIENCE=http://100.123.37.74:8787/mcp
HORIZON_OIDC_JWKS_URI=https://YOUR_TENANT.auth0.com/.well-known/jwks.json
```

Set `HORIZON_OIDC_AUDIENCE` to the new API identifier (the MCP URL). Keep `https://horizon-control` unused in Auth0; CP still accepts it as JWT `aud` so leftover tokens do not explode.

CP never sets `AUTH_DISABLED`, never accepts a master key, and never uses a static shared token.

# Auth0 setup — Horizon Control Resource Server

Horizon Control is an OAuth **2.1 Resource Server**. Auth0 is the Authorization Server. CP never mints tokens, never stores client secrets, and never shows login UI.

Put issuer / audience / JWKS URL in `/etc/horizon-control.env` (`chmod 0600`). **Do not commit secrets or tenant-specific client secrets.** Application **Client IDs** are identifiers (not passwords); still keep them out of git and use env on operator machines.

Audience used in code and tokens: `HORIZON_OIDC_AUDIENCE` (default identifier `https://horizon-control.tailnet/mcp`).

## 1. Create the API (resource server)

1. Auth0 Dashboard → **Applications → APIs → Create API**.
2. **Name:** `Horizon Control`
3. **Identifier:** `https://horizon-control.tailnet/mcp`  
   This value is the JWT `aud`. It must match `HORIZON_OIDC_AUDIENCE` exactly (trailing-slash differences are tolerated in code).
4. **Signing Algorithm:** RS256
5. Create the API.
6. Settings:
   - Enable **RBAC**
   - Enable **Add Permissions in the Access Token** (so `permissions` is present)
   - Token dialect: **`rfc9068_profile_authz`** when the tenant offers it (access token is a JWT with `permissions` + `scope`)
   - Enable **Allow Skipping User Consent** for first-party apps if you want quieter agent login
7. **Resource Parameter Compatibility Profile** (Auth0 MCP docs): enable so MCP clients sending RFC 8707 `resource=https://horizon-control.tailnet/mcp` get an access token whose `aud` is this API.
8. Access token expiration: pick a short TTL (e.g. 8–24h). CP requires `exp` and checks signature via JWKS (`~60s` clock skew).

## 2. Permissions (scopes)

API → **Permissions**. Add exactly these (name + description):

| Permission | Description |
| --- | --- |
| `ops.read` | Health |
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

## 3. Applications (clients)

Dashboard → **Applications → Create Application**. **Do not enable Dynamic Client Registration.** Pre-register only these.

| Dashboard name | Type | Suggested grant | Scopes to authorize |
| --- | --- | --- | --- |
| `horizon-claude` | Native or SPA (PKCE) | Authorization Code + PKCE | `ops.read catalog.read storefront.read seo.read seo.audit merchant.read merchant.audit jobs.read audit.read` — **not** `repo.read`, **not** `tests.execute` |
| `horizon-cursor` | Native | Authorization Code + PKCE | `ops.read catalog.read storefront.read repo.read tests.execute jobs.read audit.read` — **not** `seo.audit`, **not** `merchant.audit` (and not `seo.read` / `merchant.read`) |
| `horizon-codex` | Native | Authorization Code + PKCE | Same as Cursor |
| `horizon-admin` | Native or SPA | Authorization Code + PKCE | **All** permissions above |
| `horizon-cli` | Machine to Machine | Client Credentials | Same as Admin, API = Horizon Control |

For each:

1. Note **Client ID**. Optional: set `HORIZON_OIDC_CLIENT_ALIASES=<clientId>:claude,...` on CP so audit logs show `claude` instead of the Auth0 id.
2. Allowed callback URLs: Cursor/Claude/Codex MCP OAuth callback (`http://127.0.0.1:*` / the URL the client documents). Admin/CLI as needed.
3. **Client secret:** M2M (`horizon-cli`) only. Store in the operator password manager. Never in git, never in CP env (CP does not call Auth0’s token endpoint).
4. Authorize the app on the Horizon Control API and **limit permissions** to the matrix above (Auth0: Application → APIs → Horizon Control → grant selected permissions). For M2M, grant permissions on the API → Machine to Machine tab.

## 4. What CP validates

On every `/mcp` and `/v1` request except `/healthz`:

- `iss` == `HORIZON_OIDC_ISSUER` (trailing slash normalized)
- `aud` includes `HORIZON_OIDC_AUDIENCE` (or the `/mcp` resource URL)
- `exp` present and not expired
- RS256 signature via JWKS (`HORIZON_OIDC_JWKS_URI` or `{issuer}/.well-known/jwks.json`)
- Client identity: `azp` / `client_id` / `sub` (optional alias map)
- Scopes: union of `scope`, `permissions`, `scp`

Missing/invalid/expired/wrong iss/aud → **401**. Missing tool scope → **403**.

## 5. Env on the VPS (no secrets required for RS mode)

```
HORIZON_OIDC_ISSUER=https://YOUR_TENANT.auth0.com/
HORIZON_OIDC_AUDIENCE=https://horizon-control.tailnet/mcp
HORIZON_OIDC_JWKS_URI=https://YOUR_TENANT.auth0.com/.well-known/jwks.json
```

CP never sets `AUTH_DISABLED`, never accepts a master key, and never uses a static shared token.

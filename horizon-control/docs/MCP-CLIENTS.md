# MCP clients — Cursor (priority), Codex, Claude

Tokens **never** belong in versioned files. Use env interpolation or Cursor/Codex OAuth storage. Example: `horizon-control/examples/mcp.json.example`.

Control plane URL is Tailscale-only: `http://100.123.37.74:8787/mcp` (or `http://127.0.0.1:8787/mcp` via SSH tunnel). See `docs/TAILSCALE.md`. **Do not** put Control Plane on a public hostname.

RFC 8707 `resource` and JWT `aud` must be the **MCP URL** (`http://100.123.37.74:8787/mcp`), not `https://horizon-control`. Cursor requires Protected Resource Metadata `resource` to equal that URL (or its origin). Auth0 looks up an API whose Identifier is that same string — so the Auth0 API identifier has to contain the Tailscale IP. See `docs/AUTH0.md`.

## Cursor (priority)

Project: `.cursor/mcp.json` (not committed with secrets). Global: `~/.cursor/mcp.json`.

Auth0 app: **Horizon Cursor**, Client ID `SI2VlbjDYP7uDaKfPixF4iXoQCIwk5ID` (not a secret). Grant 7 of 11 API permissions: `ops.read`, `catalog.read`, `storefront.read`, `repo.read`, `tests.execute`, `jobs.read`, `audit.read`. No `seo.*`, no `merchant.*`.

MCP tool names use underscores (`catalog_search_products`, `ops_health`). Cursor/LLM APIs reject dots (`^[a-zA-Z0-9_-]{1,64}$`). HTTP `/v1` command names stay dotted. After a CP restart, **Logout then Connect** so Cursor re-lists tools.

### Option A — OAuth (preferred)

1. Copy **Client ID** only (above). Never commit a client secret.
2. Set `HORIZON_CURSOR_CLIENT_ID` in the OS user environment (not in git).
3. Config (`url` / `resource` / `audience` are the MCP URL — Cursor also reads this from PRM):

```json
{
  "mcpServers": {
    "horizon-control": {
      "url": "http://100.123.37.74:8787/mcp",
      "auth": {
        "CLIENT_ID": "${env:HORIZON_CURSOR_CLIENT_ID}",
        "audience": "http://100.123.37.74:8787/mcp",
        "resource": "http://100.123.37.74:8787/mcp",
        "scopes": [
          "ops.read",
          "catalog.read",
          "storefront.read",
          "repo.read",
          "tests.execute",
          "jobs.read",
          "audit.read"
        ]
      }
    }
  }
}
```

4. Cursor Settings → Tools & MCP → Connect (or reload window after Auth0/VPS changes). Browser PKCE against Auth0. Cursor stores the token locally; CP sees a Bearer JWT on every `/mcp` call.
5. Auth0 tenant **Resource Parameter Compatibility Profile** must stay **ON** so `resource=http://100.123.37.74:8787/mcp` yields `aud` `http://100.123.37.74:8787/mcp`.

### Option B — Bearer from env (M2M / CLI token)

Do **not** paste the JWT into `mcp.json`.

```json
{
  "mcpServers": {
    "horizon-control": {
      "url": "http://100.123.37.74:8787/mcp",
      "headers": {
        "Authorization": "Bearer ${env:HORIZON_CONTROL_TOKEN}"
      }
    }
  }
}
```

Mint `HORIZON_CONTROL_TOKEN` via Auth0 against audience / resource `http://100.123.37.74:8787/mcp`. Rotate by changing the env var.

## Codex

Codex MCP remote servers typically live in `~/.codex/config.toml` (or the project `.codex` config). Keep the token in the environment. OAuth audience / RFC 8707 `resource`: `http://100.123.37.74:8787/mcp`.

```toml
[mcp_servers.horizon-control]
url = "http://100.123.37.74:8787/mcp"
http_headers.Authorization = "Bearer ${HORIZON_CONTROL_TOKEN}"
```

If your Codex build uses a different key (`bearer_token_env_var`, `headers`), point it at `HORIZON_CONTROL_TOKEN` the same way — still not a committed secret. When using Auth0 app `horizon-codex`, use the Cursor scope matrix.

## Claude

Same Tailscale MCP URL and the same audience / resource `http://100.123.37.74:8787/mcp`. Auth0 app `horizon-claude` uses the Claude scope matrix (`seo.audit` / `merchant.audit` allowed; **no** `repo.read` / `tests.execute`). Configure Claude’s MCP remote connector with OAuth client id or a header from env, never a committed token.

## Scope reminder

| Client | Allowed | Denied |
| --- | --- | --- |
| Claude | catalog, storefront, seo_*, merchant_*, jobs, audit, ops_health | `repo_status`, `tests_run` |
| Cursor / Codex | catalog, storefront, repo_status, tests_run, jobs, audit, ops_health | `seo_audit`, `merchant_audit` |
| Admin | all registered read tools | writes (not registered) |
| Dashboard SPA | health, catalog, storefront, commerce, metrics, alerts | seo, merchant, repo, tests |

## Verify

`npx @modelcontextprotocol/inspector http://127.0.0.1:8787/mcp` with `Authorization: Bearer …`, or `npm run test:e2e` as in `docs/DEPLOY.md`.

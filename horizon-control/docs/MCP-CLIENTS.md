# MCP clients — Cursor (priority), Codex, Claude

Tokens **never** belong in versioned files. Use env interpolation or Cursor/Codex OAuth storage. Example: `horizon-control/examples/mcp.json.example`.

Control plane URL is Tailscale-only, e.g. `http://100.x.y.z:8787/mcp` or `http://127.0.0.1:8787/mcp` via SSH tunnel. See `docs/TAILSCALE.md`.

## Cursor (priority)

Project: `.cursor/mcp.json` (not committed with secrets). Global: `~/.cursor/mcp.json`.

### Option A — OAuth (preferred)

1. Create Auth0 app `horizon-cursor` (PKCE). Copy **Client ID** only.
2. Set `HORIZON_CURSOR_CLIENT_ID` in the OS user environment (not in git).
3. Config:

```json
{
  "mcpServers": {
    "horizon-control": {
      "url": "http://REPLACE_WITH_TAILSCALE_IP:8787/mcp",
      "auth": {
        "CLIENT_ID": "${env:HORIZON_CURSOR_CLIENT_ID}",
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

4. Cursor Settings → Tools & MCP → Connect. Browser PKCE against Auth0. Cursor stores the token locally; CP sees a Bearer JWT on every `/mcp` call.
5. Auth0 must have the Cursor callback URL allowed and **Resource Parameter Compatibility Profile** enabled so `aud` is `https://horizon-control.tailnet/mcp`.

### Option B — Bearer from env (M2M / CLI token)

Do **not** paste the JWT into `mcp.json`.

```json
{
  "mcpServers": {
    "horizon-control": {
      "url": "http://REPLACE_WITH_TAILSCALE_IP:8787/mcp",
      "headers": {
        "Authorization": "Bearer ${env:HORIZON_CONTROL_TOKEN}"
      }
    }
  }
}
```

Mint `HORIZON_CONTROL_TOKEN` via Auth0 (Authorization Code or Client Credentials for `horizon-cli`). Rotate by changing the env var.

## Codex

Codex MCP remote servers typically live in `~/.codex/config.toml` (or the project `.codex` config). Keep the token in the environment:

```toml
[mcp_servers.horizon-control]
url = "http://REPLACE_WITH_TAILSCALE_IP:8787/mcp"
http_headers.Authorization = "Bearer ${HORIZON_CONTROL_TOKEN}"
```

If your Codex build uses a different key (`bearer_token_env_var`, `headers`), point it at `HORIZON_CONTROL_TOKEN` the same way — still not a committed secret. Use Auth0 app `horizon-codex` with the Cursor scope matrix.

## Claude

Same Tailscale URL. Use Auth0 app `horizon-claude` with the Claude scope matrix (`seo.audit` / `merchant.audit` allowed; **no** `repo.read` / `tests.execute`). Configure Claude’s MCP remote connector with OAuth client id or a header from env, never a committed token.

## Scope reminder

| Client | Allowed | Denied |
| --- | --- | --- |
| Claude | catalog, storefront, seo.*, merchant.*, jobs, audit, ops.health | `repo.status`, `tests.run` |
| Cursor / Codex | catalog, storefront, repo.status, tests.run, jobs, audit, ops.health | `seo.audit`, `merchant.audit` |
| Admin | all 12 tools | writes (not registered) |

## Verify

`npx @modelcontextprotocol/inspector http://127.0.0.1:8787/mcp` with `Authorization: Bearer …`, or `npm run test:e2e` as in `docs/DEPLOY.md`.

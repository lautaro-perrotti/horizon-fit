# Horizon Control

Read-only MCP Resource Server for Horizon Fit. Agents (Cursor, Claude, Codex) talk OAuth → MCP → this process. **No catalog/content/price/stock writes, no repo writes, no deploy, no shell.**

| Doc | Contents |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Decisions, scopes, adapters |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | systemd, data dir, nginx, live smoke commands |
| [docs/TAILSCALE.md](./docs/TAILSCALE.md) | VPS + PC tailnet; no public ports |
| [docs/AUTH0.md](./docs/AUTH0.md) | API Horizon Control (RFC 9068); clients later |
| [docs/MCP-CLIENTS.md](./docs/MCP-CLIENTS.md) | Cursor / Codex / Claude config |
| [examples/mcp.json.example](./examples/mcp.json.example) | `mcp.json` with env placeholders |

```bash
npm test                 # fixtures + MCP HTTP + test JWKS (no Auth0)
npm run test:e2e         # HORIZON_E2E=1 + live URL + JWT
npm run test:integration # HORIZON_INTEGRATION=1 adapter checks
```

# Horizon Control — VPS start (human, later)

This branch **does not** SSH to the VPS, install systemd, open nginx ports, or deploy the storefront. It only adds files.

Horizon Control stays **out of** shop `docker-compose.yml`. Public nginx (`docker/nginx/horizon-fit.conf`) continues to serve only `horizonfit.com.ar` → SPA `:8088` and `api.horizonfit.com.ar` → WordPress `:8089`. There is no `location /mcp` or `/v1` on those server blocks.

## Bind and data

| Item | Value |
| --- | --- |
| Listen | `HORIZON_BIND` = `127.0.0.1` or the VPS Tailscale IP (`100.64.0.0/10`). **Never** `0.0.0.0`. |
| Port | `8787` (tailnet only; not in public nginx) |
| SQLite | `/var/lib/horizon-control/horizon-control.sqlite` via `HORIZON_DATA_DIR` (outside the git repo) |
| Liveness | `GET /healthz` (no JWT). Full `ops.health` is `GET /v1/health` with Bearer. |

The process refuses to start if `HORIZON_BIND` is a public or wildcard address.

## Files in this repo

| Path | Role |
| --- | --- |
| `ops/systemd/horizon-control.service` | Unit template (restart, journald, `EnvironmentFile` 0600 check) |
| `ops/systemd/horizon-control.env.example` | Env template — copy, fill, **do not commit** |
| `horizon-control/.env.example` | Dev env template |

## Human steps on the VPS (after Tailscale + Auth0)

1. Join the VPS to the tailnet. Note its Tailscale IPv4.
2. Clone or pull the **control-plane worktree** at `/opt/horizon-control-plane` on `feat/horizon-control`. Keep `/root/horizon-fit` on **`main`** (shop only).
3. `cd /opt/horizon-control-plane/horizon-control && npm ci`
4. `install -d -m 0755 /var/lib/horizon-control`
5. `install -m 0600 ops/systemd/horizon-control.env.example /etc/horizon-control.env` from the repo root, then edit issuer/audience/JWKS and set `HORIZON_BIND` to `127.0.0.1` (SSH tunnel) or the Tailscale IP.
6. `install -m 0644 ops/systemd/horizon-control.service /etc/systemd/system/horizon-control.service`
7. `systemctl daemon-reload && systemctl enable --now horizon-control`
8. `journalctl -u horizon-control -f`
9. From the VPS: `curl -fsS http://127.0.0.1:8787/healthz`
10. From a tailnet PC: `curl -fsS http://<tailscale-ip>:8787/healthz`

Do **not** add a public nginx `server_name` for control. Do **not** open 8787 on the VPS public firewall.

## Live smoke (from a tailnet PC, after Auth0)

Use an **Admin** JWT (all read-only MVP scopes). Tokens never go in git.

```bash
export HORIZON_CONTROL_URL=http://<tailscale-ip>:8787
export HORIZON_E2E_TOKEN='<jwt from Auth0>'
export HORIZON_E2E=1
cd horizon-control
npm run test:e2e
```

Or call MCP by hand (Streamable HTTP). `Accept` must include both `application/json` and `text/event-stream`:

```bash
# catalog_get_product 001-TOP-AZU
curl -sS "$HORIZON_CONTROL_URL/mcp" \
  -H "Authorization: Bearer $HORIZON_E2E_TOKEN" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"catalog_get_product","arguments":{"id":"001-TOP-AZU"}}}'

# repo_status
curl -sS "$HORIZON_CONTROL_URL/mcp" \
  -H "Authorization: Bearer $HORIZON_E2E_TOKEN" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"repo_status","arguments":{}}}'

# ops_health
curl -sS "$HORIZON_CONTROL_URL/mcp" \
  -H "Authorization: Bearer $HORIZON_E2E_TOKEN" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ops_health","arguments":{}}}'

# merchant_get_diagnostics
curl -sS "$HORIZON_CONTROL_URL/mcp" \
  -H "Authorization: Bearer $HORIZON_E2E_TOKEN" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"merchant_get_diagnostics","arguments":{}}}'

# seo_audit (returns a job; Claude/Admin only)
curl -sS "$HORIZON_CONTROL_URL/mcp" \
  -H "Authorization: Bearer $HORIZON_E2E_TOKEN" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"seo_audit","arguments":{}}}'

# jobs_get — paste the job id from seo_audit
curl -sS "$HORIZON_CONTROL_URL/mcp" \
  -H "Authorization: Bearer $HORIZON_E2E_TOKEN" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"jobs_get","arguments":{"id":"JOB_ID"}}}'

# audit_history
curl -sS "$HORIZON_CONTROL_URL/mcp" \
  -H "Authorization: Bearer $HORIZON_E2E_TOKEN" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"audit_history","arguments":{"limit":20}}}'
```

CLI equivalent (HTTP `/v1`, still JWT): `HORIZON_CONTROL_TOKEN=$HORIZON_E2E_TOKEN npm run cli -- catalog get 001-TOP-AZU`

## Limits (Phase 2)

Public Store API has no drafts. Variations may require a second fetch. Hero/marquee may be `unavailable`. Merchant may need `HORIZON_MERCHANT_DIAGNOSTICS_PATH`. Repo ahead/behind is stale unless `HORIZON_GIT_FETCH=1`.

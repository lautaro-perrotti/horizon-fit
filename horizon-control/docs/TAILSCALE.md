# Tailscale — Horizon Control MVP

Horizon Control is reachable **only on the tailnet**. There is no public hostname, no new public TCP port, and no cloud/SaaS ingress design.

```
Dev PC (Cursor / Claude / Codex / CLI)
        |  Tailscale (WireGuard)
        v
VPS horizon-control  HORIZON_BIND=127.0.0.1 or <VPS Tailscale IP>:8787
        /healthz  /v1  /mcp
```

Public nginx stays as today: `horizonfit.com.ar` and `api.horizonfit.com.ar` only. `/mcp` and `/v1` are **not** on those configs.

## 1. VPS

1. Install Tailscale (`curl -fsSL https://tailscale.com/install.sh | sh`).
2. `sudo tailscale up` and authenticate this node into the **same tailnet** as operator PCs.
3. `tailscale ip -4` → e.g. `100.x.y.z`.
4. Do **not** open 8787 on ufw/iptables for the public NIC. Tailscale traffic uses the tailscale0 interface.
5. Bind CP:
   - `HORIZON_BIND=127.0.0.1` if you only SSH-tunnel (`ssh -L 8787:127.0.0.1:8787 root@vps`)
   - or `HORIZON_BIND=100.x.y.z` so PCs on the tailnet connect directly
6. Optional MagicDNS name: `http://<vps-hostname>.<tailnet>.ts.net:8787` — still not public DNS.

The Node process **refuses** `0.0.0.0`, `::`, and non-Tailscale WAN addresses.

## 2. Dev PC

1. Install Tailscale and log into the **same tailnet**.
2. Confirm `tailscale ping <vps>` / `curl http://100.x.y.z:8787/healthz`.
3. Point Cursor MCP `url` at `http://100.x.y.z:8787/mcp` (see `docs/MCP-CLIENTS.md`).
4. Do not put that URL on the public internet or in a Cloudflare tunnel for this MVP.

## 3. What this is not

- Not Auth0-hosted agents that cannot join Tailscale (would need a public Resource Server + identity-aware proxy). Out of scope.
- Not exposing CP through shop docker-compose or public nginx.
- Not a substitute for VPS SSH. Operators still use Tailscale or existing SSH; CP never grows `ssh` / `shell` tools.

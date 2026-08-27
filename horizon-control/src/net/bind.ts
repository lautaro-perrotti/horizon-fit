/**
 * Horizon Control may bind only to loopback or a Tailscale address.
 * Public 0.0.0.0 / :: / WAN IPs are refused so /mcp and /v1 never listen on the open internet.
 */

const TAILSCALE_V6_PREFIX = "fd7a:115c:a1e0:";

export class BindError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BindError";
  }
}

function stripBrackets(value: string): string {
  return value.replace(/^\[/, "").replace(/\]$/, "");
}

export function isLoopbackBind(bind: string): boolean {
  const host = stripBrackets(bind.trim().toLowerCase());
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

/** Tailscale userspace/CGNAT: 100.64.0.0/10 */
export function isTailscaleIpv4(bind: string): boolean {
  const host = bind.trim();
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
}

/** Tailscale IPv6 unique-local prefix fd7a:115c:a1e0::/48 */
export function isTailscaleIpv6(bind: string): boolean {
  const host = stripBrackets(bind.trim().toLowerCase());
  return host.startsWith(TAILSCALE_V6_PREFIX);
}

export function isAllowedBind(bind: string): boolean {
  const host = bind.trim();
  if (!host) return false;
  return isLoopbackBind(host) || isTailscaleIpv4(host) || isTailscaleIpv6(host);
}

export function assertAllowedBind(bind: string): void {
  if (isAllowedBind(bind)) return;
  throw new BindError(
    `HORIZON_BIND must be loopback (127.0.0.1 / ::1) or a Tailscale address (100.64.0.0/10 or fd7a:115c:a1e0::/48); refused: ${bind}`,
  );
}

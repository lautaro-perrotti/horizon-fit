import { ALL_SCOPES } from "../config.js";
import type { Config } from "../config.js";

export function protectedResourceMetadata(config: Config) {
  return {
    // RFC 9728 / RFC 8707 resource = the MCP URL (Cursor requires this exact string or its origin).
    resource: config.resourceUrl,
    authorization_servers: [config.HORIZON_OIDC_ISSUER.replace(/\/$/, "")],
    bearer_methods_supported: ["header"],
    scopes_supported: ALL_SCOPES,
    resource_documentation: `${config.publicUrl}/docs`,
    resource_name: "Horizon Fit Control Plane",
  };
}

export function wwwAuthenticate(config: Config, error?: string, scope?: string): string {
  const metadata = `${config.publicUrl.replace(/\/$/, "")}/.well-known/oauth-protected-resource`;
  const parts = [
    `Bearer realm="horizon-control"`,
    `resource_metadata="${metadata}"`,
  ];
  if (error) parts.push(`error="${error}"`);
  if (scope) parts.push(`scope="${scope}"`);
  return parts.join(", ");
}

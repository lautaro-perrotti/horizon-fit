import {
  createLocalJWKSet,
  createRemoteJWKSet,
  type JWTPayload,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import type { Config } from "../config.js";
import type { AuthPrincipal } from "../types.js";
import { normalizeScopes } from "./scopes.js";

export class AuthError extends Error {
  readonly status = 401;
  readonly code = "invalid_token";
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export type ResourceServerOptions = {
  config: Config;
  jwks?: { keys: Record<string, unknown>[] };
  clockToleranceSec?: number;
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value) return [value];
  return [];
}

function audienceMatches(tokenAud: string[], expected: string): boolean {
  const normalize = (value: string) => value.replace(/\/$/, "");
  const want = normalize(expected);
  return tokenAud.some((aud) => {
    const got = normalize(aud);
    return got === want || got === `${want}/mcp` || `${got}/mcp` === want;
  });
}

export function createResourceServer(options: ResourceServerOptions) {
  const { config } = options;
  if (options.jwks && process.env.NODE_ENV !== "test") {
    throw new Error("test JWKS is only allowed when NODE_ENV=test");
  }
  const getKey: JWTVerifyGetKey = options.jwks
    ? createLocalJWKSet(options.jwks as Parameters<typeof createLocalJWKSet>[0])
    : createRemoteJWKSet(new URL(config.jwksUrl));

  async function verifyAccessToken(token: string): Promise<AuthPrincipal> {
    if (!token || typeof token !== "string") {
      throw new AuthError("missing_token");
    }
    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(token, getKey, {
        issuer: config.HORIZON_OIDC_ISSUER,
        clockTolerance: options.clockToleranceSec ?? 60,
        algorithms: ["RS256"],
      });
      payload = verified.payload;
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const message = error instanceof Error ? error.message : String(error);
      if (name === "JWTExpired" || /exp/i.test(message)) {
        throw new AuthError("token_expired");
      }
      throw new AuthError(`invalid_token: ${message}`);
    }

    const audiences = asStringArray(payload.aud);
    if (!audienceMatches(audiences, config.HORIZON_OIDC_AUDIENCE) && !audienceMatches(audiences, config.resourceUrl)) {
      throw new AuthError("invalid_audience");
    }
    if (!payload.exp) {
      throw new AuthError("missing_exp");
    }

    const clientId = String(payload.azp ?? payload.client_id ?? payload.sub ?? "unknown");
    const scopes = [
      ...normalizeScopes(payload.scope),
      ...normalizeScopes(payload.permissions),
      ...normalizeScopes(payload.scp),
    ];

    return {
      token,
      clientId,
      subject: String(payload.sub ?? clientId),
      scopes: [...new Set(scopes)],
      expiresAt: payload.exp,
      issuer: String(payload.iss ?? ""),
      audience: audiences,
    };
  }

  return { verifyAccessToken };
}

export type ResourceServer = ReturnType<typeof createResourceServer>;

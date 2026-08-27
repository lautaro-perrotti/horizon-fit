import { PRODUCTION_HOSTS, SEO_AUDIT_ALLOWLIST } from "../config.js";
import { looksLikePathTraversal, PathTraversalError } from "./paths.js";
import { SsrfError } from "./allowlist.js";

const URL_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const ALLOWED_URL_HOSTS = new Set(
  [...PRODUCTION_HOSTS, ...SEO_AUDIT_ALLOWLIST.map((origin) => new URL(origin).hostname.toLowerCase())],
);

export class UnsafeArgsError extends Error {
  readonly status = 400;
  readonly code = "unsafe_args";
  constructor(
    message: string,
    readonly causeName: "ssrf" | "path_traversal" = "ssrf",
  ) {
    super(message);
    this.name = "UnsafeArgsError";
  }
}

function hostAllowed(hostname: string): boolean {
  return ALLOWED_URL_HOSTS.has(hostname.toLowerCase());
}

function assertSafeString(value: string, key: string): void {
  if (value.includes("\0")) {
    throw new UnsafeArgsError(`path_traversal:${key}`, "path_traversal");
  }
  if (looksLikePathTraversal(value)) {
    throw new UnsafeArgsError(`path_traversal:${key}`, "path_traversal");
  }
  if (!URL_SCHEME.test(value)) return;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new UnsafeArgsError(`ssrf:${key}`, "ssrf");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeArgsError(`ssrf:${key}`, "ssrf");
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeArgsError(`ssrf:${key}`, "ssrf");
  }
  if (!hostAllowed(parsed.hostname)) {
    throw new UnsafeArgsError(`ssrf:${key}`, "ssrf");
  }
}

function walk(value: unknown, key: string): void {
  if (typeof value === "string") {
    assertSafeString(value, key);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${key}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      walk(child, childKey);
    }
  }
}

export function assertSafeToolArgs(args: unknown): void {
  try {
    walk(args, "args");
  } catch (error) {
    if (error instanceof PathTraversalError) {
      throw new UnsafeArgsError(error.message, "path_traversal");
    }
    if (error instanceof SsrfError) {
      throw new UnsafeArgsError(error.message, "ssrf");
    }
    throw error;
  }
}

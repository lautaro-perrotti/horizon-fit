import { PRODUCTION_HOSTS } from "../config.js";

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

function hostOf(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extraAllowedHosts(urls: Array<string | undefined>): string[] {
  return urls
    .map((url) => (url ? hostOf(url) : null))
    .filter((host): host is string => Boolean(host));
}

export function isAllowedUrl(url: string, extraHosts: string[] = []): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  const allowed = new Set<string>([...PRODUCTION_HOSTS, ...extraHosts]);
  return allowed.has(host);
}

export function assertAllowedUrl(url: string, extraHosts: string[] = []): URL {
  if (!isAllowedUrl(url, extraHosts)) {
    throw new SsrfError(`url_not_allowlisted:${url}`);
  }
  return new URL(url);
}

export async function allowlistedFetch(
  url: string,
  extraHosts: string[],
  init: RequestInit & { timeoutMs?: number } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  assertAllowedUrl(url, extraHosts);
  const { timeoutMs = 8000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...rest,
      method: rest.method ?? "GET",
      redirect: rest.redirect ?? "manual",
      signal: rest.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

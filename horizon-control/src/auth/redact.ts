const SECRET_KEY =
  /password|passwd|token|authorization|secret|api[_-]?key|app_password|credential|cookie|bearer|^(HORIZON_|WOO_|AUTH0_|OIDC_)/i;

export function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? "[REDACTED]" : redactValue(nested);
    }
    return out;
  }
  return value;
}

export function redactArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return { value: redactValue(args) };
  }
  return redactValue(args) as Record<string, unknown>;
}

const CATALOG_FILTER_KEYS = ["query", "sku", "category", "color", "size", "talle", "stock_status", "page", "limit", "id"] as const;

export function sanitizeToolArgs(tool: string, args: unknown): Record<string, unknown> {
  const redacted = redactArgs(args);
  if (tool.startsWith("catalog.")) {
    const out: Record<string, unknown> = {};
    for (const key of CATALOG_FILTER_KEYS) {
      if (redacted[key] !== undefined) out[key] = redacted[key];
    }
    return out;
  }
  if (tool === "seo.audit") {
    return { target: "https://horizonfit.com.ar" };
  }
  return redacted;
}

export function sanitizeError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
    .replace(/Cookie:\s*[^\n]+/gi, "Cookie: [REDACTED]")
    .replace(/(password|token|secret|authorization|cookie)=([^\s&]+)/gi, "$1=[REDACTED]")
    .replace(/\b(HORIZON_[A-Z0-9_]+|WOO_[A-Z0-9_]+)=([^\s&]+)/g, "$1=[REDACTED]");
}

const SECRET_KEY = /password|passwd|token|authorization|secret|api[_-]?key|app_password|credential/i;

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

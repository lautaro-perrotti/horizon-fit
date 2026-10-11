export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function requestIdFrom(header?: string | null): string {
  const incoming = header?.trim();
  if (incoming && /^[a-zA-Z0-9-]{8,80}$/.test(incoming)) return incoming;
  return `hc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function logJson(level: "info" | "warn" | "error", message: string, fields: LogFields = {}): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

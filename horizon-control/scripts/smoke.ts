const base = (process.env.HORIZON_CONTROL_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const token = process.env.HORIZON_E2E_TOKEN ?? process.env.HORIZON_CONTROL_TOKEN ?? "";

async function get(path: string, auth = false) {
  const headers: Record<string, string> = { accept: "application/json", "x-request-id": `smoke-${Date.now()}` };
  if (auth) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, { headers });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

const health = await get("/healthz");
if (health.status !== 200 || health.body.ok !== true) {
  console.log(JSON.stringify({ ok: false, step: "healthz", health }));
  process.exit(1);
}

if (!token) {
  console.log(JSON.stringify({ ok: true, step: "healthz_only", reason: "missing_token", health: health.body }));
  process.exit(0);
}

const product = await get("/v1/insights/products/004-TOP-BOR", true);
const overview = await get("/v1/insights/overview", true);
const chat = await fetch(`${base}/v1/ai/chat`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({ message: "precio del SKU 004-TOP-BOR" }),
});
const chatBody = await chat.json().catch(() => ({}));

const report = {
  ok: product.status === 200 && overview.status === 200 && chat.status === 200,
  healthz: health.body,
  product360: { status: product.status, found: product.body.found ?? null, sales: product.body.sales?.status ?? null },
  overview: { status: overview.status, revenue: overview.body.revenue?.status ?? null },
  chat: { status: chat.status, configured: chatBody.configured ?? null },
};
console.log(JSON.stringify(report));
if (!report.ok) process.exit(1);

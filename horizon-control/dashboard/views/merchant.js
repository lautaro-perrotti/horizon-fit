// Merchant: diagnostics of the Google Merchant feed that Fit generates. Control reads it, never regenerates it.
import { html, mount } from "../core/html.js";
import { api, attempt } from "../core/api.js";
import { num } from "../core/format.js";
import { bar, chip, empty, errorState, loading, notConfigured, pip } from "../ui/components.js";
import { toast } from "../core/kit.js";

export const crumb = () => "Merchant";

function feedItems(productsJson) {
  let value = productsJson;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  const list = Array.isArray(value) ? value : Array.isArray(value?.products) ? value.products : Array.isArray(value?.items) ? value.items : [];
  return list.map((row) => String(row?.sku ?? row?.offerId ?? row?.offer_id ?? row?.id ?? "")).filter(Boolean);
}

export async function render(ctx) {
  mount(
    ctx.root,
    html`
      <section class="view-head">
        <div><h1 class="disp">Merchant</h1><p>Diagnóstico del feed de Google Merchant que genera Fit. Control lo lee; no lo regenera.</p></div>
        <div class="side">
          ${ctx.can("merchant.audit") ? html`<button type="button" class="btn" data-act="audit">Re-leer diagnóstico</button>` : html`<button type="button" class="btn" disabled>Re-leer diagnóstico</button><span class="chip" data-s="scope">falta scope merchant.audit</span>`}
        </div>
      </section>
      <div data-slot="body">${loading(6)}</div>`,
  );
  ctx.on("click", '[data-act="audit"]', async (_, target) => {
    target.disabled = true;
    try {
      await api("/v1/merchant/audit", { method: "POST", body: {}, invalidate: "/v1/merchant" });
      toast("Diagnóstico re-leído.");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (error) {
      toast(`No se pudo re-leer: ${error.message}`);
      target.disabled = false;
    }
  });

  const res = await attempt("/v1/merchant/diagnostics");
  if (!ctx.alive()) return;
  if (!res.ok) return mount(ctx.slot("body"), errorState(res.error, "el diagnóstico de Merchant"));
  const d = res.data;
  if (d.source === "unavailable") return mount(ctx.slot("body"), notConfigured(d.error || "diagnostics_unavailable", "Diagnóstico de Merchant no disponible"));
  const ready = Number(d.summary?.ready ?? 0);
  const blocked = Number(d.summary?.blocked ?? 0);
  const total = ready + blocked;
  const problems = d.summary?.problems ?? [];
  const skus = feedItems(d.productsJson);
  const byLine = new Map();
  for (const sku of skus) {
    const prefix = /^\d{3}/.exec(sku)?.[0];
    if (prefix) byLine.set(prefix, (byLine.get(prefix) ?? 0) + 1);
  }
  const lines = [...byLine.entries()].sort((a, b) => b[1] - a[1]);
  const maxLine = Math.max(1, ...lines.map(([, n]) => n));
  mount(
    ctx.slot("body"),
    html`<section class="grid-auto" style="--min: 300px;">
        <article class="panel pad stack" style="gap: 14px;">
          <div class="row spread"><span class="lbl">Variantes en el feed</span>${blocked ? chip("error", `${num(blocked)} bloqueadas`) : chip("zero", "0 bloqueadas")}</div>
          <div class="row" style="align-items: flex-end; gap: 26px;">
            <div class="metric"><span class="disp" style="font-size: 72px; color: var(--ok);">${num(ready)}</span><span class="small muted">listas</span></div>
            <div class="metric"><span class="disp" style="font-size: 44px; color: ${blocked ? "var(--bad)" : "var(--ink-3)"};">${num(blocked)}</span><span class="small muted">bloqueadas</span></div>
          </div>
          ${total ? bar(ready / total, "var(--ok)") : ""}
          <span class="xs muted">Fuente ${d.source === "endpoint" ? "endpoint permitido" : "archivo local"}${d.path ? html` · <span class="mono">${d.path}</span>` : ""}</span>
        </article>
        <article class="panel pad stack" style="gap: 0;">
          <span class="lbl" style="padding-bottom: 10px;">Por línea (prefijo de SKU)</span>
          ${lines.length
            ? lines.map(([prefix, n]) => html`<div style="display: grid; grid-template-columns: 60px minmax(0, 1fr) 44px; gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--hair); font-size: 12.5px;"><span class="mono">${prefix}</span>${bar(n / maxLine, "var(--ok)")}<span class="n strong">${num(n)}</span></div>`)
            : html`<p class="small muted">El archivo de productos no trae SKUs legibles para agrupar.</p>`}
        </article>
        <article class="panel pad stack" style="gap: 10px;">
          <span class="lbl">Problemas</span>
          ${problems.length
            ? problems.map(
                (row) => html`<div class="stack" style="gap: 4px; padding: 10px 0; border-top: 1px solid var(--hair);">
                  <span class="row">${pip(row.ready === false ? "critical" : "warning")}<span class="mono small">${row.sku}</span><span class="ellipsis soft">${row.title ?? ""}</span></span>
                  ${(row.issues ?? []).map((issue) => html`<span class="xs muted" style="padding-left: 18px;"><span class="mono">${issue.code ?? issue.severity ?? ""}</span> ${issue.message ?? ""}</span>`)}
                </div>`,
              )
            : empty({ status: "zero", title: "Ninguna variante bloqueada", body: "Si aparece una, se lista acá con su SKU, el código y el mensaje de Google. Si el producto vende o tiene tráfico, salta MERCHANT_BLOCKED_HIGH_VALUE." })}
        </article>
      </section>
      <article class="panel pad stack" style="gap: 10px;">
        <div class="row wrap"><span class="lbl">Diagnóstico crudo</span><span class="mono xs muted">merchant-diagnostics.txt</span><span class="xs muted push">primeros 2.000 caracteres</span></div>
        <pre class="raw">${String(d.diagnosticsTxt || "Sin diagnostics.txt").slice(0, 2000)}</pre>
      </article>`,
  );
}

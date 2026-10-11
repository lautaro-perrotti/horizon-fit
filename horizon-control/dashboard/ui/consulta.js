// Consulta: docked panel. Tries /v1/ai/chat with the current SKU and window as context; without
// model keys it falls back to the deterministic /v1/assistant/ask and shows its evidence as chips.
import { html, mount } from "../core/html.js";
import { api } from "../core/api.js";
import { ago, money, num, pct, toNumber } from "../core/format.js";
import { chip, spark } from "./components.js";
import { statusOf } from "../core/slice.js";

const HINTS = [
  "¿Cuál es el precio del SKU 001-TOP-AZU?",
  "¿Cómo está el SEO?",
  "¿Cómo está el tráfico?",
  "¿Cómo está la competencia?",
  "Gráfico de sesiones",
  "¿Hay alertas abiertas?",
];

const state = { node: null, log: [], sessionId: "", mode: null, busy: false, deps: null };

function evidenceOf(payload, acc = [], depth = 0) {
  if (!payload || typeof payload !== "object" || depth > 3) return acc;
  const source = typeof payload.source === "string" ? payload.source : null;
  const hasState = "status" in payload || "configured" in payload || "available" in payload || "ok" in payload;
  if (source || hasState) {
    const status = statusOf(payload);
    if (source || status !== "ok") acc.push({ source: source ?? "control", status, fetched_at: payload.fetched_at ?? null });
  }
  for (const value of Object.values(payload)) if (value && typeof value === "object" && !Array.isArray(value)) evidenceOf(value, acc, depth + 1);
  return acc;
}

function replyText(data) {
  const d = data.data ?? {};
  switch (data.intent) {
    case "product":
      if (!d.name) return "No encontré ese producto en el catálogo.";
      return `${d.name} · ${money(d.price?.amount)} · ${d.stock_status === "outofstock" ? "sin stock" : "con stock"}`;
    case "health":
      return `Storefront ${d.storefront?.status ?? "—"} · API ${d.api?.status ?? "—"} · Control ${d.status ?? "—"}`;
    case "sales":
      if (d.configured === false) return "Woo REST no está configurado: no hay pedidos para leer.";
      if (d.product) return `${d.parent_sku} · ${num(d.product.d30?.units ?? 0)} u. en 30 d · ${money(d.product.d30?.revenue, { orders: d.product.d30?.orders })}`;
      if (d.parent_sku) return `${d.parent_sku} · sin ventas en la ventana.`;
      return `Hoy ${num(d.today?.orders ?? 0)} pedidos · ${money(d.today?.revenue, { orders: d.today?.orders })}`;
    case "alerts": {
      const open = (d.alerts ?? []).filter((row) => row.status === "open");
      return open.length ? `${open.length} abiertas: ${open.map((row) => row.title).slice(0, 3).join(" · ")}` : "Sin alertas abiertas.";
    }
    case "seo":
      if (d.configured === false) return "Todavía no hay auditoría SEO.";
      return `${num(d.summary?.totals?.critical ?? 0)} críticos y ${num(d.summary?.totals?.warning ?? 0)} warnings en ${num(d.summary?.auditedCount ?? 0)} URLs.`;
    case "ga4":
      if (d.configured === false) return "GA4 no está conectado.";
      return `${num(d.sessions)} sesiones y ${num(d.users)} usuarios en 28 d · ${num(d.purchases)} compras.`;
    case "gsc":
      if (d.configured === false) return "Search Console no está conectado.";
      return `${num(d.clicks)} clics y ${num(d.impressions)} impresiones en 28 d · CTR ${pct(d.ctr)}.`;
    case "competitors": {
      if (d.configured === false) return "No hay URLs de competencia configuradas.";
      const pages = d.pages ?? [];
      const down = pages.filter((row) => !row.ok);
      return `${pages.length} sitios observados${down.length ? ` · ${down.map((row) => `${row.host} ${row.status ?? "error"}`).join(", ")}` : " · todos responden"}.`;
    }
    case "chart":
      if (!d.chart) return `No hay gráfico para esa pregunta. KPIs disponibles: ${(d.available ?? []).map((row) => row.title || row.kpi).join(", ") || "ninguno"}.`;
      return d.chart.title;
    default:
      return "No tengo una respuesta determinística para eso. Probá con un SKU, SEO, tráfico, competencia o alertas.";
  }
}

function render() {
  const { node, log, mode, deps } = state;
  if (!node) return;
  const ctx = deps?.getContext?.() ?? {};
  mount(
    node,
    html`
      <div class="consulta-head">
        <div class="row">
          <h2 style="font-size: 16px; font-weight: 700;">Consulta</h2>
          ${mode === "model" ? chip("ok", "modelo") : mode === "deterministic" ? chip("not_configured", "IA sin keys") : chip("unknown", "modo a confirmar")}
          <button type="button" class="btn btn-ghost btn-sm push" data-act="consulta-close" aria-label="Cerrar Consulta">✕</button>
        </div>
        <p class="small muted">${mode === "model"
          ? "Responde un modelo con las herramientas de Control; cada respuesta trae su evidencia y su costo."
          : "Modo determinístico: responde con las mismas herramientas que la UI y no inventa."}</p>
        ${ctx.sku || ctx.w
          ? html`<span class="well xs soft" style="align-self: flex-start; padding: 4px 8px;">Contexto ${ctx.sku ? html`<span class="mono">${ctx.sku}</span> · ` : ""}${ctx.w ?? ""}</span>`
          : ""}
      </div>
      <div class="consulta-log" data-slot="log" aria-live="polite">
        ${log.length ? "" : html`<p class="small muted">Preguntá por un SKU, SEO, tráfico, competencia o alertas.</p>`}
        ${log.map((entry) =>
          entry.role === "q"
            ? html`<div class="bubble q">${entry.text}</div>`
            : html`<div class="answer">
                <div class="bubble a">${entry.text}${entry.series ? spark(entry.series) : ""}</div>
                ${entry.evidence?.length
                  ? html`<div class="row wrap" style="gap: 6px;">${entry.evidence.map((ev) =>
                      chip(ev.status, `${ev.source}${ev.fetched_at ? ` · ${ago(ev.fetched_at)}` : ""}`),
                    )}</div>`
                  : ""}
                ${entry.meta ? html`<span class="xs muted">${entry.meta}</span>` : ""}
              </div>`,
        )}
        ${state.busy ? html`<div class="answer"><div class="bubble a">${chip("loading")}</div></div>` : ""}
      </div>
      <div class="hints">${HINTS.map((hint) => html`<button type="button" class="btn btn-sm" data-act="consulta-hint" data-q="${hint}">${hint.replace(/^¿|\?$/g, "")}</button>`)}</div>
      <form class="consulta-form" data-act="consulta-form">
        <label class="sr" for="consulta-input">Pregunta</label>
        <textarea id="consulta-input" class="field" rows="2" maxlength="500" placeholder="Preguntá por un SKU, SEO, tráfico, alertas…"></textarea>
        <div class="row spread">
          <span class="xs muted">Enter pregunta · Shift+Enter nueva línea</span>
          <button type="submit" class="btn btn-act btn-sm" ${state.busy ? "disabled" : ""}>Preguntar</button>
        </div>
      </form>`,
  );
  const logNode = node.querySelector('[data-slot="log"]');
  if (logNode) logNode.scrollTop = logNode.scrollHeight;
}

export async function ask(question) {
  const text = String(question ?? "").trim();
  if (!text || state.busy) return;
  const { can, getContext } = state.deps;
  const ctx = getContext?.() ?? {};
  state.log.push({ role: "q", text });
  state.busy = true;
  render();
  try {
    let answered = false;
    if (can("ai.chat")) {
      const turn = await api("/v1/ai/chat", {
        method: "POST",
        invalidate: "/v1/ai/",
        body: { message: text, session_id: state.sessionId || undefined, parent_sku: ctx.sku || undefined, range: ctx.w || undefined },
      });
      if (turn.session_id) state.sessionId = turn.session_id;
      if (turn.configured !== false && turn.text) {
        state.mode = "model";
        const cost = toNumber(turn.usage?.cost_usd);
        state.log.push({
          role: "a",
          text: turn.text,
          evidence: (turn.evidence ?? []).filter((ev) => ev.source || ev.status).slice(0, 6).map((ev) => ({ source: ev.source ?? "tool", status: ev.status ?? "ok", fetched_at: ev.fetched_at })),
          meta: [turn.model, cost != null ? `USD ${num(cost, 4)}` : null, turn.trace_id ? `trace ${turn.trace_id.slice(0, 8)}` : null].filter(Boolean).join(" · "),
        });
        answered = true;
      }
    }
    if (!answered) {
      state.mode = "deterministic";
      const data = await api("/v1/assistant/ask", { method: "POST", invalidate: "/v1/ai/", body: { question: text } });
      state.log.push({
        role: "a",
        text: replyText(data),
        evidence: evidenceOf(data.data).slice(0, 4),
        series: data.intent === "chart" && data.data?.series ? data.data.series.map((row) => row.value) : null,
        meta: `intent: ${data.intent} · sin modelo · sin costo`,
      });
    }
  } catch (error) {
    state.log.push({ role: "a", text: error?.status === 403 ? "Tu sesión no tiene permiso para Consulta (falta scope)." : `No pude responder: ${error.message}` });
  } finally {
    state.busy = false;
    render();
  }
}

export function initConsulta(node, deps) {
  state.node = node;
  state.deps = deps;
  node.addEventListener("click", (event) => {
    const target = event.target.closest("[data-act]");
    if (!target) return;
    if (target.dataset.act === "consulta-hint") void ask(target.dataset.q);
    if (target.dataset.act === "consulta-close") deps.close();
  });
  node.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = node.querySelector("#consulta-input");
    const value = input?.value ?? "";
    if (input) input.value = "";
    void ask(value);
  });
  node.addEventListener("keydown", (event) => {
    if (event.target.id === "consulta-input" && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      node.querySelector("form")?.requestSubmit();
    }
  });
  render();
}

export function refreshConsulta() {
  render();
}

export function focusConsulta(prefill) {
  const input = state.node?.querySelector("#consulta-input");
  if (!input) return;
  if (prefill) input.value = prefill;
  input.focus();
}

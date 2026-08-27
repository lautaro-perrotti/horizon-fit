import type { CatalogAdapter } from "./woo.js";
import type { CommerceAdapter } from "./commerce.js";
import type { HealthAdapter } from "./health.js";
import type { Warehouse } from "./warehouse.js";

export type AssistantAnswer = {
  mode: "deterministic";
  intent: string;
  question: string;
  data: unknown;
  note: string;
};

export type AssistantAdapter = {
  ask: (question: string) => Promise<AssistantAnswer>;
};

function intentOf(question: string): "health" | "product" | "sales" | "settings" | "alerts" {
  const q = question.toLowerCase();
  if (/\b(sku|precio|product|prenda|top|calza|stock)\b/.test(q) || /\d{3}-[a-z]{3}-[a-z]{3}/i.test(q)) {
    return "product";
  }
  if (/\b(venta|pedido|revenue|ticket|orden)\b/.test(q)) return "sales";
  if (/\b(config|woocommerce|woo|moneda|pasarela|pago|env[ií]o|cuota)\b/.test(q)) return "settings";
  if (/\b(alerta|alert|ca[ií]da|down|error)\b/.test(q)) return "alerts";
  if (/\b(salud|health|sitio|storefront|api)\b/.test(q)) return "health";
  return "alerts";
}

const SKU = /\d{3}-[A-Z]{3}-[A-Z]{3}(?:-(S|M|L|XL|XXL))?/i;

export function createAssistantAdapter(options: {
  health: HealthAdapter;
  catalog: CatalogAdapter;
  commerce: CommerceAdapter;
  warehouse: Warehouse;
}): AssistantAdapter {
  return {
    async ask(question) {
      const trimmed = question.trim().slice(0, 500);
      const intent = intentOf(trimmed);
      const note = "Respuesta determinística sobre tools /v1. Sin LLM y sin catálogo completo.";
      if (intent === "health") {
        return { mode: "deterministic", intent, question: trimmed, data: await options.health.report(), note };
      }
      if (intent === "product") {
        const sku = trimmed.match(SKU)?.[0];
        if (sku) {
          const product = await options.catalog.getProduct(sku);
          return { mode: "deterministic", intent, question: trimmed, data: product ?? { found: false, sku }, note };
        }
        const search = await options.catalog.searchProducts({ query: trimmed, limit: 10, page: 1 });
        return {
          mode: "deterministic",
          intent,
          question: trimmed,
          data: {
            products: search.products.map((product) => ({
              sku: product.sku || product.parent_sku,
              name: product.name,
              price: product.price,
              stock_status: product.stock_status,
            })),
            limit: 10,
          },
          note,
        };
      }
      if (intent === "sales") {
        return { mode: "deterministic", intent, question: trimmed, data: await options.commerce.sales(), note };
      }
      if (intent === "settings") {
        return { mode: "deterministic", intent, question: trimmed, data: await options.commerce.settings(), note };
      }
      return {
        mode: "deterministic",
        intent: "alerts",
        question: trimmed,
        data: { alerts: options.warehouse.listAlerts("open").slice(0, 10) },
        note,
      };
    },
  };
}

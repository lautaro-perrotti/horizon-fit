import type { CatalogAdapter } from "./woo.js";
import { parentSkuFromVariant, type CommerceAdapter } from "./commerce.js";
import type { HealthAdapter } from "./health.js";
import type { Warehouse } from "./warehouse.js";
import type { SeoReportAdapter } from "./seo-report.js";
import type { AnalyticsAdapter } from "./analytics.js";
import type { CompetitorsAdapter } from "./competitors.js";

export const CHART_KPIS = {
  seo_warning: { title: "Warnings SEO", period: "audit" },
  seo_critical: { title: "Críticos SEO", period: "audit" },
  seo_pages: { title: "Páginas auditadas", period: "audit" },
  revenue: { title: "Revenue", period: "today" },
  orders: { title: "Pedidos", period: "today" },
  storefront_ok: { title: "Storefront", period: "now" },
  gsc_clicks: { title: "Clicks Search Console", period: "28d" },
  gsc_impressions: { title: "Impresiones Search Console", period: "28d" },
  ga4_sessions: { title: "Sesiones GA4", period: "28d" },
  ga4_users: { title: "Usuarios GA4", period: "28d" },
} as const;

export type ChartKpi = keyof typeof CHART_KPIS;

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

type Intent = "health" | "product" | "sales" | "settings" | "seo" | "ga4" | "gsc" | "competitors" | "chart" | "alerts";

function intentOf(question: string): Intent {
  const q = question.toLowerCase();
  if (/\b(gr[aá]fico|grafico|chart|sparkline|visualiz)/i.test(q)) return "chart";
  const hasSku = /\d{3}-[a-z]{3}-[a-z]{3}/i.test(q);
  if (hasSku && /\b(venta|vendi|unidad|revenue|factur|aov|pedido)\b/.test(q) && !/\bprecio\b/.test(q)) {
    return "sales";
  }
  if (/\b(sku|precio|product|prenda|top|calza|stock)\b/.test(q) || hasSku) {
    return "product";
  }
  if (/\b(venta|pedido|revenue|ticket|orden)\b/.test(q)) return "sales";
  if (/\b(config|woocommerce|woo|moneda|pasarela|pago|env[ií]o|cuota)\b/.test(q)) return "settings";
  if (/\b(competencia|competidor|competidores|rival)/.test(q)) return "competitors";
  if (/\b(gsc|search console|impresion|ctr)\b/.test(q)) return "gsc";
  if (/\b(ga4|analytics|tr[aá]fico|sesion|sesiones|usuarios)\b/.test(q)) return "ga4";
  if (/\b(seo|t[ií]tulo|meta description|auditor)/i.test(q)) return "seo";
  if (/\b(alerta|alert|ca[ií]da|down|error)\b/.test(q)) return "alerts";
  if (/\b(salud|health|sitio|storefront|api)\b/.test(q)) return "health";
  return "alerts";
}

function pickChartKpi(question: string): ChartKpi | null {
  const q = question.toLowerCase();
  if (/cr[ií]tic/.test(q)) return "seo_critical";
  if (/warning|warn|aviso/.test(q) && /seo/.test(q)) return "seo_warning";
  if (/p[aá]gina|urls? audit/.test(q)) return "seo_pages";
  if (/impresion/.test(q)) return "gsc_impressions";
  if (/click/.test(q) && /gsc|search|console|google/.test(q)) return "gsc_clicks";
  if (/sesion/.test(q) || /ga4/.test(q) && /sesion|tr[aá]fico/.test(q)) return "ga4_sessions";
  if (/usuario/.test(q) && /ga4|analytics|tr[aá]fico/.test(q)) return "ga4_users";
  if (/gsc|search console/.test(q)) return "gsc_clicks";
  if (/ga4|tr[aá]fico|sesion/.test(q)) return "ga4_sessions";
  if (/revenue|venta/.test(q)) return "revenue";
  if (/pedido|orden/.test(q)) return "orders";
  if (/storefront|salud/.test(q)) return "storefront_ok";
  if (/seo|warning|warn/.test(q)) return "seo_warning";
  return null;
}

const SKU = /\d{3}-[A-Z]{3}-[A-Z]{3}(?:-(XS|S|M|L|XL|XXL))?/i;

export function createAssistantAdapter(options: {
  health: HealthAdapter;
  catalog: CatalogAdapter;
  commerce: CommerceAdapter;
  warehouse: Warehouse;
  seo: SeoReportAdapter;
  analytics: AnalyticsAdapter;
  competitors: CompetitorsAdapter;
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
        const sales = await options.commerce.sales();
        const sku = trimmed.match(SKU)?.[0];
        if (sku) {
          const parent = parentSkuFromVariant(sku);
          const rollup = (sales.products ?? []).find((row) => row.parent_sku === parent) ?? null;
          return {
            mode: "deterministic",
            intent,
            question: trimmed,
            data: {
              configured: sales.configured,
              reason: sales.reason,
              fetched_at: sales.fetched_at,
              parent_sku: parent,
              product: rollup,
            },
            note,
          };
        }
        return { mode: "deterministic", intent, question: trimmed, data: sales, note };
      }
      if (intent === "settings") {
        return { mode: "deterministic", intent, question: trimmed, data: await options.commerce.settings(), note };
      }
      if (intent === "seo") {
        const latest = options.seo.readLatest();
        return {
          mode: "deterministic",
          intent,
          question: trimmed,
          data: {
            configured: latest.configured,
            reason: latest.reason,
            summary: latest.summary
              ? {
                  generatedAt: latest.summary.generatedAt,
                  auditedCount: latest.summary.auditedCount,
                  totals: latest.summary.totals,
                  age_h: latest.summary.age_h,
                  pages: latest.summary.pages.slice(0, 10),
                }
              : null,
            alerts: options.warehouse.listAlerts("open").filter((alert) => alert.rule_id.startsWith("seo_")),
          },
          note,
        };
      }
      if (intent === "gsc") {
        const report = await options.analytics.searchConsole();
        options.warehouse.recordGsc(report);
        return { mode: "deterministic", intent, question: trimmed, data: report, note };
      }
      if (intent === "ga4") {
        const report = await options.analytics.ga4();
        options.warehouse.recordGa4(report);
        return { mode: "deterministic", intent, question: trimmed, data: report, note };
      }
      if (intent === "competitors") {
        return { mode: "deterministic", intent, question: trimmed, data: await options.competitors.snapshot(), note };
      }
      if (intent === "chart") {
        const kpi = pickChartKpi(trimmed);
        if (!kpi) {
          return {
            mode: "deterministic",
            intent,
            question: trimmed,
            data: {
              chart: null,
              available: Object.entries(CHART_KPIS).map(([id, meta]) => ({ kpi: id, title: meta.title })),
            },
            note,
          };
        }
        const meta = CHART_KPIS[kpi];
        const series = options.warehouse.snapshots(50, kpi).slice().reverse();
        return {
          mode: "deterministic",
          intent,
          question: trimmed,
          data: {
            chart: { type: "line", kpi, period: meta.period, title: meta.title },
            series: series.map((row) => ({ at: row.at, value: row.value })),
          },
          note,
        };
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

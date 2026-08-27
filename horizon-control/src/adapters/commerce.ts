import { allowlistedFetch } from "../http/allowlist.js";

export type SalesBucket = {
  orders: number;
  revenue: number | null;
  currency: string;
};

export type CommerceSales = {
  configured: boolean;
  reason?: string;
  store_id: string;
  currency: string;
  today: SalesBucket;
  week: SalesBucket;
  month: SalesBucket;
  recent_orders: Array<{ id: number; status: string; total: string; date: string }>;
};

export type CommerceSettingRow = { id: string; label: string; value: string };
export type CommercePayment = { id: string; title: string; enabled: boolean };

export type CommerceSettings = {
  configured: boolean;
  reason?: string;
  store_id: string;
  storefront_url: string;
  api_url: string;
  wp_admin_url: string;
  environment: {
    wc_version: string | null;
    wp_version: string | null;
    currency: string | null;
    currency_symbol: string | null;
    language: string | null;
  };
  general: CommerceSettingRow[];
  payments: CommercePayment[];
};

export type CommerceAdapter = {
  sales: () => Promise<CommerceSales>;
  settings: () => Promise<CommerceSettings>;
};

type WooOrder = {
  id?: number;
  status?: string;
  total?: string;
  date_created?: string;
  date_created_gmt?: string;
  currency?: string;
};

type WooSalesReport = {
  total_sales?: string;
  net_sales?: string;
  total_orders?: number | string;
  totals?: Record<string, { sales?: string; orders?: number | string }>;
};

const GENERAL_SETTING_IDS = new Set([
  "woocommerce_store_address",
  "woocommerce_store_city",
  "woocommerce_default_country",
  "woocommerce_store_postcode",
  "woocommerce_currency",
  "woocommerce_currency_pos",
  "woocommerce_price_thousand_sep",
  "woocommerce_price_decimal_sep",
  "woocommerce_price_num_decimals",
  "woocommerce_weight_unit",
  "woocommerce_dimension_unit",
  "woocommerce_enable_coupons",
  "woocommerce_calc_taxes",
  "woocommerce_prices_include_tax",
  "woocommerce_ship_to_countries",
]);

function emptyBucket(currency: string): SalesBucket {
  return { orders: 0, revenue: null, currency };
}

function emptyEnvironment(): CommerceSettings["environment"] {
  return { wc_version: null, wp_version: null, currency: null, currency_symbol: null, language: null };
}

function isoDay(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function parseMoney(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function basicAuth(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;
}

function str(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

function paymentRowsOf(json: unknown): CommercePayment[] {
  if (!Array.isArray(json)) return [];
  return json.slice(0, 20).map((row) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      id: String(item.id ?? ""),
      title: String(item.title || item.method_title || item.id || ""),
      enabled: Boolean(item.enabled),
    };
  });
}

export function createCommerceAdapter(options: {
  baseUrl: string;
  storefrontUrl?: string;
  key?: string;
  secret?: string;
  user?: string;
  appPassword?: string;
  extraHosts?: string[];
  fetchImpl?: typeof fetch;
}): CommerceAdapter {
  const extraHosts = options.extraHosts ?? [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = options.baseUrl.replace(/\/$/, "");
  const storefrontUrl = (options.storefrontUrl || "https://horizonfit.com.ar").replace(/\/$/, "");
  const wpAdminUrl = `${root}/wp-admin`;
  const key = options.key?.trim() ?? "";
  const secret = options.secret?.trim() ?? "";
  const user = options.user?.trim() ?? "";
  const appPassword = options.appPassword?.trim() ?? "";

  function credentials(): { header: string } | null {
    if (key && secret) return { header: basicAuth(key, secret) };
    if (user && appPassword) return { header: basicAuth(user, appPassword) };
    return null;
  }

  async function restGet(pathAndQuery: string): Promise<{ status: number; json: unknown; headers: Headers }> {
    const url = `${root}/wp-json/wc/v3/${pathAndQuery.replace(/^\//, "")}`;
    const auth = credentials();
    if (!auth) {
      return { status: 0, json: null, headers: new Headers() };
    }
    let response = await allowlistedFetch(
      url,
      extraHosts,
      { method: "GET", timeoutMs: 12_000, headers: { authorization: auth.header, accept: "application/json" } },
      fetchImpl,
    );
    const location = response.headers.get("location");
    if ((response.status === 301 || response.status === 302) && location) {
      response = await allowlistedFetch(
        location,
        extraHosts,
        { method: "GET", timeoutMs: 12_000, headers: { authorization: auth.header, accept: "application/json" } },
        fetchImpl,
      );
    }
    const json = await response.json().catch(() => null);
    return { status: response.status, json, headers: response.headers };
  }

  function bucketFromReport(json: unknown, currency: string): SalesBucket {
    const row = Array.isArray(json) ? (json[0] as WooSalesReport | undefined) : (json as WooSalesReport | null);
    if (!row || typeof row !== "object") return emptyBucket(currency);
    const orders = Number(row.total_orders ?? 0);
    const revenue = parseMoney(row.total_sales ?? row.net_sales);
    return { orders: Number.isFinite(orders) ? orders : 0, revenue, currency };
  }

  return {
    async sales() {
      const auth = credentials();
      const currency = "ARS";
      if (!auth) {
        return {
          configured: false,
          reason: "missing_woo_rest_credentials",
          store_id: "horizon-fit",
          currency,
          today: emptyBucket(currency),
          week: emptyBucket(currency),
          month: emptyBucket(currency),
          recent_orders: [],
        };
      }
      const today = isoDay(0);
      const weekStart = isoDay(-6);
      const monthStart = isoDay(-29);
      const [todayReport, weekReport, monthReport, orders] = await Promise.all([
        restGet(`reports/sales?date_min=${today}&date_max=${today}`),
        restGet(`reports/sales?date_min=${weekStart}&date_max=${today}`),
        restGet(`reports/sales?date_min=${monthStart}&date_max=${today}`),
        restGet("orders?per_page=10&orderby=date&order=desc"),
      ]);
      if (todayReport.status >= 400) {
        return {
          configured: true,
          reason: `woo_rest_failed:${todayReport.status}`,
          store_id: "horizon-fit",
          currency,
          today: emptyBucket(currency),
          week: emptyBucket(currency),
          month: emptyBucket(currency),
          recent_orders: [],
        };
      }
      const recent = Array.isArray(orders.json) ? (orders.json as WooOrder[]) : [];
      const orderCurrency = recent[0]?.currency || currency;
      return {
        configured: true,
        store_id: "horizon-fit",
        currency: orderCurrency,
        today: bucketFromReport(todayReport.json, orderCurrency),
        week: bucketFromReport(weekReport.json, orderCurrency),
        month: bucketFromReport(monthReport.json, orderCurrency),
        recent_orders: recent.slice(0, 10).map((order) => ({
          id: Number(order.id ?? 0),
          status: String(order.status ?? ""),
          total: String(order.total ?? ""),
          date: String(order.date_created_gmt || order.date_created || ""),
        })),
      };
    },
    async settings() {
      const blank: CommerceSettings = {
        configured: false,
        store_id: "horizon-fit",
        storefront_url: storefrontUrl,
        api_url: root,
        wp_admin_url: wpAdminUrl,
        environment: emptyEnvironment(),
        general: [],
        payments: [],
      };
      if (!credentials()) {
        return { ...blank, reason: "missing_woo_rest_credentials" };
      }
      const [general, payments, status] = await Promise.all([
        restGet("settings/general"),
        restGet("payment_gateways"),
        restGet("system_status"),
      ]);
      if (general.status >= 400 && payments.status >= 400) {
        return { ...blank, configured: true, reason: `woo_rest_failed:${general.status || payments.status}` };
      }
      const generalRows = Array.isArray(general.json) ? general.json : [];
      const env = (status.json as { environment?: Record<string, unknown> } | null)?.environment ?? {};
      return {
        configured: true,
        store_id: "horizon-fit",
        storefront_url: storefrontUrl,
        api_url: root,
        wp_admin_url: wpAdminUrl,
        environment: {
          wc_version: str(env.version),
          wp_version: str(env.wp_version),
          currency: str(env.currency),
          currency_symbol: str(env.currency_symbol),
          language: str(env.language),
        },
        general: generalRows
          .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
          .filter((row) => GENERAL_SETTING_IDS.has(String(row.id ?? "")))
          .filter((row) => !/password|secret|token|api[_-]?key/i.test(String(row.id ?? "")))
          .map((row) => ({
            id: String(row.id ?? ""),
            label: String(row.label ?? row.id ?? ""),
            value: String(row.value ?? ""),
          })),
        payments: paymentRowsOf(payments.json),
      };
    },
  };
}

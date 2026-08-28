import { allowlistedFetch } from "../http/allowlist.js";

const STORE_ID = "horizon-fit";
const SIZE_SUFFIX = /-(XS|S|M|L|XL|XXL)$/i;
const PER_PAGE = 100;
const MAX_PAGES = 5;
const CACHE_MS = 120_000;
const PAID_STATUSES = "processing,completed,on-hold";

export type SalesBucket = {
  orders: number;
  units: number;
  revenue: number | null;
  aov: number | null;
  currency: string;
};

export type SalesLineItem = {
  sku: string;
  parent_sku: string;
  product_id: number | null;
  variation_id: number | null;
  slug: string | null;
  name: string;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
};

export type SalesOrder = {
  id: number;
  status: string;
  total: string;
  revenue: number | null;
  date: string;
  items: SalesLineItem[];
};

export type PeriodRollup = {
  orders: number;
  units: number;
  revenue: number | null;
  aov: number | null;
  avg_unit_price: number | null;
  units_per_order: number | null;
};

export type ProductSalesRollup = {
  parent_sku: string;
  name: string;
  product_id: number | null;
  slug: string | null;
  last_sale_at: string | null;
  velocity_30d: number | null;
  d7: PeriodRollup;
  d30: PeriodRollup;
  d90: PeriodRollup;
  variants: Array<{ sku: string; units_30d: number; revenue_30d: number | null }>;
};

export type CommerceSales = {
  configured: boolean;
  reason?: string;
  store_id: string;
  currency: string;
  fetched_at: string | null;
  incomplete: boolean;
  source: "orders";
  today: SalesBucket;
  week: SalesBucket;
  month: SalesBucket;
  ninety: SalesBucket;
  recent_orders: SalesOrder[];
  products: ProductSalesRollup[];
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

type WooLine = {
  sku?: string;
  name?: string;
  product_id?: number;
  variation_id?: number;
  quantity?: number | string;
  price?: number | string;
  total?: string;
};

type WooOrder = {
  id?: number;
  status?: string;
  total?: string;
  date_created?: string;
  date_created_gmt?: string;
  currency?: string;
  line_items?: WooLine[];
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

export function parentSkuFromVariant(sku: string): string {
  const trimmed = sku.trim();
  if (!trimmed) return "";
  return trimmed.replace(SIZE_SUFFIX, "") || trimmed;
}

function emptyBucket(currency: string): SalesBucket {
  return { orders: 0, units: 0, revenue: null, aov: null, currency };
}

function emptySales(reason: string, configured: boolean, currency = "ARS"): CommerceSales {
  return {
    configured,
    reason,
    store_id: STORE_ID,
    currency,
    fetched_at: configured ? new Date().toISOString() : null,
    incomplete: false,
    source: "orders",
    today: emptyBucket(currency),
    week: emptyBucket(currency),
    month: emptyBucket(currency),
    ninety: emptyBucket(currency),
    recent_orders: [],
    products: [],
  };
}

function emptyEnvironment(): CommerceSettings["environment"] {
  return { wc_version: null, wp_version: null, currency: null, currency_symbol: null, language: null };
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

function orderMs(order: WooOrder): number {
  const raw = String(order.date_created_gmt || order.date_created || "");
  if (!raw) return 0;
  const parsed = Date.parse(/Z|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function aovOf(revenue: number | null, orders: number): number | null {
  if (revenue == null || orders <= 0) return null;
  return revenue / orders;
}

function periodFrom(orders: number, units: number, lineRevenue: number, orderRevenue: number): PeriodRollup {
  return {
    orders,
    units,
    revenue: orders || units ? lineRevenue : null,
    aov: aovOf(orderRevenue, orders),
    avg_unit_price: units > 0 ? lineRevenue / units : null,
    units_per_order: orders > 0 ? units / orders : null,
  };
}

function mapLine(item: WooLine): SalesLineItem | null {
  const sku = String(item.sku ?? "").trim();
  if (!sku) return null;
  const quantity = Number(item.quantity);
  return {
    sku,
    parent_sku: parentSkuFromVariant(sku),
    product_id: item.product_id == null ? null : Number(item.product_id),
    variation_id: item.variation_id == null || Number(item.variation_id) === 0 ? null : Number(item.variation_id),
    slug: null,
    name: String(item.name ?? sku),
    quantity: Number.isFinite(quantity) ? quantity : 0,
    unit_price: parseMoney(item.price),
    line_total: parseMoney(item.total),
  };
}

type ProductAcc = {
  parent_sku: string;
  name: string;
  product_id: number | null;
  last_sale_at: number;
  windows: Record<"d7" | "d30" | "d90", { orderIds: Set<number>; units: number; lineRevenue: number; orderRevenue: number }>;
  variants: Map<string, { units_30d: number; revenue_30d: number }>;
};

function newAcc(parent_sku: string, name: string, product_id: number | null): ProductAcc {
  const window = () => ({ orderIds: new Set<number>(), units: 0, lineRevenue: 0, orderRevenue: 0 });
  return {
    parent_sku,
    name,
    product_id,
    last_sale_at: 0,
    windows: { d7: window(), d30: window(), d90: window() },
    variants: new Map(),
  };
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
  let cache: { at: number; value: CommerceSales } | null = null;

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

  async function fetchOrders(afterIso: string): Promise<{ orders: WooOrder[]; incomplete: boolean; error?: string }> {
    const orders: WooOrder[] = [];
    let incomplete = false;
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const path = `orders?per_page=${PER_PAGE}&page=${page}&orderby=date&order=desc&status=${encodeURIComponent(PAID_STATUSES)}&after=${encodeURIComponent(afterIso)}`;
      const res = await restGet(path);
      if (res.status >= 400) {
        return { orders, incomplete: false, error: `woo_rest_failed:${res.status}` };
      }
      const batch = Array.isArray(res.json) ? (res.json as WooOrder[]) : [];
      orders.push(...batch);
      if (batch.length < PER_PAGE) return { orders, incomplete };
      if (page === MAX_PAGES) incomplete = true;
    }
    return { orders, incomplete };
  }

  return {
    async sales() {
      const currency = "ARS";
      if (!credentials()) return emptySales("missing_woo_rest_credentials", false, currency);
      if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

      const fetched_at = new Date().toISOString();
      const now = Date.now();
      const start90 = now - 90 * 86_400_000;
      const start30 = now - 30 * 86_400_000;
      const start7 = now - 7 * 86_400_000;
      const startToday = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
      const afterIso = new Date(start90).toISOString().replace(/\.\d{3}Z$/, "");

      const fetched = await fetchOrders(afterIso);
      if (fetched.error && !fetched.orders.length) {
        return emptySales(fetched.error, true, currency);
      }

      const mapped: SalesOrder[] = fetched.orders.map((order) => ({
        id: Number(order.id ?? 0),
        status: String(order.status ?? ""),
        total: String(order.total ?? ""),
        revenue: parseMoney(order.total),
        date: String(order.date_created_gmt || order.date_created || ""),
        items: (order.line_items ?? []).map(mapLine).filter((row): row is SalesLineItem => Boolean(row)),
      }));

      const orderCurrency = fetched.orders[0]?.currency || currency;
      const store = {
        today: { orderIds: new Set<number>(), units: 0, revenue: 0 },
        d7: { orderIds: new Set<number>(), units: 0, revenue: 0 },
        d30: { orderIds: new Set<number>(), units: 0, revenue: 0 },
        d90: { orderIds: new Set<number>(), units: 0, revenue: 0 },
      };
      const products = new Map<string, ProductAcc>();

      for (const order of fetched.orders) {
        const id = Number(order.id ?? 0);
        const at = orderMs(order);
        const orderTotal = parseMoney(order.total) ?? 0;
        const lines = (order.line_items ?? []).map(mapLine).filter((row): row is SalesLineItem => Boolean(row));
        const units = lines.reduce((sum, line) => sum + line.quantity, 0);
        const windows = [
          at >= startToday ? store.today : null,
          at >= start7 ? store.d7 : null,
          at >= start30 ? store.d30 : null,
          at >= start90 ? store.d90 : null,
        ].filter(Boolean) as Array<{ orderIds: Set<number>; units: number; revenue: number }>;
        for (const bucket of windows) {
          bucket.orderIds.add(id);
          bucket.units += units;
          bucket.revenue += orderTotal;
        }

        for (const line of lines) {
          let acc = products.get(line.parent_sku);
          if (!acc) {
            acc = newAcc(line.parent_sku, line.name, line.product_id);
            products.set(line.parent_sku, acc);
          }
          if (at > acc.last_sale_at) {
            acc.last_sale_at = at;
            acc.name = line.name;
            acc.product_id = line.product_id ?? acc.product_id;
          }
          const lineRev = line.line_total ?? 0;
          const apply = (key: "d7" | "d30" | "d90", include: boolean) => {
            if (!include) return;
            const w = acc!.windows[key];
            if (!w.orderIds.has(id)) {
              w.orderIds.add(id);
              w.orderRevenue += orderTotal;
            }
            w.units += line.quantity;
            w.lineRevenue += lineRev;
          };
          apply("d90", at >= start90);
          apply("d30", at >= start30);
          apply("d7", at >= start7);
          if (at >= start30) {
            const variant = acc.variants.get(line.sku) ?? { units_30d: 0, revenue_30d: 0 };
            variant.units_30d += line.quantity;
            variant.revenue_30d += lineRev;
            acc.variants.set(line.sku, variant);
          }
        }
      }

      function toBucket(part: { orderIds: Set<number>; units: number; revenue: number }): SalesBucket {
        const orders = part.orderIds.size;
        return {
          orders,
          units: part.units,
          revenue: orders ? part.revenue : null,
          aov: aovOf(part.revenue, orders),
          currency: orderCurrency,
        };
      }

      const rollups: ProductSalesRollup[] = [...products.values()]
        .map((acc) => {
          const asPeriod = (key: "d7" | "d30" | "d90") => {
            const w = acc.windows[key];
            return periodFrom(w.orderIds.size, w.units, w.lineRevenue, w.orderRevenue);
          };
          const d30 = asPeriod("d30");
          return {
            parent_sku: acc.parent_sku,
            name: acc.name,
            product_id: acc.product_id,
            slug: null,
            last_sale_at: acc.last_sale_at ? new Date(acc.last_sale_at).toISOString() : null,
            velocity_30d: d30.units > 0 ? d30.units / 30 : null,
            d7: asPeriod("d7"),
            d30,
            d90: asPeriod("d90"),
            variants: [...acc.variants.entries()]
              .map(([sku, row]) => ({ sku, units_30d: row.units_30d, revenue_30d: row.revenue_30d }))
              .sort((a, b) => b.units_30d - a.units_30d),
          };
        })
        .sort((a, b) => (b.d30.revenue ?? 0) - (a.d30.revenue ?? 0))
        .slice(0, 50);

      const value: CommerceSales = {
        configured: true,
        reason: fetched.error,
        store_id: STORE_ID,
        currency: orderCurrency,
        fetched_at,
        incomplete: fetched.incomplete,
        source: "orders",
        today: toBucket(store.today),
        week: toBucket(store.d7),
        month: toBucket(store.d30),
        ninety: toBucket(store.d90),
        recent_orders: mapped.slice(0, 10),
        products: rollups,
      };
      cache = { at: Date.now(), value };
      return value;
    },
    async settings() {
      const blank: CommerceSettings = {
        configured: false,
        store_id: STORE_ID,
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
        store_id: STORE_ID,
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

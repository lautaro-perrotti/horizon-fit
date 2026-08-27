export type WooProduct = {
  id: number;
  name: string;
  slug: string;
  sku?: string;
  status?: string;
  permalink?: string;
  price?: string;
  stock_status?: string;
};

export type WooAdapter = {
  searchProducts: (query: string, limit?: number) => Promise<WooProduct[]>;
  getProduct: (id: string | number) => Promise<WooProduct | null>;
};

export function createWooAdapter(options: {
  baseUrl: string;
  user: string;
  appPassword: string;
  fetchImpl?: typeof fetch;
}): WooAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function wooFetch(path: string): Promise<Response> {
    if (!options.baseUrl || !options.user || !options.appPassword) {
      throw new Error("woo_not_configured");
    }
    const url = new URL(path, options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`);
    const basic = Buffer.from(`${options.user}:${options.appPassword}`).toString("base64");
    return fetchImpl(url, {
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/json",
      },
    });
  }

  return {
    async searchProducts(query, limit = 20) {
      const params = new URLSearchParams({
        search: query,
        per_page: String(Math.min(Math.max(limit, 1), 50)),
        status: "publish",
      });
      const response = await wooFetch(`wp-json/wc/v3/products?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`woo_search_failed:${response.status}`);
      }
      return (await response.json()) as WooProduct[];
    },
    async getProduct(id) {
      const response = await wooFetch(`wp-json/wc/v3/products/${encodeURIComponent(String(id))}`);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`woo_get_failed:${response.status}`);
      }
      return (await response.json()) as WooProduct;
    },
  };
}

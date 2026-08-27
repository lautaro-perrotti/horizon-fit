import type { CatalogProduct, CatalogSearchFilters, CatalogVariation } from "../types.js";
import { allowlistedFetch } from "../http/allowlist.js";

export type CatalogAdapter = {
  searchProducts: (filters: CatalogSearchFilters) => Promise<{ products: CatalogProduct[]; page: number; limit: number }>;
  getProduct: (id: string | number) => Promise<CatalogProduct | null>;
};

const HORIZON_SKU = /^(\d{3}-[A-Z]{3}-[A-Z]{3})(?:-(S|M|L|XL|XXL))?$/i;

type StorePrices = {
  price?: string;
  currency_code?: string;
  currency_minor_unit?: number;
};

type StoreImage = { src?: string; thumbnail?: string };
type StoreTerm = { name?: string; slug?: string; value?: string };
type StoreAttribute = { name?: string; terms?: StoreTerm[]; has_variations?: boolean; value?: string };
type StoreVariationStub = { id?: number; attributes?: Array<{ name?: string; value?: string | null }> };
type StoreProduct = {
  id?: number;
  name?: string;
  slug?: string;
  parent?: number;
  type?: string;
  sku?: string;
  description?: string;
  short_description?: string;
  permalink?: string;
  prices?: StorePrices;
  images?: StoreImage[];
  categories?: StoreTerm[];
  attributes?: StoreAttribute[];
  variations?: Array<number | StoreVariationStub>;
  is_in_stock?: boolean;
  stock_status?: string;
};

function formatPrice(prices?: StorePrices): { amount: string | null; currency: string; raw: string } {
  const raw = String(prices?.price ?? "");
  const currency = prices?.currency_code ?? "ARS";
  const minor = Number(prices?.currency_minor_unit ?? 2);
  const numeric = Number(raw);
  if (!raw || !Number.isFinite(numeric)) return { amount: null, currency, raw };
  return { amount: (numeric / 10 ** minor).toFixed(Math.max(0, minor)), currency, raw };
}

function stockStatus(product: StoreProduct): string {
  if (product.stock_status) return String(product.stock_status);
  return product.is_in_stock === false ? "outofstock" : "instock";
}

function attrMap(product: StoreProduct): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const attribute of product.attributes ?? []) {
    const name = attribute.name || "attribute";
    const terms = (attribute.terms ?? []).map((term) => String(term.name || term.slug || term.value || "")).filter(Boolean);
    if (terms.length) {
      out[name] = terms;
    } else if (attribute.value) {
      out[name] = [String(attribute.value)];
    }
  }
  return out;
}

export function parentSkuOf(sku: string): string {
  const trimmed = sku.trim();
  const match = trimmed.match(HORIZON_SKU);
  if (match) return match[1].toUpperCase();
  return trimmed.replace(/-(S|M|L|XL|XXL)$/i, "");
}

export function looksLikeHorizonSku(value: string): boolean {
  return HORIZON_SKU.test(value.trim());
}

function variationIds(product: StoreProduct): number[] {
  return (product.variations ?? [])
    .map((entry) => (typeof entry === "number" ? entry : Number(entry?.id ?? 0)))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function variationAttrsFromProduct(product: StoreProduct): Array<{ name: string; value: string }> {
  const mapped = attrMap(product);
  const pairs = Object.entries(mapped).flatMap(([name, values]) => values.map((value) => ({ name, value })));
  if (pairs.length) return pairs;
  return (product.attributes ?? [])
    .map((attribute) => ({ name: String(attribute.name ?? ""), value: String(attribute.value ?? "") }))
    .filter((row) => row.name && row.value);
}

function variationAttrsFromStub(stub: StoreVariationStub): Array<{ name: string; value: string }> {
  return (stub.attributes ?? [])
    .map((attribute) => ({ name: String(attribute.name ?? ""), value: String(attribute.value ?? "") }))
    .filter((row) => row.name && row.value);
}

function firstImage(product: StoreProduct): string | null {
  return product.images?.[0]?.src ?? product.images?.[0]?.thumbnail ?? null;
}

function toVariation(variation: StoreProduct, parent: StoreProduct): CatalogVariation {
  return {
    id: Number(variation.id ?? 0),
    sku: String(variation.sku ?? ""),
    name: String(variation.name ?? parent.name ?? ""),
    parent: Number(variation.parent ?? parent.id ?? 0),
    in_stock: variation.is_in_stock !== false,
    price: formatPrice(variation.prices ?? parent.prices),
    attributes: variationAttrsFromProduct(variation),
    image: firstImage(variation) ?? firstImage(parent),
  };
}

function stubVariation(stub: StoreVariationStub, parent: StoreProduct): CatalogVariation {
  return {
    id: Number(stub.id ?? 0),
    sku: "",
    name: String(parent.name ?? ""),
    parent: Number(parent.id ?? 0),
    in_stock: parent.is_in_stock !== false,
    price: formatPrice(parent.prices),
    attributes: variationAttrsFromStub(stub),
    image: firstImage(parent),
  };
}

function normalizeProduct(product: StoreProduct, variations: CatalogVariation[] = []): CatalogProduct {
  const sku = String(product.sku ?? "");
  return {
    id: Number(product.id ?? 0),
    parent_sku: parentSkuOf(sku) || sku,
    sku,
    slug: String(product.slug ?? ""),
    name: String(product.name ?? ""),
    status: "publish",
    categories: (product.categories ?? []).map((category) => ({
      name: String(category.name ?? ""),
      slug: String(category.slug ?? ""),
    })),
    description: String(product.description ?? ""),
    short_description: String(product.short_description ?? ""),
    images: (product.images ?? []).map((image) => String(image.src || image.thumbnail || "")).filter(Boolean),
    attributes: attrMap(product),
    variations,
    price: formatPrice(product.prices),
    stock_status: stockStatus(product),
  };
}

function wantedSize(filters: CatalogSearchFilters): string | undefined {
  return filters.size || filters.talle;
}

function matchesLocalFilters(product: CatalogProduct, filters: CatalogSearchFilters): boolean {
  if (filters.sku) {
    const want = filters.sku.toLowerCase();
    const hit =
      product.sku.toLowerCase() === want ||
      product.parent_sku.toLowerCase() === want ||
      product.variations.some((variation) => variation.sku.toLowerCase() === want);
    if (!hit) return false;
  }
  if (filters.category) {
    const want = filters.category.toLowerCase();
    if (!product.categories.some((category) => category.slug.toLowerCase() === want || category.name.toLowerCase() === want)) {
      return false;
    }
  }
  if (filters.stock_status && product.stock_status !== filters.stock_status) return false;
  if (filters.color) {
    const want = filters.color.toLowerCase();
    const colors = [...(product.attributes.Color ?? []), ...(product.attributes.color ?? [])];
    const fromVariations = product.variations.flatMap((variation) =>
      variation.attributes.filter((attribute) => attribute.name.toLowerCase() === "color").map((attribute) => attribute.value),
    );
    if (![...colors, ...fromVariations].some((value) => value.toLowerCase() === want || value.toLowerCase().includes(want))) {
      return false;
    }
  }
  const size = wantedSize(filters);
  if (size) {
    const want = size.toLowerCase();
    const sizes = [
      ...(product.attributes.Talle ?? []),
      ...(product.attributes.Size ?? []),
      ...(product.attributes.size ?? []),
    ];
    const fromVariations = product.variations.flatMap((variation) =>
      variation.attributes
        .filter((attribute) => /^(talle|size)$/i.test(attribute.name))
        .map((attribute) => attribute.value),
    );
    if (![...sizes, ...fromVariations].some((value) => value.toLowerCase() === want)) return false;
  }
  return true;
}

function asStoreList(json: unknown): StoreProduct[] {
  return Array.isArray(json) ? (json as StoreProduct[]) : [];
}

export function createCatalogAdapter(options: {
  baseUrl: string;
  extraHosts?: string[];
  fetchImpl?: typeof fetch;
}): CatalogAdapter {
  const extraHosts = options.extraHosts ?? [];
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = options.baseUrl.replace(/\/$/, "");

  async function storeGet(pathAndQuery: string): Promise<{ status: number; json: unknown }> {
    const url = `${root}/wp-json/wc/store/v1/${pathAndQuery.replace(/^\//, "")}`;
    const response = await allowlistedFetch(url, extraHosts, { method: "GET", timeoutMs: 10_000 }, fetchImpl);
    const json = await response.json().catch(() => null);
    return { status: response.status, json };
  }

  async function loadVariations(product: StoreProduct): Promise<CatalogVariation[]> {
    const ids = variationIds(product);
    if (!ids.length) return [];
    const included = await storeGet(
      `products?include=${ids.join(",")}&per_page=${Math.min(ids.length, 50)}&type=variation`,
    );
    let loaded = asStoreList(included.json);
    if (!loaded.length) {
      const fallback = await storeGet(`products?include=${ids.join(",")}&per_page=${Math.min(ids.length, 50)}`);
      loaded = asStoreList(fallback.json);
    }
    if (loaded.length) {
      return loaded.map((variation) => toVariation(variation, product));
    }
    return (product.variations ?? [])
      .filter((entry): entry is StoreVariationStub => typeof entry === "object" && entry !== null)
      .map((stub) => stubVariation(stub, product));
  }

  async function mapWithVariations(raw: StoreProduct): Promise<CatalogProduct> {
    if (raw.type === "variation" && Number(raw.parent ?? 0) > 0) {
      const parent = await storeGet(`products/${encodeURIComponent(String(raw.parent))}`);
      if (parent.json && typeof parent.json === "object") {
        return mapWithVariations(parent.json as StoreProduct);
      }
    }
    const variations = await loadVariations(raw);
    return normalizeProduct(raw, variations);
  }

  async function firstProduct(queries: string[]): Promise<CatalogProduct | null> {
    for (const query of queries) {
      const listed = await storeGet(`products?${query}`);
      const first = asStoreList(listed.json)[0];
      if (first) return mapWithVariations(first);
    }
    return null;
  }

  return {
    async searchProducts(filters) {
      const page = Math.max(1, filters.page ?? 1);
      const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
      const sku =
        filters.sku?.trim() ||
        (filters.query && looksLikeHorizonSku(filters.query) ? filters.query.trim().toUpperCase() : "");
      const params = new URLSearchParams({ page: String(page), per_page: String(limit) });
      if (filters.query && !sku) params.set("search", filters.query);
      if (sku) params.set("sku", sku);
      if (filters.query && sku && filters.query.trim().toUpperCase() !== sku) params.set("search", filters.query);
      if (filters.category) params.set("category", filters.category);
      if (filters.stock_status) params.set("stock_status", filters.stock_status);
      const result = await storeGet(`products?${params.toString()}`);
      if (result.status >= 400 || !Array.isArray(result.json)) {
        throw Object.assign(new Error(`catalog_search_failed:${result.status}`), {
          status: result.status >= 400 ? result.status : 502,
        });
      }
      const mapped = await Promise.all(asStoreList(result.json).map((product) => mapWithVariations(product)));
      return { products: mapped.filter((product) => matchesLocalFilters(product, { ...filters, sku: sku || filters.sku })), page, limit };
    },
    async getProduct(id) {
      const key = String(id).trim();
      if (!key) return null;
      if (/^\d+$/.test(key)) {
        const byId = await storeGet(`products/${encodeURIComponent(key)}`);
        if (byId.status === 404) return null;
        if (byId.status >= 400 || !byId.json || typeof byId.json !== "object") {
          throw Object.assign(new Error(`catalog_get_failed:${byId.status}`), { status: byId.status });
        }
        return mapWithVariations(byId.json as StoreProduct);
      }
      const sku = looksLikeHorizonSku(key) ? key.toUpperCase() : key;
      const parent = looksLikeHorizonSku(key) ? parentSkuOf(key) : "";
      return firstProduct(
        [
          `sku=${encodeURIComponent(sku)}`,
          parent && parent !== sku ? `sku=${encodeURIComponent(parent)}` : "",
          `slug=${encodeURIComponent(key)}`,
          `search=${encodeURIComponent(key)}`,
        ].filter(Boolean),
      );
    },
  };
}

export const createWooAdapter = createCatalogAdapter;
export type WooAdapter = CatalogAdapter;
export type WooProduct = CatalogProduct;

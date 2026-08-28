import type { CatalogProduct } from "../types.js";
import type { CatalogAdapter } from "./woo.js";

const STOREFRONT_ORIGIN = "https://horizonfit.com.ar";
const SIZE_SUFFIX = /-(XS|S|M|L|XL|XXL)$/i;
const HORIZON_SKU = /^(\d{3}-[A-Z]{3}-[A-Z]{3})(?:-(XS|S|M|L|XL|XXL))?$/i;
const PRODUCT_PATH = /\/product\/([^/?#]+)\/?$/i;

export type IdentityKind = "parent_sku" | "variant_sku" | "product_id" | "slug" | "url";

export type ParsedProductRef = {
  input: string;
  kind: IdentityKind;
  lookup: string;
  parent_sku_hint: string | null;
  variant_sku: string | null;
  product_id: number | null;
  slug_hint: string | null;
};

export type ProductIdentity = {
  input: string;
  kind: IdentityKind;
  parent_sku: string;
  variant_sku: string | null;
  product_id: number | null;
  slug: string | null;
  canonical_url: string | null;
};

export type ResolvedProduct = {
  identity: ProductIdentity;
  product: CatalogProduct;
};

export function parentSkuFromVariant(sku: string): string {
  const trimmed = sku.trim();
  if (!trimmed) return "";
  const match = trimmed.toUpperCase().match(HORIZON_SKU);
  if (match) return match[1];
  return trimmed.replace(SIZE_SUFFIX, "") || trimmed;
}

function canonicalUrl(slug: string | null): string | null {
  if (!slug) return null;
  return `${STOREFRONT_ORIGIN}/product/${slug.replace(/^\/+|\/+$/g, "")}/`;
}

function slugFromPath(pathname: string): string | null {
  const match = pathname.match(PRODUCT_PATH);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

export function parseProductRef(raw: string): ParsedProductRef | null {
  const input = raw.trim();
  if (!input) return null;

  if (/^https?:\/\//i.test(input)) {
    let parsed: URL;
    try {
      parsed = new URL(input);
    } catch {
      return null;
    }
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "horizonfit.com.ar") return null;
    const slug = slugFromPath(parsed.pathname);
    if (!slug) return null;
    return {
      input,
      kind: "url",
      lookup: slug,
      parent_sku_hint: null,
      variant_sku: null,
      product_id: null,
      slug_hint: slug,
    };
  }

  const pathSlug = slugFromPath(input.startsWith("/") ? input : `/${input}`);
  if (pathSlug && /product\//i.test(input)) {
    return {
      input,
      kind: "url",
      lookup: pathSlug,
      parent_sku_hint: null,
      variant_sku: null,
      product_id: null,
      slug_hint: pathSlug,
    };
  }

  if (/^\d+$/.test(input)) {
    return {
      input,
      kind: "product_id",
      lookup: input,
      parent_sku_hint: null,
      variant_sku: null,
      product_id: Number(input),
      slug_hint: null,
    };
  }

  const skuMatch = input.toUpperCase().match(HORIZON_SKU);
  if (skuMatch) {
    const parent = skuMatch[1];
    const size = skuMatch[2];
    if (size) {
      return {
        input,
        kind: "variant_sku",
        lookup: parent,
        parent_sku_hint: parent,
        variant_sku: `${parent}-${size}`,
        product_id: null,
        slug_hint: null,
      };
    }
    return {
      input,
      kind: "parent_sku",
      lookup: parent,
      parent_sku_hint: parent,
      variant_sku: null,
      product_id: null,
      slug_hint: null,
    };
  }

  return {
    input,
    kind: "slug",
    lookup: input,
    parent_sku_hint: null,
    variant_sku: null,
    product_id: null,
    slug_hint: input,
  };
}

export async function resolveProductIdentity(
  catalog: CatalogAdapter,
  raw: string,
): Promise<ResolvedProduct | null> {
  const parsed = parseProductRef(raw);
  if (!parsed) return null;
  const product = await catalog.getProduct(parsed.lookup);
  if (!product) return null;
  const slug = product.slug || parsed.slug_hint;
  return {
    identity: {
      input: parsed.input,
      kind: parsed.kind,
      parent_sku: product.parent_sku || parsed.parent_sku_hint || product.sku,
      variant_sku: parsed.variant_sku,
      product_id: product.id || parsed.product_id,
      slug: slug || null,
      canonical_url: canonicalUrl(slug),
    },
    product,
  };
}

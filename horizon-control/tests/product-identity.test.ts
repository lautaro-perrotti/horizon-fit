import { describe, expect, it } from "vitest";
import { parseProductRef, parentSkuFromVariant, resolveProductIdentity } from "../src/adapters/product-identity.js";
import { mockWoo } from "./helpers.js";

describe("004-TOP-BOR identity regression", () => {
  it("resolves parent SKU, variant SKU, Woo id, variation id, slug, and PDP URL to one parent", async () => {
    const catalog = mockWoo();
    const refs = [
      "004-TOP-BOR",
      "004-TOP-BOR-S",
      "204",
      "205",
      "top-bordeaux",
      "https://horizonfit.com.ar/product/top-bordeaux/",
    ];
    for (const ref of refs) {
      const resolved = await resolveProductIdentity(catalog, ref);
      expect(resolved?.identity.parent_sku, ref).toBe("004-TOP-BOR");
      expect(resolved?.identity.slug, ref).toBe("top-bordeaux");
      expect(resolved?.identity.canonical_url, ref).toBe("https://horizonfit.com.ar/producto/top-bordeaux/");
      expect(resolved?.identity.product_id, ref).toBe(204);
    }
    const variant = await resolveProductIdentity(catalog, "004-TOP-BOR-S");
    expect(variant?.identity.kind).toBe("variant_sku");
    expect(variant?.identity.variant_sku).toBe("004-TOP-BOR-S");
    const byVariationId = await resolveProductIdentity(catalog, "205");
    expect(byVariationId?.identity.kind).toBe("product_id");
    expect(byVariationId?.identity.variation_id).toBe(205);
    expect(byVariationId?.identity.variant_sku).toBe("004-TOP-BOR-S");
  });
});

describe("resolveProductIdentity", () => {
  it("maps variation SKU, parent SKU, Woo id, slug, and PDP URL onto 001-TOP-AZU", async () => {
    expect(parentSkuFromVariant("001-TOP-AZU-S")).toBe("001-TOP-AZU");
    expect(parseProductRef("001-TOP-AZU-XS")?.kind).toBe("variant_sku");
    expect(parseProductRef("001-TOP-AZU")?.kind).toBe("parent_sku");
    expect(parseProductRef("99")?.kind).toBe("product_id");
    expect(parseProductRef("top-liso-azul")?.kind).toBe("slug");
    expect(parseProductRef("https://horizonfit.com.ar/product/top-liso-azul/")?.kind).toBe("url");
    expect(parseProductRef("https://horizonfit.com.ar/producto/top-liso-azul/")?.kind).toBe("url");
    expect(parseProductRef("/product/top-liso-azul/")?.slug_hint).toBe("top-liso-azul");
    expect(parseProductRef("/producto/top-falda-bordo/")?.slug_hint).toBe("top-falda-bordo");
    expect(parseProductRef("https://evil.example/product/x/")).toBeNull();

    const catalog = mockWoo();
    const refs = ["001-TOP-AZU-S", "001-TOP-AZU", "99", "top-liso-azul", "https://horizonfit.com.ar/product/top-liso-azul/"];
    for (const ref of refs) {
      const resolved = await resolveProductIdentity(catalog, ref);
      expect(resolved?.identity.parent_sku).toBe("001-TOP-AZU");
      expect(resolved?.identity.slug).toBe("top-liso-azul");
      expect(resolved?.identity.canonical_url).toBe("https://horizonfit.com.ar/producto/top-liso-azul/");
      expect(resolved?.identity.product_id).toBe(99);
    }
    const variant = await resolveProductIdentity(catalog, "001-TOP-AZU-S");
    expect(variant?.identity.kind).toBe("variant_sku");
    expect(variant?.identity.variant_sku).toBe("001-TOP-AZU-S");
  });
});

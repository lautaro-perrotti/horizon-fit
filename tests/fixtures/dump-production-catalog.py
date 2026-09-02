#!/usr/bin/env python3
"""Read-only snapshot of the production WooCommerce Store API catalog.

Committed as tests/fixtures/production-catalog-summary.json and used by
tests/search-merchant-tests.php. Does not write to WooCommerce or the VPS.
"""
import json
import os
import urllib.request
from collections import Counter, defaultdict

BASE = "https://api.horizonfit.com.ar/wp-json/wc/store/v1"
OUT = os.path.join(os.path.dirname(__file__), "production-catalog-summary.json")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "HorizonFit-SEO-Audit/1.0"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def attr_map(product):
    out = {}
    for attr in product.get("attributes") or []:
        name = (attr.get("name") or "").strip()
        terms = []
        for term in attr.get("terms") or []:
            terms.append(term.get("name") or term.get("slug") or "")
        out[name] = [t for t in terms if t]
    return out


def main():
    products = get(f"{BASE}/products?per_page=100")
    variation_skus = []
    rows = []
    for product in products:
        variations = []
        for variation in product.get("variations") or []:
            vid = variation.get("id")
            detail = get(f"{BASE}/products/{vid}") if vid else {}
            sku = (detail.get("sku") or "").strip()
            if sku:
                variation_skus.append(sku)
            variations.append({
                "id": vid,
                "sku": sku,
                "name": detail.get("name"),
                "parent": detail.get("parent"),
                "in_stock": detail.get("is_in_stock"),
                "price": (detail.get("prices") or {}).get("price"),
                "attributes": variation.get("attributes") or [],
                "image": ((detail.get("images") or [{}])[0] or {}).get("src") or "",
            })
        rows.append({
            "id": product.get("id"),
            "name": product.get("name"),
            "slug": product.get("slug"),
            "sku": product.get("sku"),
            "type": product.get("type"),
            "categories": [
                {"name": c.get("name"), "slug": c.get("slug")}
                for c in (product.get("categories") or [])
            ],
            "attributes": attr_map(product),
            "price": (product.get("prices") or {}).get("price"),
            "currency": (product.get("prices") or {}).get("currency_code"),
            "in_stock": product.get("is_in_stock"),
            "images": [img.get("src") for img in (product.get("images") or []) if img.get("src")],
            "description_len": len(product.get("description") or ""),
            "short_description_len": len(product.get("short_description") or ""),
            "variations": variations,
        })

    types = Counter()
    for sku in variation_skus:
        parts = [p for p in sku.upper().split("-") if p]
        if len(parts) >= 2:
            types[parts[1]] += 1

    summary = {
        "source": BASE,
        "products": len(rows),
        "variations": sum(len(r["variations"]) for r in rows),
        "parent_skus": sorted({r["sku"] for r in rows if r.get("sku")}),
        "variation_sku_sample": variation_skus[:12],
        "variation_skus_missing": sum(1 for r in rows for v in r["variations"] if not v.get("sku")),
        "garment_types_from_variation_sku": dict(types),
        "categories": sorted({
            c["slug"]
            for r in rows
            for c in r["categories"]
        }),
        "items": rows,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=2)
    print(f"Wrote {OUT}")
    print("products", summary["products"], "variations", summary["variations"])
    print("missing variation skus", summary["variation_skus_missing"])
    print("types", summary["garment_types_from_variation_sku"])
    print("categories", summary["categories"])


if __name__ == "__main__":
    main()

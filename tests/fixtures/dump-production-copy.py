#!/usr/bin/env python3
"""Fetch production product copy (read-only) for Search snippet tests.

Does not modify tests/fixtures/production-catalog-summary.json.
"""
import json
import os
import urllib.request

BASE = "https://api.horizonfit.com.ar/wp-json/wc/store/v1"
OUT = os.path.join(os.path.dirname(__file__), "production-product-copy.json")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "HorizonFit-SEO-Audit/1.0"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def main():
    products = get(f"{BASE}/products?per_page=100")
    items = []
    for product in products:
        items.append({
            "id": product.get("id"),
            "name": product.get("name"),
            "slug": product.get("slug"),
            "sku": product.get("sku"),
            "description": product.get("description") or "",
            "short_description": product.get("short_description") or "",
        })
    payload = {
        "source": BASE,
        "products": len(items),
        "items": items,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"Wrote {OUT} ({len(items)} products)")


if __name__ == "__main__":
    main()

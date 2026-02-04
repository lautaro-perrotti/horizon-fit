import json
import os
from collections import defaultdict

def main() -> int:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    items: list[dict] = []

    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if not fn.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace("\\", "/")
            parts = rel.split("/")
            meta = {
                "rel": rel,
                "theme": parts[0] if len(parts) > 0 else None,
                "viewport": parts[1] if len(parts) > 1 else None,
                "bucket": parts[2] if len(parts) > 2 else None,
                "file": parts[-1],
            }
            try:
                meta["size"] = os.path.getsize(full)
            except OSError:
                meta["size"] = None
            items.append(meta)

    summary = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for it in items:
        summary[it["theme"]][it["viewport"]][it["bucket"]] += 1

    out = os.path.join(root, "_tmp", "artifact-index.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"root": root, "total": len(items), "items": items}, f, ensure_ascii=False, indent=2)

    print("TOTAL", len(items))
    for theme in sorted(summary):
        for viewport in sorted(summary[theme]):
            for bucket in sorted(summary[theme][viewport]):
                print(theme, viewport, bucket, summary[theme][viewport][bucket])

    print("WROTE", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

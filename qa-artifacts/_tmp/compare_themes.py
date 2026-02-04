import json
import os
from dataclasses import dataclass
from collections import defaultdict

from PIL import Image


@dataclass(frozen=True)
class Key:
    viewport: str
    bucket: str
    filename: str


def dhash(image: Image.Image, hash_size: int = 8) -> int:
    # Difference hash (dHash). Produces hash_size*hash_size bits.
    im = image.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
    pixels = list(im.getdata())
    rows = [pixels[i * (hash_size + 1) : (i + 1) * (hash_size + 1)] for i in range(hash_size)]
    bits = []
    for row in rows:
        for x in range(hash_size):
            bits.append(1 if row[x] > row[x + 1] else 0)
    value = 0
    for b in bits:
        value = (value << 1) | b
    return value


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def mean_luma(path: str) -> float:
    with Image.open(path) as im:
        im = im.convert("RGB")
        w, h = im.size
        step_x = max(1, w // 160)
        step_y = max(1, h // 160)
        px = im.load()
        total = 0
        n = 0
        for y in range(0, h, step_y):
            for x in range(0, w, step_x):
                r, g, b = px[x, y]
                total += (0.2126 * r + 0.7152 * g + 0.0722 * b)
                n += 1
        return float(total / (n * 255.0)) if n else 0.0


def main() -> int:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    idx_path = os.path.join(root, "_tmp", "artifact-index.json")
    with open(idx_path, "r", encoding="utf-8") as f:
        idx = json.load(f)

    items = idx.get("items", [])

    # Map Key -> theme -> rel
    mapping: dict[Key, dict[str, str]] = defaultdict(dict)
    for it in items:
        rel = it.get("rel")
        if not rel:
            continue
        parts = rel.split("/")
        if len(parts) < 4:
            continue
        theme, viewport, bucket, filename = parts[0], parts[1], parts[2], parts[-1]
        if theme not in ("light", "dark"):
            continue
        if viewport not in ("desktop", "mobile"):
            continue
        if bucket not in ("baseline", "interaction"):
            continue
        key = Key(viewport=viewport, bucket=bucket, filename=filename)
        mapping[key][theme] = rel

    pairs = []

    for key, by_theme in mapping.items():
        if "light" not in by_theme or "dark" not in by_theme:
            continue

        rel_light = by_theme["light"]
        rel_dark = by_theme["dark"]
        p_light = os.path.join(root, rel_light.replace("/", os.sep))
        p_dark = os.path.join(root, rel_dark.replace("/", os.sep))
        if not (os.path.exists(p_light) and os.path.exists(p_dark)):
            continue

        with Image.open(p_light) as im_l, Image.open(p_dark) as im_d:
            h_l = dhash(im_l)
            h_d = dhash(im_d)
        dist = hamming(h_l, h_d)
        l_l = mean_luma(p_light)
        l_d = mean_luma(p_dark)
        ldiff = abs(l_l - l_d)

        # Flag if too similar. dHash distance is 0..64.
        # Thresholds tuned to catch "theme didn't apply" cases.
        suspect = (dist <= 6 and ldiff <= 0.08)

        pairs.append(
            {
                "key": {"viewport": key.viewport, "bucket": key.bucket, "filename": key.filename},
                "light": rel_light,
                "dark": rel_dark,
                "dhashDistance": dist,
                "meanLumaLight": round(l_l, 4),
                "meanLumaDark": round(l_d, 4),
                "meanLumaAbsDiff": round(ldiff, 4),
                "suspect": suspect,
            }
        )

    pairs.sort(key=lambda x: (not x["suspect"], x["dhashDistance"], x["meanLumaAbsDiff"], x["key"]["filename"]))

    out_json = os.path.join(root, "_tmp", "theme-compare.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({"pairs": pairs}, f, ensure_ascii=False, indent=2)

    out_md = os.path.join(root, "_tmp", "theme-compare.md")

    def link(rel: str) -> str:
        return f"[{rel}]({rel.replace(' ', '%20')})"

    lines = []
    lines.append("# Theme Compare (Light vs Dark)\n")
    suspects = [p for p in pairs if p["suspect"]]
    lines.append(f"- Pairs compared: {len(pairs)}")
    lines.append(f"- Suspects (too similar): {len(suspects)}\n")

    lines.append("## Suspects\n")
    for p in suspects[:80]:
        k = p["key"]
        lines.append(
            f"- {k['viewport']}/{k['bucket']}/{k['filename']} — dist={p['dhashDistance']} ldiff={p['meanLumaAbsDiff']} :: {link(p['light'])} | {link(p['dark'])}"
        )

    lines.append("\n## All Pairs (sorted)\n")
    for p in pairs[:120]:
        k = p["key"]
        tag = "SUSPECT" if p["suspect"] else "ok"
        lines.append(
            f"- [{tag}] {k['viewport']}/{k['bucket']}/{k['filename']} — dist={p['dhashDistance']} ldiff={p['meanLumaAbsDiff']} :: {link(p['light'])} | {link(p['dark'])}"
        )

    with open(out_md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print("WROTE", out_json)
    print("WROTE", out_md)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

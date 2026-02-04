import json
import os
from dataclasses import dataclass
from collections import defaultdict
from statistics import median

from PIL import Image


def srgb_to_linear(v: float) -> float:
    # v in [0,1]
    if v <= 0.04045:
        return v / 12.92
    return ((v + 0.055) / 1.055) ** 2.4


def rel_luminance(rgb) -> float:
    # rgb 0-255
    r, g, b = [c / 255.0 for c in rgb]
    r_lin = srgb_to_linear(r)
    g_lin = srgb_to_linear(g)
    b_lin = srgb_to_linear(b)
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin


@dataclass
class ImgStats:
    rel: str
    theme: str
    viewport: str
    bucket: str
    width: int
    height: int
    mean_luma: float
    p05_luma: float
    p50_luma: float
    p95_luma: float


def compute_stats(path: str, rel: str, meta: dict) -> ImgStats:
    with Image.open(path) as im:
        im = im.convert("RGB")
        width, height = im.size

        # Sample in a grid to keep it fast but consistent.
        step_x = max(1, width // 160)
        step_y = max(1, height // 160)

        lumas = []
        px = im.load()
        for y in range(0, height, step_y):
            for x in range(0, width, step_x):
                lumas.append(rel_luminance(px[x, y]))

        lumas.sort()
        n = len(lumas)
        def q(p: float) -> float:
            if n == 0:
                return 0.0
            idx = int(round((n - 1) * p))
            return float(lumas[idx])

        mean_luma = float(sum(lumas) / n) if n else 0.0

        return ImgStats(
            rel=rel,
            theme=meta.get("theme"),
            viewport=meta.get("viewport"),
            bucket=meta.get("bucket"),
            width=width,
            height=height,
            mean_luma=mean_luma,
            p05_luma=q(0.05),
            p50_luma=q(0.50),
            p95_luma=q(0.95),
        )


def main() -> int:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    idx_path = os.path.join(root, "_tmp", "artifact-index.json")
    if not os.path.exists(idx_path):
        raise FileNotFoundError(idx_path)

    with open(idx_path, "r", encoding="utf-8") as f:
        idx = json.load(f)

    items = idx.get("items", [])

    stats: list[ImgStats] = []
    for it in items:
        rel = it.get("rel")
        if not rel:
            continue
        abs_path = os.path.join(root, rel.replace("/", os.sep))
        if not os.path.exists(abs_path):
            continue
        stats.append(compute_stats(abs_path, rel, it))

    # Group per run and find outliers relative to that run.
    by_run: dict[tuple[str, str], list[ImgStats]] = defaultdict(list)
    for s in stats:
        by_run[(s.theme, s.viewport)].append(s)

    issues = []

    for (theme, viewport), arr in by_run.items():
        means = [s.mean_luma for s in arr]
        med = median(means) if means else 0.0
        # basic robust spread via median absolute deviation
        mad = median([abs(m - med) for m in means]) if means else 0.0
        # Avoid div by 0: treat as very tight group
        scale = mad if mad > 1e-6 else 1e-6

        for s in arr:
            z = abs(s.mean_luma - med) / scale

            # Theme expectations (heuristic). Dark should be darker on average.
            theme_mismatch = False
            if theme == "dark" and s.mean_luma > 0.62:
                theme_mismatch = True
            if theme == "light" and s.mean_luma < 0.28:
                theme_mismatch = True

            # Outlier inside its own run (very likely a visual inconsistency).
            # z>8 is strong signal with this sampling.
            if z > 8 or theme_mismatch:
                issues.append(
                    {
                        "rel": s.rel,
                        "run": f"{theme}-{viewport}",
                        "bucket": s.bucket,
                        "meanLuma": round(s.mean_luma, 4),
                        "medianRunLuma": round(med, 4),
                        "mad": round(mad, 6),
                        "z": round(z, 2),
                        "reason": "theme_mismatch" if theme_mismatch else "luma_outlier",
                    }
                )

    # Sort by strongest signal
    issues.sort(key=lambda x: (x["reason"], -x["z"], x["rel"]))

    out_json = os.path.join(root, "_tmp", "visual-analysis.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(
            {
                "totalImages": len(stats),
                "runs": sorted({f"{t}-{v}" for (t, v) in by_run.keys()}),
                "issues": issues,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    # Write a quick markdown to review.
    out_md = os.path.join(root, "_tmp", "visual-analysis.md")
    lines = []
    lines.append("# Visual Analysis (Heuristic)\n")
    lines.append(f"- Images analyzed: {len(stats)}")
    lines.append(f"- Flagged issues: {len(issues)}\n")

    # top 50
    lines.append("## Flagged (top)\n")
    for it in issues[:50]:
        rel = it["rel"]
        lines.append(
            f"- [{rel}]({rel.replace(' ', '%20')}) — {it['run']} / {it['bucket']} — meanLuma={it['meanLuma']} ({it['reason']}, z={it['z']})"
        )

    with open(out_md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print("ANALYZED", len(stats))
    print("FLAGGED", len(issues))
    print("WROTE", out_json)
    print("WROTE", out_md)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

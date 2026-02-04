import json
import os
from collections import defaultdict
from math import ceil

from PIL import Image, ImageDraw, ImageFont


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    # Try a Windows font; fallback to default.
    for p in [
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size=size)
            except Exception:
                pass
    return ImageFont.load_default()


def main() -> int:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    idx_path = os.path.join(root, "_tmp", "artifact-index.json")
    with open(idx_path, "r", encoding="utf-8") as f:
        idx = json.load(f)

    items = idx.get("items", [])

    groups: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for it in items:
        rel = it.get("rel")
        if not rel:
            continue
        parts = rel.split("/")
        if len(parts) < 4:
            continue
        theme, viewport, bucket = parts[0], parts[1], parts[2]
        if theme not in ("light", "dark"):
            continue
        if viewport not in ("desktop", "mobile"):
            continue
        if bucket not in ("baseline", "interaction"):
            continue
        groups[(theme, viewport, bucket)].append(rel)

    font = load_font(14)
    title_font = load_font(24)

    out_dir = os.path.join(root, "_tmp", "montages")
    os.makedirs(out_dir, exist_ok=True)

    # Thumb sizes per viewport
    thumb = {
        "desktop": (360, 225),
        "mobile": (200, 360),
    }

    for (theme, viewport, bucket), rels in groups.items():
        rels = sorted(rels)
        t_w, t_h = thumb[viewport]
        cols = 5 if viewport == "desktop" else 6
        rows = ceil(len(rels) / cols)

        pad = 12
        label_h = 22
        header_h = 56

        canvas_w = pad + cols * (t_w + pad)
        canvas_h = header_h + pad + rows * (t_h + label_h + pad)

        bg = (12, 12, 12) if theme == "dark" else (245, 245, 245)
        fg = (240, 240, 240) if theme == "dark" else (20, 20, 20)

        canvas = Image.new("RGB", (canvas_w, canvas_h), bg)
        draw = ImageDraw.Draw(canvas)

        title = f"{theme.upper()} / {viewport.upper()} / {bucket.upper()}  (n={len(rels)})"
        draw.text((pad, 12), title, fill=fg, font=title_font)

        x0 = pad
        y0 = header_h

        for i, rel in enumerate(rels):
            r = i // cols
            c = i % cols
            x = x0 + c * (t_w + pad)
            y = y0 + r * (t_h + label_h + pad)

            abs_path = os.path.join(root, rel.replace("/", os.sep))
            try:
                with Image.open(abs_path) as im:
                    im = im.convert("RGB")
                    im.thumbnail((t_w, t_h), Image.Resampling.LANCZOS)
                    # place centered in thumb box
                    tile = Image.new("RGB", (t_w, t_h), (30, 30, 30) if theme == "dark" else (230, 230, 230))
                    off_x = (t_w - im.size[0]) // 2
                    off_y = (t_h - im.size[1]) // 2
                    tile.paste(im, (off_x, off_y))
                    canvas.paste(tile, (x, y))
            except Exception:
                # draw placeholder
                draw.rectangle([x, y, x + t_w, y + t_h], outline=(200, 0, 0), width=2)

            label = os.path.basename(rel)
            draw.text((x, y + t_h + 2), label, fill=fg, font=font)

        out_path = os.path.join(out_dir, f"{theme}_{viewport}_{bucket}.png")
        canvas.save(out_path)
        print("WROTE", out_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

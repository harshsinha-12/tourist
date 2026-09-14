#!/usr/bin/env python3
"""Build a Tourist favicon from the builder-worker sprite."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
SOURCE = REPO / "assets" / "landmarks" / "sources" / "builder-worker.png"
APP = ROOT / "app"
PREVIEW = ROOT / "public" / "brand"

NAVY = (7, 29, 48, 255)
MINT = (113, 240, 194, 255)
TEAL = (28, 105, 114, 255)


def cutout(path: Path) -> Image.Image:
    src = Image.open(path).convert("RGBA")
    pixels = src.load()
    w, h = src.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            magenta = r > 160 and b > 160 and g < 110 and r + b > 2.4 * (g + 8)
            if magenta:
                pixels[x, y] = (0, 0, 0, 0)
    alpha = src.split()[-1].filter(ImageFilter.MinFilter(3))
    src.putalpha(alpha)
    bbox = src.getbbox()
    if not bbox:
        raise SystemExit("no builder pixels")
    return src.crop(bbox)


def bust(sprite: Image.Image) -> Image.Image:
    w, h = sprite.size
    top = 0
    bottom = int(h * 0.58)
    left = max(0, int(w * 0.02))
    right = min(w, int(w * 0.98))
    return sprite.crop((left, top, right, bottom))


def rounded_badge(size: int) -> Image.Image:
    badge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    inset = max(1, size // 32)
    radius = max(6, size // 5)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=NAVY)
    draw.rounded_rectangle(
        [inset, inset, size - 1 - inset, size - 1 - inset],
        radius=max(4, radius - inset),
        outline=MINT,
        width=max(1, size // 28),
    )
    return badge


def compose(size: int, figure: Image.Image, y_bias: float = 0.04) -> Image.Image:
    badge = rounded_badge(size)
    pad = int(size * 0.08)
    inner = size - pad * 2
    fitted = figure.copy()
    fitted.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = size - pad - fitted.height + int(size * y_bias)
    badge.paste(fitted, (x, y), fitted)
    return badge


def main() -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)
    sprite = cutout(SOURCE)
    figure = bust(sprite)
    w, h = figure.size
    helmet = figure.crop((0, 0, w, int(h * 0.62)))
    master = compose(512, figure)
    icon64 = compose(64, figure)
    icon32 = compose(32, figure)
    icon16 = compose(16, helmet, y_bias=0.08)
    icon64.save(APP / "icon.png", "PNG")
    apple = compose(180, figure)
    apple.convert("RGB").save(APP / "apple-icon.png", "PNG")
    master.save(PREVIEW / "tourist-mark.png", "PNG")
    icon64.save(
        APP / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[icon32, icon16],
    )
    for leftover in ("favicon-preview.png", "favicon-16.png", "favicon-32.png"):
        path = PREVIEW / leftover
        if path.exists():
            path.unlink()
    svg = APP / "icon.svg"
    if svg.exists():
        svg.unlink()
    print("wrote", PREVIEW / "tourist-mark.png")
    print("wrote", APP / "icon.png")
    print("wrote", APP / "favicon.ico")
    print("wrote", APP / "apple-icon.png")


if __name__ == "__main__":
    main()

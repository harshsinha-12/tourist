#!/usr/bin/env python3
"""Build Tourist mark, favicon, and Open Graph stills from generated art."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path("/Users/harshsinha/.cursor/projects/Users-harshsinha-VS-Code-tourist/assets")
PUBLIC = ROOT / "public" / "brand"
APP = ROOT / "app"
FONT_SERIF = Path("/System/Library/Fonts/Supplemental/Georgia Bold.ttf")
FONT_SERIF_ITALIC = Path("/System/Library/Fonts/Supplemental/Georgia Italic.ttf")
FONT_SANS = Path("/System/Library/Fonts/Supplemental/Courier New Bold.ttf")
NAVY = (7, 29, 48, 255)
MINT = (113, 240, 194, 255)
CREAM = (255, 248, 209, 255)
AMBER = (255, 210, 95, 255)
CYAN = (95, 211, 235, 255)


def flood_transparent(im: Image.Image, limit: int = 238) -> Image.Image:
    rgba = im.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    seen = set()
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h:
            continue
        seen.add((x, y))
        r, g, b, a = pixels[x, y]
        if a == 0 or min(r, g, b) < limit:
            continue
        pixels[x, y] = (r, g, b, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return rgba


def crop_alpha(im: Image.Image, pad: int = 12) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(im.width, right + pad)
    bottom = min(im.height, bottom + pad)
    return im.crop((left, top, right, bottom))


def fit_square(im: Image.Image, size: int, background: tuple[int, int, int, int] | None = None) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    fitted = im.copy()
    fitted.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas.paste(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2), fitted)
    return canvas


def tracked_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    tracking: float,
) -> float:
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=font, fill=fill)
        x += font.getlength(char) + tracking
    return x


def make_mark() -> Image.Image:
    return Image.open(PUBLIC / "tourist-mark.png").convert("RGBA")


def make_og(mark: Image.Image) -> Image.Image:
    city = Image.open(ASSETS / "tourist-og-city.png").convert("RGB")
    target = (1200, 630)
    scale = max(target[0] / city.width, target[1] / city.height)
    city = city.resize((round(city.width * scale), round(city.height * scale)), Image.Resampling.LANCZOS)
    left = (city.width - target[0]) // 2
    top = max(0, city.height - target[1] - 20)
    city = city.crop((left, top, left + target[0], top + target[1])).convert("RGBA")

    veil = Image.new("RGBA", target, (0, 0, 0, 0))
    veil_px = veil.load()
    for x in range(target[0]):
        t = x / 980
        alpha = int(max(0, min(1, 1 - t)) ** 1.05 * 236)
        for y in range(target[1]):
            veil_px[x, y] = (*NAVY[:3], alpha)
    city = Image.alpha_composite(city, veil)

    grain = Image.new("RGBA", target, (7, 29, 48, 18))
    city = Image.alpha_composite(city, grain)

    draw = ImageDraw.Draw(city)
    draw.rectangle((0, 0, target[0], 8), fill=CYAN)
    draw.rectangle((0, target[1] - 8, target[0], target[1]), fill=AMBER)

    badge = fit_square(mark, 132)
    city.paste(badge, (72, 168), badge)

    kicker = ImageFont.truetype(str(FONT_SANS), 18)
    title = ImageFont.truetype(str(FONT_SERIF), 72)
    lede = ImageFont.truetype(str(FONT_SERIF_ITALIC), 28)
    foot = ImageFont.truetype(str(FONT_SANS), 16)

    draw.text((228, 176), "CLOUD CODING, DRAWN AS A CITY", font=kicker, fill=MINT)
    tracked_text(draw, (224, 214), "TOURIST", title, CREAM, tracking=6)
    draw.text((228, 310), "A living island for your GitHub repo.", font=lede, fill=(195, 216, 223, 255))
    draw.rectangle((228, 368, 396, 372), fill=AMBER)
    draw.text((228, 392), "PASTE A REPO  ·  WATCH THE CREW BUILD", font=foot, fill=(142, 175, 185, 255))

    return city.convert("RGB")


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    APP.mkdir(parents=True, exist_ok=True)
    mark = make_mark()
    og = make_og(mark)
    og.save(APP / "opengraph-image.png", "PNG", quality=95)
    og.save(APP / "twitter-image.png", "PNG", quality=95)
    (APP / "opengraph-image.alt.txt").write_text(
        "Tourist — an isometric island city for a GitHub repository, with a builder in a hard hat.",
        encoding="utf-8",
    )
    print("wrote", APP / "opengraph-image.png")


if __name__ == "__main__":
    main()

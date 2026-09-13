"""Remove the generated magenta matte and publish landmark sprites as lossless WebP."""

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "assets" / "landmarks" / "sources"
DEST = ROOT / "apps" / "web" / "public" / "assets" / "landmarks"
DEST.mkdir(parents=True, exist_ok=True)


def is_matte(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha == 0 or red > 180 and blue > 180 and green < 100 and min(red, blue) - green > 75


def remove_exterior_matte(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    outside = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        offset = y * width + x
        if not outside[offset] and is_matte(pixels[x, y]):
            outside[offset] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)
    while queue:
        x, y = queue.popleft()
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                enqueue(next_x, next_y)

    for y in range(height):
        for x in range(width):
            if outside[y * width + x] or (is_matte(pixels[x, y]) and pixels[x, y][0] > 210):
                pixels[x, y] = (0, 0, 0, 0)
    return image


def prepare(source: Path) -> None:
    image = remove_exterior_matte(Image.open(source))
    bounds = image.getbbox()
    if bounds is None:
        raise ValueError(f"{source.name}: empty sprite")
    crop = image.crop(bounds)
    scale = min(590 / crop.width, 590 / crop.height)
    crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (640, 640))
    canvas.alpha_composite(crop, ((640 - crop.width) // 2, 615 - crop.height))
    target = DEST / f"{source.stem}.webp"
    canvas.save(target, "WEBP", lossless=True, method=6)
    print(f"{source.name} -> {target.name} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    for source in sorted(SOURCES.glob("*.png")):
        prepare(source)

"""Convert generated environment sprite sheets from magenta matte to alpha.

The source sheets remain untouched. The output keeps the original grid and
dimensions so a later renderer can crop or use them as CSS sprite sheets.
"""

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ENVIRONMENT = ROOT / "assets" / "environment"


def is_matte(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha == 0 or red > 180 and blue > 180 and green < 90 and min(red, blue) - green > 80


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
            if outside[y * width + x]:
                pixels[x, y] = (0, 0, 0, 0)
    return image


def main() -> None:
    for source in sorted(ENVIRONMENT.glob("*-sprite-sheet.png")):
        output = source.with_name(f"{source.stem}-transparent.png")
        remove_exterior_matte(Image.open(source)).save(output, "PNG", optimize=True)
        print(f"{source.name} -> {output.name}")


if __name__ == "__main__":
    main()

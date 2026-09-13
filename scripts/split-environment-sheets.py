"""Publish each generated environment sheet cell as a trimmed sprite."""

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "assets" / "environment"
OUTPUT = ROOT / "apps" / "web" / "public" / "assets" / "environment"
CATALOG = ROOT / "apps" / "web" / "lib" / "environment-assets.json"

SPECS = {
    "nature": (4, 3, ["broadleaf-tree", "conifer", "small-tree", "hedge", "flower-bed", "bench", "rock-cluster", "cliff-edge", "shoreline", "fountain", "water-ripple", "cloud"]),
    "infrastructure": (4, 3, ["road-straight", "road-intersection", "road-corner", "crosswalk", "street-lamp", "compact-car", "delivery-van", "pier", "harbor-crane", "cargo-ship", "speedboat", "construction-sign"]),
    "landmarks": (3, 3, ["main-command", "testing-facility", "data-archive", "research-observatory", "tools-workshop", "review-center", "merge-harbor", "lighthouse", "civic-gazebo"]),
}


def split_sheet(name: str, columns: int, rows: int, ids: list[str]) -> dict[str, dict[str, str | int]]:
    source = Image.open(SHEETS / f"{name}-sprite-sheet-transparent.png").convert("RGBA")
    width, height = source.size
    cell_width, cell_height = width // columns, height // rows
    result: dict[str, dict[str, str | int]] = {}
    for index, asset_id in enumerate(ids):
        column, row = index % columns, index // columns
        cell = source.crop((column * cell_width, row * cell_height, (column + 1) * cell_width, (row + 1) * cell_height))
        bounds = cell.getbbox()
        if not bounds:
            raise ValueError(f"{name}: {asset_id} cell is empty")
        # Keep a small transparent breathing room around every cutout.
        left, top, right, bottom = bounds
        padding = 8
        cell = cell.crop((max(0, left - padding), max(0, top - padding), min(cell_width, right + padding), min(cell_height, bottom + padding)))
        output = OUTPUT / f"{asset_id}.webp"
        cell.save(output, "WEBP", lossless=True, method=6)
        result[asset_id] = {"src": f"/assets/environment/{asset_id}.webp", "sheet": name, "cell": index}
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    assets: dict[str, dict[str, str | int]] = {}
    for name, (columns, rows, ids) in SPECS.items():
        assets.update(split_sheet(name, columns, rows, ids))
    CATALOG.write_text(json.dumps(assets, indent=2) + "\n")
    print(f"Published {len(assets)} environment sprites to {OUTPUT}")


if __name__ == "__main__":
    main()

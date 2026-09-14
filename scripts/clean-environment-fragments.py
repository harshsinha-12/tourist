"""Remove disconnected neighboring-cell fragments, retaining sprite size/anchor.

Run after split-environment-sheets.py. The connected main sprite plus nearby
details are preserved; only islands beyond its padded bounds are cleared.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1] / "apps/web/public/assets/environment"
for name in ("small-tree", "conifer", "bench", "flower-bed", "street-lamp", "fountain", "lighthouse"):
    path = ROOT / f"{name}.webp"
    pixels = np.array(Image.open(path).convert("RGBA"))
    labels, count = ndimage.label(pixels[:, :, 3] > 10, structure=np.ones((3, 3)))
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    largest = int(sizes.argmax())
    ys, xs = np.where(labels == largest)
    removed = 0
    for index, bounds in enumerate(ndimage.find_objects(labels), 1):
        if bounds is None or index == largest:
            continue
        y, x = bounds
        if x.stop < xs.min() - 8 or x.start > xs.max() + 8 or y.stop < ys.min() - 8 or y.start > ys.max() + 8:
            pixels[labels == index] = 0
            removed += 1
    if removed:
        Image.fromarray(pixels).save(path, lossless=True, method=6)
    print(f"{name}: {removed} disconnected fragments removed")

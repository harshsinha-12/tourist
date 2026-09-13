"""Remove the magenta production matte and export normalized transparent sprites.

User authorized programmatic image cleanup. Originals remain under assets/.
Run from repository root: python3 scripts/prepare-building-sprites.py
"""
from pathlib import Path
from collections import deque
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'assets/buildings/sources'
DEST = ROOT / 'apps/web/public/assets/buildings'
WEB_LIB = ROOT / 'apps/web/lib'
DEST.mkdir(parents=True, exist_ok=True)
CATALOG_FIELDS = ('id', 'name', 'example', 'extensions', 'languages', 'category', 'title')


def prepare(source):
    im = Image.open(source).convert('RGBA')
    w, h = im.size
    pixels = im.load()
    # Flood only the exterior matte, preserving disconnected colored details.
    def matte(x, y):
        r, g, b, a = pixels[x, y]
        return a == 0 or (min(r, b) > 145 and g < 125 and min(r, b) - g > 65)
    outside = bytearray(w * h)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if matte(x, y):
                outside[y*w+x] = 1
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not outside[y*w+x] and matte(x, y):
                outside[y*w+x] = 1
                queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0 <= nx < w and 0 <= ny < h and not outside[ny*w+nx] and matte(nx, ny):
                outside[ny*w+nx] = 1
                queue.append((nx, ny))
    removed = sum(outside)
    if removed / (w*h) < .05:
        raise ValueError(f'{source.name}: no usable matte or transparent margin')
    for y in range(h):
        for x in range(w):
            r,g,b,a = pixels[x,y]
            # Also remove enclosed matte holes (railings / between leaves).
            if outside[y*w+x] or (r > 200 and b > 200 and g < 75):
                pixels[x,y] = (0,0,0,0)
            elif min(r,b)-g > 65 and min(r,b) > 145:
                # Remove colored edge spill without eating neutral masonry.
                pixels[x,y] = (min(r,g+35),g,min(b,g+35),a)
    bounds = im.getbbox()
    if not bounds:
        raise ValueError(f'{source.name}: empty sprite')
    crop = im.crop(bounds)
    # Shared visual envelope and baseline; no stretching or perspective changes.
    scale = min(590 / crop.width, 590 / crop.height)
    crop = crop.resize((round(crop.width*scale), round(crop.height*scale)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (640,640))
    canvas.alpha_composite(crop, ((640-crop.width)//2, 615-crop.height))
    target = DEST / f'{source.stem}.webp'
    canvas.save(target, 'WEBP', lossless=True, method=6)
    return {'id': source.stem, 'sourceSize': [w,h], 'bounds': list(bounds), 'bytes': target.stat().st_size,
            'transparentFraction': round(sum(1 for a in canvas.getchannel('A').getdata() if a==0)/(640*640),4)}

def write_if_changed(path, text):
    if path.exists() and path.read_text() == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    return True


def publish_catalog():
    source = json.loads((ROOT / 'assets/buildings/catalog.json').read_text())
    catalog = [{field: entry[field] for field in CATALOG_FIELDS} for entry in source]
    write_if_changed(WEB_LIB / 'building-catalog.json', json.dumps(catalog, indent=2) + '\n')


def publish_available_sprites():
    ids = sorted(path.stem for path in DEST.glob('*.webp'))
    write_if_changed(WEB_LIB / 'available-sprites.json', json.dumps(ids, indent=2) + '\n')
    return ids


def convert_sources(ids=None):
    reports = []
    for source in sorted(SOURCES.glob('*.png')):
        if ids and source.stem not in ids:
            continue
        target = DEST / f'{source.stem}.webp'
        if not ids and target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
            continue
        report = prepare(source)
        reports.append(report)
        print(json.dumps(report), flush=True)
    if reports:
        path = ROOT / 'assets/buildings/asset-report.json'
        previous = json.loads(path.read_text()) if path.exists() else []
        by_id = {entry['id']: entry for entry in previous}
        by_id.update({entry['id']: entry for entry in reports})
        path.write_text(json.dumps(list(by_id.values()), indent=2) + '\n')
    publish_catalog()
    publish_available_sprites()
    return reports


if __name__ == '__main__':
    import argparse
    import time
    parser = argparse.ArgumentParser()
    parser.add_argument('ids', nargs='*')
    parser.add_argument('--watch', action='store_true', help='Keep converting new source PNGs as they appear')
    args = parser.parse_args()
    convert_sources(args.ids or None)
    if args.watch:
        print('Watching', SOURCES, flush=True)
        while True:
            time.sleep(2)
            convert_sources()

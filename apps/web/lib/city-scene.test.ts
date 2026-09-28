import { describe, expect, it } from "vitest";
import {
  clampCamera,
  fitCamera,
  fitScaleFor,
  focusCamera,
  isMapZoomWheel,
  minZoomFor,
  preserveWorldPoint,
  settleCamera,
  zoomAt,
} from "./city-scene";

describe("city camera", () => {
  it("keeps the zoom floor near the fit scale, including a huge island", () => {
    expect(minZoomFor(0.5)).toBeCloseTo(0.325);
    expect(minZoomFor(1)).toBeCloseTo(0.65);
    expect(minZoomFor(0.1)).toBeCloseTo(0.08);
    expect(minZoomFor(0.03)).toBeCloseTo(0.03);
    expect(minZoomFor(0.03)).toBeLessThanOrEqual(0.03);
  });

  it("fits using the viewport padding and never exceeds 1", () => {
    expect(fitScaleFor(1040, 770, 1000, 700)).toBe(1);
    expect(fitScaleFor(540, 420, 1000, 1000)).toBeCloseTo(0.35);
  });

  it("centers an island that fits and keeps a margin when it does not", () => {
    const centered = clampCamera({ x: 10, y: 10, scale: 0.5 }, 800, 600, 400, 200);
    expect(centered.x).toBe((800 - 200) / 2);
    expect(centered.y).toBe((600 - 100) / 2);

    const lost = clampCamera({ x: -5000, y: -5000, scale: 1 }, 800, 600, 2000, 1500);
    expect(lost.x).toBe(800 - 2000 - 80);
    expect(lost.y).toBe(600 - 1500 - 80);

    const shoved = clampCamera({ x: 400, y: 400, scale: 1 }, 800, 600, 2000, 1500);
    expect(shoved.x).toBe(80);
    expect(shoved.y).toBe(80);
  });

  it("preserves the world point under the viewport center when the viewport changes", () => {
    const before = { x: 100, y: 50, scale: 2 };
    const after = preserveWorldPoint(before, { width: 800, height: 600 }, { width: 400, height: 900 });
    const worldX = (800 / 2 - before.x) / before.scale;
    const worldY = (600 / 2 - before.y) / before.scale;
    expect((400 / 2 - after.x) / after.scale).toBeCloseTo(worldX);
    expect((900 / 2 - after.y) / after.scale).toBeCloseTo(worldY);
    expect(after.scale).toBe(2);
  });

  it("zooms around the cursor and honors a caller-supplied floor", () => {
    const next = zoomAt({ x: 0, y: 0, scale: 1 }, { x: 100, y: 50 }, 0.1, 0.4);
    expect(next.scale).toBe(0.4);
    expect(next.x).toBeCloseTo(100 - 100 * 0.4);
    expect(next.y).toBeCloseTo(50 - 50 * 0.4);
  });

  it("raises a microscopic scale back to the floor around the viewport center", () => {
    const settled = settleCamera({ x: 0, y: 0, scale: 0.2 }, 1000, 700, 1000, 700);
    const fitScale = fitScaleFor(1000, 700, 1000, 700);
    expect(settled.scale).toBeCloseTo(minZoomFor(fitScale));
    expect(settled.scale).toBeGreaterThan(0.2);
  });

  it("fits the whole island and focuses a point without dropping below the floor", () => {
    const fitted = fitCamera(1000, 700, 4000, 3000);
    expect(fitted.scale).toBeCloseTo(fitScaleFor(1000, 700, 4000, 3000));
    expect(fitted.scale).toBeGreaterThanOrEqual(minZoomFor(fitted.scale));

    const focused = focusCamera({ x: 2000, y: 1500 }, 1000, 700, 4000, 3000, 0.02);
    expect(focused.scale).toBeGreaterThanOrEqual(minZoomFor(fitScaleFor(1000, 700, 4000, 3000)));
  });

  it("leaves ctrl and meta wheel events for the browser", () => {
    expect(isMapZoomWheel({ ctrlKey: false, metaKey: false })).toBe(true);
    expect(isMapZoomWheel({ ctrlKey: true, metaKey: false })).toBe(false);
    expect(isMapZoomWheel({ ctrlKey: false, metaKey: true })).toBe(false);
  });
});

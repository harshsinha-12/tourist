import { describe, expect, it } from "vitest";
import { visibleInCamera } from "./city-scene";

describe("camera culling", () => {
  const camera = { x: 0, y: 0, scale: 1 };
  const viewport = { width: 800, height: 600 };

  it("keeps a sprite inside the viewport and a margin outside it", () => {
    expect(visibleInCamera({ x: 100, y: 100 }, camera, viewport)).toBe(true);
    expect(visibleInCamera({ x: -20, y: 10 }, camera, viewport, 40)).toBe(true);
    expect(visibleInCamera({ x: -80, y: 10 }, camera, viewport, 40)).toBe(false);
    expect(visibleInCamera({ x: 900, y: 10 }, camera, viewport, 50)).toBe(false);
  });

  it("follows zoom, so a far building can still sit inside a zoomed-out view", () => {
    expect(visibleInCamera({ x: 2000, y: 2000 }, { x: 100, y: 80, scale: 0.2 }, viewport, 0)).toBe(true);
  });
});

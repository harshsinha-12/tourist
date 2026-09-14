import { describe, expect, it } from "vitest";
import { generateCitySnapshot } from "@tourist/world-generator";
import { createCityScene } from "./city-scene";
import { CLOUD_ROUTES, projectedLoopPath, wanderLoop } from "./clouds";

describe("sky clouds", () => {
  it("sends three closed wandering routes around the island", () => {
    expect(CLOUD_ROUTES).toHaveLength(3);
    const snapshot = generateCitySnapshot({
      id: "clouds", repository: { name: "clouds", revision: "test" },
      files: Array.from({ length: 8 }, (_, index) => ({
        path: `src/file-${index}.ts`, language: "TypeScript", kind: "source" as const,
        linesOfCode: 12, changeFrequency: 0, state: "idle" as const,
      })),
    });
    const scene = createCityScene(snapshot);
    const points = wanderLoop(scene.maxX, scene.maxZ, 4, 0.4);
    expect(points.length).toBeGreaterThan(8);
    const path = projectedLoopPath(points, scene.project);
    expect(path.startsWith("M")).toBe(true);
    expect(path).toMatch(/C/);
    expect(path).not.toMatch(/ L/);
    const other = projectedLoopPath(wanderLoop(scene.maxX, scene.maxZ, 4, 1.9), scene.project);
    expect(other).not.toBe(path);
  });
});

import { describe, expect, it } from "vitest";
import { createCityMap } from "./city-map";
import { generateCitySnapshot } from "@tourist/world-generator";
import { advanceCars, carPose, carSpriteSrc, carTransform, createTrafficGraph, seededRandom, spawnCars, spriteFacing } from "./traffic";

function city() {
  return generateCitySnapshot({
    id: "traffic", repository: { name: "traffic", revision: "test" },
    files: Array.from({ length: 16 }, (_, index) => ({
      path: `src/file-${index}.ts`, language: "TypeScript", kind: "source" as const,
      linesOfCode: 20, changeFrequency: 0, state: "idle" as const,
    })),
  });
}

describe("street traffic", () => {
  it("keeps cars on connected junctions and never jumps off the grid", () => {
    const map = createCityMap(city());
    const graph = createTrafficGraph(map.streets, map.junctions);
    expect(graph.nodes.size).toBeGreaterThan(4);
    expect([...graph.nodes.values()].every((node) => node.neighbors.length > 0)).toBe(true);
    const next = seededRandom(0);
    let cars = spawnCars(graph, 6, next);
    expect(cars).toHaveLength(6);
    const edges = new Set<string>();
    for (let step = 0; step < 80; step++) {
      cars = advanceCars(graph, cars, 0.2, next);
      for (const car of cars) edges.add(`${car.from}->${car.to}`);
    }
    expect(edges.size).toBeGreaterThan(cars.length);
    const previous = cars.map((car) => carPose(graph, car));
    for (const car of cars) {
      expect(graph.nodes.has(car.from)).toBe(true);
      expect(graph.nodes.has(car.to)).toBe(true);
      expect(car.progress).toBeGreaterThanOrEqual(0);
      expect(car.progress).toBeLessThan(1);
      const pose = carPose(graph, car);
      expect(Number.isFinite(pose.x + pose.z + pose.heading)).toBe(true);
    }
    cars = advanceCars(graph, cars, 0.05, next);
    cars.forEach((car, index) => {
      const pose = carPose(graph, car);
      expect(Math.hypot(pose.x - previous[index]!.x, pose.z - previous[index]!.z)).toBeLessThan(0.55);
    });
  });

  it("spawns the same cars for the same seed", () => {
    const map = createCityMap(city());
    const graph = createTrafficGraph(map.streets, map.junctions);
    expect(spawnCars(graph, 6, seededRandom(1))).toEqual(spawnCars(graph, 6, seededRandom(1)));
    expect(spawnCars(graph, 6, seededRandom(1))).not.toEqual(spawnCars(graph, 6, seededRandom(2)));
  });

  it("faces cars along their travel direction without rotating the sprite", () => {
    expect(spriteFacing(1, 0)).toBe("se");
    expect(spriteFacing(-1, 0)).toBe("nw");
    expect(spriteFacing(0, 1)).toBe("sw");
    expect(spriteFacing(0, -1)).toBe("ne");
    expect(carSpriteSrc("compact-car", "sw")).toBe("/assets/environment/compact-car.webp");
    expect(carSpriteSrc("compact-car", "ne")).toBe("/assets/environment/compact-car-rear.webp");
    expect(carSpriteSrc("delivery-van", "nw")).toBe("/assets/environment/delivery-van-rear.webp");
    expect(carTransform("se")).toMatch(/scaleX\(-1\)/);
    expect(carTransform("nw")).toMatch(/scaleX\(-1\)/);
    expect(carTransform("sw")).not.toMatch(/rotate|scaleX/);
    expect(carTransform("ne")).not.toMatch(/rotate|scaleX/);
  });

  it("connects street endpoints even without a junction list", () => {
    const graph = createTrafficGraph(
      [[{ x: 0, z: 0 }, { x: 8, z: 0 }], [{ x: 8, z: 0 }, { x: 8, z: 8 }]],
      [],
    );
    expect(graph.nodes.size).toBe(3);
    expect(graph.nodes.get("0.00,0.00")?.neighbors).toEqual(["8.00,0.00"]);
    expect(graph.nodes.get("8.00,0.00")?.neighbors.sort()).toEqual(["0.00,0.00", "8.00,8.00"]);
  });
});

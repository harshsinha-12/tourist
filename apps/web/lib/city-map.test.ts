import { describe, expect, it } from "vitest";
import { generateCitySnapshot } from "@tourist/world-generator";
import { createCityMap, type Street } from "./city-map";

function distance(x: number, z: number, [a, b]: Street) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
}

describe("city placement", () => {
  for (const [count, singleDirectory] of [[0, false], [14, false], [180, false], [1000, false], [1000, true]] as const) it(`keeps streets and gardens clear for ${count} files (${singleDirectory ? "one directory" : "multiple folders"})`, () => {
    const city = generateCitySnapshot({ id: "map", repository: { name: "map", revision: "test" },
      files: Array.from({ length: count }, (_, i) => ({ path: singleDirectory ? `src/file-${i}.ts` : `sector-${i % 3}/dir-${i % 7}/file-${i}.ts`,
        language: "TypeScript", kind: "source" as const, linesOfCode: 50, changeFrequency: 5, state: "idle" as const })),
    });
    const map = createCityMap(city);
    const hall = city.landmarks.find(l => l.kind === "command-center")!;
    expect(map.streets.every(s => distance(hall.position.x, hall.position.z, s) >= 3)).toBe(true);
    for (const building of city.buildings) {
      expect(map.streets.every(s => distance(building.position.x, building.position.z, s) > building.footprint.width / 2 + .3)).toBe(true);
      expect(Math.min(...map.streets.map(s => distance(building.position.x, building.position.z, s)))).toBeLessThanOrEqual(2.21);
    }
    for (const tree of map.trees) {
      expect(map.streets.every(s => distance(tree.x, tree.z, s) >= .72)).toBe(true);
      expect(city.buildings.every(b => Math.abs(tree.x - b.position.x) >= 1.15 || Math.abs(tree.z - b.position.z) >= 1.15)).toBe(true);
    }
    for (const decoration of map.decorations) {
      expect(map.streets.every(s => distance(decoration.x, decoration.z, s) >= .72)).toBe(true);
      expect(city.buildings.every(b => Math.abs(decoration.x - b.position.x) >= 1.15 || Math.abs(decoration.z - b.position.z) >= 1.15)).toBe(true);
    }
    // Every segment is reachable from the waterfront ring through intersections.
    const reached = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const t = map.streets[queue.pop()!]!;
      map.streets.forEach((s, i) => {
        if (reached.has(i)) return;
        const intersects = (v: Street, h: Street) => v[0].x === v[1].x && h[0].z === h[1].z &&
          v[0].x >= Math.min(h[0].x, h[1].x) && v[0].x <= Math.max(h[0].x, h[1].x) &&
          h[0].z >= Math.min(v[0].z, v[1].z) && h[0].z <= Math.max(v[0].z, v[1].z);
        if (
          s.some(p => distance(p.x, p.z, t) < .001) || t.some(p => distance(p.x, p.z, s) < .001)
          || intersects(s, t) || intersects(t, s)
        ) { reached.add(i); queue.push(i); }
      });
    }
    expect(reached.size).toBe(map.streets.length);
    // Verify the actual 144px file-sprite envelopes in isometric screen space.
    const points = city.buildings.map(({ position: p }) => ({ x: (p.x - p.z) * 48, y: (p.x + p.z) * 24 }));
    let overlap = false;
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      if (Math.abs(points[i]!.x - points[j]!.x) < 144 && Math.abs(points[i]!.y - points[j]!.y) < 144) overlap = true;
    }
    expect(overlap).toBe(false);
    const structures = [...city.buildings.map(b => ({ position: b.position, size: 144 })),
      ...city.landmarks.map(l => ({ position: l.position, size: l.kind === "command-center" ? 256 : 220 }))];
    const boxes = structures.map(({ position: p, size }) => ({
      left: (p.x - p.z) * 48 - size / 2, right: (p.x - p.z) * 48 + size / 2,
      top: (p.x + p.z) * 24 - size * .96, bottom: (p.x + p.z) * 24 + size * .04,
    }));
    let structureOverlap = false;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!;
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) structureOverlap = true;
    }
    expect(structureOverlap).toBe(false);
    // Every road has a matching road reflected across either city axis.
    const key = (s: Street) => s.map(p => `${p.x.toFixed(3)},${p.z.toFixed(3)}`).sort().join(":");
    const keys = new Set(map.streets.map(key));
    for (const [a, b] of map.streets) {
      expect(keys.has(key([{ x: city.worldSize.width - a.x, z: a.z }, { x: city.worldSize.width - b.x, z: b.z }]))).toBe(true);
      expect(keys.has(key([{ x: a.x, z: city.worldSize.depth - a.z }, { x: b.x, z: city.worldSize.depth - b.z }]))).toBe(true);
    }
  });
});

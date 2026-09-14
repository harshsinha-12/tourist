import { describe, expect, it } from "vitest";
import type { RepositoryFile } from "@tourist/protocol";
import { generateCitySnapshot } from "../src/index";

const files: RepositoryFile[] = [
  { path: "apps/web/app/page.tsx", language: "TypeScript", kind: "source", linesOfCode: 120, changeFrequency: 4, state: "idle" },
  { path: "apps/web/app/page.test.tsx", language: "TypeScript", kind: "test", linesOfCode: 60, changeFrequency: 1, state: "idle" },
  { path: "packages/protocol/src/index.ts", language: "TypeScript", kind: "source", linesOfCode: 220, changeFrequency: 3, state: "idle" },
];

function generate() {
  return generateCitySnapshot({
    id: "city-test",
    repository: { name: "tourist", revision: "abc123" },
    generatedAt: "2026-09-11T00:00:00.000Z",
    files,
    report: { changedPaths: ["apps/web/app/page.tsx"], includeTests: true, includePullRequest: true },
  });
}

describe("generateCitySnapshot", () => {
  it("is deterministic for the same input", () => {
    expect(generate()).toEqual(generate());
  });

  it("maps folders, files, and report evidence into city entities", () => {
    const city = generate();
    expect(city.sectors.map((sector) => sector.path)).toEqual(["apps", "packages"]);
    expect(city.buildings).toHaveLength(3);
    expect(city.buildings.find((building) => building.path.endsWith("page.tsx"))?.state).toBe("modified");
    expect(city.anchors.map((anchor) => anchor.id)).toEqual([
      "anchor-file-apps-web-app-page-tsx",
      "anchor-tests",
      "anchor-pull-request",
    ]);
  });

  it("does not allocate two buildings to the same plot", () => {
    const city = generate();
    const positions = city.buildings.map(({ position }) => `${position.x}:${position.z}`);
    expect(new Set(positions).size).toBe(positions.length);
  });
});

describe("dense repository layouts", () => {
  it("grows from file count, regardless of how many folders contain those files", () => {
    const make = (count: number, separateFolders: boolean) => generateCitySnapshot({
      id: "growth", repository: { name: "growth", revision: "test" },
      files: Array.from({ length: count }, (_, index) => ({ path: separateFolders ? `folder-${index}/file.ts` : `src/file-${index}.ts`,
        language: "TypeScript", kind: "source", linesOfCode: 10, changeFrequency: 0, state: "idle" })),
    });
    let area = 0;
    for (const count of [0, 14, 277, 1000]) {
      const city = make(count, false);
      expect(city.worldSize).toEqual(make(count, true).worldSize);
      expect(city.buildings).toHaveLength(count);
      expect(city.worldSize.width * city.worldSize.depth).toBeGreaterThanOrEqual(area);
      area = city.worldSize.width * city.worldSize.depth;
      expect(city.layout!.blocks.filter(b => b.use === "files")).toHaveLength(Math.ceil(count / 4));
      expect(city.layout!.columns).toBe(city.layout!.rows);
      for (const building of city.buildings) {
        const blocks = city.layout!.blocks.filter(b => b.use === "files" && building.position.x > b.bounds.x && building.position.x < b.bounds.x + b.bounds.width
          && building.position.z > b.bounds.z && building.position.z < b.bounds.z + b.bounds.depth);
        expect(blocks).toHaveLength(1);
      }
    }
  });
  it("keeps every footprint within its district and plots separate", () => {
    const city = generateCitySnapshot({
      id: "dense", repository: { name: "dense", revision: "test" },
      files: Array.from({ length: 180 }, (_, index) => ({
        path: `src/group-${index % 7}/file-${index}.ts`, language: "TypeScript",
        kind: "source" as const, linesOfCode: 50, changeFrequency: 5, state: "idle" as const,
      })),
    });
    for (const building of city.buildings) {
      const bounds = city.districts.find((district) => district.id === building.districtId)!.bounds;
      expect(building.position.x - building.footprint.width / 2).toBeGreaterThanOrEqual(bounds.x);
      expect(building.position.z - building.footprint.depth / 2).toBeGreaterThanOrEqual(bounds.z);
      expect(building.position.x + building.footprint.width / 2).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(building.position.z + building.footprint.depth / 2).toBeLessThanOrEqual(bounds.z + bounds.depth);
    }
    expect(new Set(city.buildings.map(({ position }) => `${position.x}:${position.z}`)).size).toBe(180);
    expect(city.landmarks.every(({ position }) => position.x >= 0 && position.x <= city.worldSize.width && position.z >= 0 && position.z <= city.worldSize.depth)).toBe(true);
    expect(city.landmarks.find((landmark) => landmark.kind === "command-center")?.position).toMatchObject({ x: city.worldSize.width / 2, z: city.worldSize.depth / 2 });
    const hall = city.landmarks.find(l => l.kind === "command-center")!;
    expect(city.buildings.every(b => Math.abs(b.position.x - hall.position.x) >= 3 || Math.abs(b.position.z - hall.position.z) >= 3)).toBe(true);
  });
});

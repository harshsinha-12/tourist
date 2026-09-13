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
    expect(city.landmarks.filter((landmark) => landmark.kind !== "command-center").every((landmark) => landmark.position.z > city.worldSize.depth)).toBe(true);
    expect(city.landmarks.find((landmark) => landmark.kind === "command-center")?.position).toMatchObject({ x: city.worldSize.width / 2, z: city.worldSize.depth / 2 });
  });
});

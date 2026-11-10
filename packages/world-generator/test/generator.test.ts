import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RepositoryFile } from "@tourist/protocol";
import { countSnapshotFiles, FILES_PER_SETTLEMENT, generateCitySnapshot, inventoryFromPaths, MAX_CITY_STRUCTURES } from "../src/index";

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
    expect(city.buildings).toHaveLength(1);
    expect(city.buildings[0]?.settlement).toBe("hamlet");
    expect(city.buildings[0]?.fileCount).toBe(3);
    expect(city.buildings[0]?.state).toBe("modified");
    expect(city.buildings[0]?.members?.some((member) => member.path === "apps/web/app/page.tsx" && member.state === "modified")).toBe(true);
    expect(city.anchors.map((anchor) => anchor.id)).toEqual([
      "anchor-file-apps-web-app-page-tsx",
      "anchor-tests",
      "anchor-pull-request",
    ]);
  });

  it("keeps large folders apart and folds a tiny sibling into its parent", () => {
    const source = (path: string): RepositoryFile => ({
      path, language: "TypeScript", kind: "source", linesOfCode: 20, changeFrequency: 0, state: "idle",
    });
    const city = generateCitySnapshot({
      id: "split", repository: { name: "split", revision: "test" },
      files: [
        ...Array.from({ length: 8 }, (_, index) => source(`apps/web/file-${index}.ts`)),
        ...Array.from({ length: 8 }, (_, index) => source(`packages/protocol/file-${index}.ts`)),
        source("apps/web/extra/notes.md"),
        source("README.md"),
      ],
    });
    expect(city.sectors.map((sector) => sector.path).sort()).toEqual(["", "apps", "packages"]);
    expect(city.buildings.length).toBeLessThan(18);
    expect(countSnapshotFiles(city.buildings)).toBe(18);
    const readme = city.buildings.find((building) => building.path === "README.md" || building.members?.some((member) => member.path === "README.md"));
    const notes = city.buildings.find((building) => building.members?.some((member) => member.path === "apps/web/extra/notes.md") || building.path === "apps/web/extra/notes.md");
    expect(readme?.fileCount).toBe(1);
    expect(notes?.path.startsWith("apps")).toBe(true);
    expect(notes?.fileCount).toBeGreaterThan(1);
    expect(city.buildings.every((building) => building.fileCount === 1 || building.settlement !== "building")).toBe(true);
  });

  it("collapses this repository into fewer places than files", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const listed = execFileSync("git", ["ls-files", "-z"], { cwd: root }).toString().split("\0").filter(Boolean);
    const indexed = inventoryFromPaths(listed);
    const city = generateCitySnapshot({
      id: "self", repository: { name: "tourist", revision: "test" },
      files: indexed,
    });
    expect(indexed.length).toBeGreaterThan(80);
    expect(city.buildings.length).toBeLessThan(indexed.length);
    expect(city.buildings.length).toBeLessThanOrEqual(MAX_CITY_STRUCTURES);
    expect(countSnapshotFiles(city.buildings)).toBe(indexed.length);
    expect(city.buildings.some((building) => building.fileCount > 1)).toBe(true);
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
      const structures = count === 0 ? 0 : Math.min(MAX_CITY_STRUCTURES, Math.ceil(count / FILES_PER_SETTLEMENT));
      expect(city.worldSize).toEqual(make(count, true).worldSize);
      expect(city.buildings).toHaveLength(structures);
      expect(countSnapshotFiles(city.buildings)).toBe(count);
      expect(city.worldSize.width * city.worldSize.depth).toBeGreaterThanOrEqual(area);
      area = city.worldSize.width * city.worldSize.depth;
      expect(city.layout!.blocks.filter(b => b.use === "files")).toHaveLength(Math.ceil(structures / 4));
      expect(city.layout!.columns % 2).toBe(1);
      expect(city.layout!.rows % 2).toBe(1);
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
    const covered = city.buildings.flatMap((building) => building.members?.map((member) => member.path) ?? [building.path]);
    expect(covered).toHaveLength(180);
    expect(new Set(covered).size).toBe(180);
    expect(city.buildings.length).toBeLessThan(180);
    expect(new Set(city.buildings.map(({ position }) => `${position.x}:${position.z}`)).size).toBe(city.buildings.length);
    expect(city.landmarks.every(({ position }) => position.x >= 0 && position.x <= city.worldSize.width && position.z >= 0 && position.z <= city.worldSize.depth)).toBe(true);
    const hall = city.landmarks.find(l => l.kind === "command-center")!;
    expect(hall.position.x).toBe(city.worldSize.width / 2);
    expect(hall.position.z).toBe(city.worldSize.depth / 2);
    expect(city.buildings.every(b => Math.abs(b.position.x - hall.position.x) >= 3 || Math.abs(b.position.z - hall.position.z) >= 3)).toBe(true);
  });

  it("folds a large folder into villages and keeps a changed file inspectable", () => {
    const city = generateCitySnapshot({
      id: "packed", repository: { name: "packed", revision: "test" },
      files: Array.from({ length: 200 }, (_, index) => ({
        path: `stats/model-${index}.R`, language: "R", kind: "source" as const,
        linesOfCode: 30, changeFrequency: 0, state: "idle" as const,
      })),
      report: { changedPaths: ["stats/model-10.R"], anchorPaths: ["stats/model-10.R"] },
    });
    expect(city.buildings.length).toBeLessThanOrEqual(MAX_CITY_STRUCTURES);
    expect(countSnapshotFiles(city.buildings)).toBe(200);
    expect(city.buildings.every((building) => building.settlement === "village" && building.fileCount === 8)).toBe(true);
    const anchor = city.anchors.find((item) => item.label === "stats/model-10.R");
    expect(anchor?.target.type).toBe("building");
    const buildingId = anchor?.target.type === "building" ? anchor.target.buildingId : "";
    const building = city.buildings.find((item) => item.id === buildingId);
    expect(building?.language).toBe("R");
    expect(building?.color).toBe("#7ea0c4");
    expect(building?.state).toBe("modified");
    expect(building?.members?.some((member) => member.path === "stats/model-10.R" && member.state === "modified")).toBe(true);
  });

  it("spreads leftover parks instead of leaving one empty wing", () => {
    const city = generateCitySnapshot({
      id: "spread", repository: { name: "spread", revision: "test" },
      files: Array.from({ length: 24 }, (_, group) => Array.from({ length: 8 }, (_, index) => ({
        path: `sector-${group % 4}/dir-${group}/file-${index}.ts`, language: "TypeScript", kind: "source" as const,
        linesOfCode: 20, changeFrequency: 0, state: "idle" as const,
      }))).flat(),
    });
    const plots = city.layout!.blocks.filter((block) => block.use === "files");
    const midX = city.worldSize.width / 2, midZ = city.worldSize.depth / 2;
    expect(plots.some((block) => block.bounds.x + block.bounds.width / 2 < midX)).toBe(true);
    expect(plots.some((block) => block.bounds.x + block.bounds.width / 2 > midX)).toBe(true);
    expect(plots.some((block) => block.bounds.z + block.bounds.depth / 2 < midZ)).toBe(true);
    expect(plots.some((block) => block.bounds.z + block.bounds.depth / 2 > midZ)).toBe(true);
  });
});

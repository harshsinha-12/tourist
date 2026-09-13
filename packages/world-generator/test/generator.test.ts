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

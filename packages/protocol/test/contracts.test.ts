import { describe, expect, it } from "vitest";
import { BuildingSchema, CitySnapshotSchema, PublicReportSchema } from "../src/index";

describe("city protocol", () => {
  it("rejects a report with an invalid snapshot", () => {
    const result = PublicReportSchema.safeParse({
      id: "report-1",
      title: "Example",
      summary: "A useful report",
      createdAt: new Date().toISOString(),
      snapshot: {},
      sections: [],
    });

    expect(result.success).toBe(false);
  });

  it("keeps the schema version explicit", () => {
    const result = CitySnapshotSchema.safeParse({ schemaVersion: 99 });
    expect(result.success).toBe(false);
  });

  it("treats a legacy file building as a single structure", () => {
    const building = BuildingSchema.parse({
      id: "building-readme", sectorId: "sector-root", districtId: "district-root",
      path: "README.md", name: "README.md", language: "Markdown", kind: "documentation",
      linesOfCode: 12, state: "idle", position: { x: 1, y: 0, z: 1 },
      footprint: { width: 1.5, depth: 1.5 }, height: 2, color: "#78b7c5",
    });
    expect(building.settlement).toBe("building");
    expect(building.fileCount).toBe(1);
    expect(building.members).toBeUndefined();
  });
});

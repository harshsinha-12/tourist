import { describe, expect, it } from "vitest";
import { CitySnapshotSchema, PublicReportSchema } from "../src/index";

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
});

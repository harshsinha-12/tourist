import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { scanLocalRepository } from "./scan-local-repo";

const root = fileURLToPath(new URL("../../..", import.meta.url));

describe("local repository scan", () => {
  it("puts scripts on the island and leaves generated art off it", async () => {
    const { files } = await scanLocalRepository(root);
    expect(files.some((file) => file.path === "scripts/prepare-building-sprites.py")).toBe(true);
    expect(files.some((file) => file.path === "scripts/verify-city.cjs")).toBe(true);
    expect(files.some((file) => file.path.endsWith(".webp") || file.path.endsWith(".png"))).toBe(false);
    expect(files.some((file) => file.path.startsWith("assets/"))).toBe(false);
    expect(files.length).toBeGreaterThan(14);
  });
});

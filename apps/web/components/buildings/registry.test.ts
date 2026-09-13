import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import availableSprites from "../../lib/available-sprites.json";
import catalog from "../../lib/building-catalog.json";
import { getBuildingArchetype } from "./registry";

vi.mock("./SpriteBuilding", () => ({ SpriteBuilding: () => null }));
vi.mock("./BuildingModel", () => ({ BuildingModel: () => null }));

const sourceDir = join(import.meta.dirname, "../../../../assets/buildings/sources");
const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));

describe("building design resolution", () => {
  it.each([
    ["src/app.tsx", "TypeScript", "tsx"],
    ["src/job.PY", "unknown", "python"],
    ["styles/theme.scss", "unknown", "scss"],
    ["app.mjs", "JavaScript", "javascript"],
    ["settings.yaml", "YAML", "yaml"],
    ["docs/start.mdx", "MDX", "mdx"],
    ["queries/users.sql", "SQL", "sql"],
    ["script", " Python ", "python"],
    ["src/unrecognized.zig", "Zig", "generic"],
    ["LICENSE", "Text", "license"],
    ["main.c", "C", "c"],
    ["vector.hpp", "C++", "header"],
    ["engine.cpp", "C++", "cpp"],
  ])("maps %s to %s's design", (path, language, expected) => {
    expect(getBuildingArchetype({ path, language }).design.id).toBe(expected);
  });

  it("prefers the extension when language metadata conflicts", () => {
    expect(getBuildingArchetype({ path: "app.py", language: "TypeScript" }).design.id).toBe("python");
  });

  it("does not mistake dots in directories for file extensions", () => {
    expect(getBuildingArchetype({ path: "archive.py/README", language: "unknown" }).design.id).toBe("generic");
  });
});

describe("generated building artwork", () => {
  const sourceIds = readdirSync(sourceDir)
    .filter((name) => name.endsWith(".png"))
    .map((name) => name.replace(/\.png$/, ""));

  it("maps every source PNG to catalog extensions", () => {
    expect(sourceIds.length).toBeGreaterThan(0);
    for (const id of sourceIds) {
      const entry = catalogById.get(id);
      expect(entry, `${id}.png needs a catalog entry with file extensions`).toBeDefined();
      expect(entry?.id).toBe(id);
    }
  });

  it("attaches sprites only when the webp is published", () => {
    for (const id of sourceIds) {
      const example = catalogById.get(id)?.example ?? `.${id}`;
      const path = example.startsWith(".") ? example : example;
      const archetype = getBuildingArchetype({ path, language: "unknown" });
      if (availableSprites.includes(id)) {
        expect(archetype.design.id).toBe(id);
        expect(archetype.design.sprite).toBe(`/assets/buildings/${id}.webp`);
      }
    }
    expect(getBuildingArchetype({ path: "README.md", language: "markdown" }).design.id).toBe("markdown");
    expect(getBuildingArchetype({ path: "README.md", language: "markdown" }).design.sprite).toBe("/assets/buildings/markdown.webp");
  });
});

import { describe, expect, it } from "vitest";
import { classifyPath, inventoryFromPaths, shouldIncludePath } from "../src/inventory";

describe("repository inventory", () => {
  it("keeps source, scripts, and docs while dropping media and generated art", () => {
    const files = inventoryFromPaths([
      "scripts/prepare-building-sprites.py",
      "apps/web/components/CityCanvas.tsx",
      "apps/web/lib/city-map.test.ts",
      "README.md",
      "package.json",
      "LICENSE",
      "assets/buildings/sources/python.png",
      "apps/web/public/assets/buildings/typescript.webp",
      "apps/web/public/assets/environment/ocean-tiles.svg",
      "node_modules/next/index.js",
      "apps/web/.next/server.js",
      "Pixel-Art Software Development Island City.png",
      "next-env.d.ts",
    ]);
    expect(files.map((file) => file.path)).toEqual([
      "apps/web/components/CityCanvas.tsx",
      "apps/web/lib/city-map.test.ts",
      "LICENSE",
      "package.json",
      "README.md",
      "scripts/prepare-building-sprites.py",
    ]);
  });

  it("classifies tests, python scripts, and lockfiles", () => {
    expect(shouldIncludePath("scripts/verify-city.cjs")).toBe(true);
    expect(classifyPath("scripts/prepare-building-sprites.py")).toEqual({ language: "Python", kind: "source" });
    expect(classifyPath("apps/web/lib/city-map.test.ts")).toEqual({ language: "TypeScript", kind: "test" });
    expect(classifyPath("pnpm-lock.yaml")).toEqual({ language: "YAML", kind: "config" });
    expect(classifyPath("LICENSE")).toEqual({ language: "Text", kind: "documentation" });
  });
});

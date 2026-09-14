import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRepositoryRoot, repositoryDisplayName, scanLocalRepository } from "./scan-local-repo";

const root = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const web = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");

describe("local repository scan", () => {
  it("puts scripts on the island and leaves generated art off it", async () => {
    const { files } = await scanLocalRepository(root);
    expect(files.some((file) => file.path === "scripts/prepare-building-sprites.py")).toBe(true);
    expect(files.some((file) => file.path === "scripts/verify-city.cjs")).toBe(true);
    expect(files.some((file) => file.path.endsWith(".webp") || file.path.endsWith(".png"))).toBe(false);
    expect(files.some((file) => file.path.startsWith("assets/"))).toBe(false);
    expect(files.length).toBeGreaterThan(14);
  });

  it("walks up from the Next app to the workspace root", async () => {
    expect(await resolveRepositoryRoot(web)).toBe(root);
  });

  it("finds a workspace marker when git is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tourist-root-"));
    try {
      await writeFile(join(dir, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
      await mkdir(join(dir, "apps", "web"), { recursive: true });
      expect(await resolveRepositoryRoot(join(dir, "apps", "web"))).toBe(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("maps source files inside a folder when git is unavailable", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tourist-scan-"));
    try {
      await mkdir(join(dir, "components"));
      await writeFile(join(dir, "package.json"), "{}\n");
      await writeFile(join(dir, "components/CityCanvas.tsx"), "export {}\n");
      await writeFile(join(dir, "readme.md"), "# island\n");
      const { files, name } = await scanLocalRepository(dir);
      expect(name).toBe(dir.split(/[\\/]/).at(-1));
      expect(files.map((file) => file.path).sort()).toEqual([
        "components/CityCanvas.tsx",
        "package.json",
        "readme.md",
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("names the island from package.json instead of a Vercel path0 checkout", async () => {
    expect(await repositoryDisplayName("/vercel/path0")).toBe("repository");
    const dir = await mkdtemp(join(tmpdir(), "tourist-name-"));
    try {
      await writeFile(join(dir, "package.json"), JSON.stringify({ name: "tourist" }));
      expect(await repositoryDisplayName(dir)).toBe("tourist");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prefers the Vercel git slug when naming a path0 checkout", async () => {
    const owner = process.env.VERCEL_GIT_REPO_OWNER;
    const slug = process.env.VERCEL_GIT_REPO_SLUG;
    process.env.VERCEL_GIT_REPO_OWNER = "harshsinha-12";
    process.env.VERCEL_GIT_REPO_SLUG = "tourist";
    try {
      expect(await repositoryDisplayName("/vercel/path0")).toBe("harshsinha-12/tourist");
    } finally {
      if (owner === undefined) delete process.env.VERCEL_GIT_REPO_OWNER;
      else process.env.VERCEL_GIT_REPO_OWNER = owner;
      if (slug === undefined) delete process.env.VERCEL_GIT_REPO_SLUG;
      else process.env.VERCEL_GIT_REPO_SLUG = slug;
    }
  });
});

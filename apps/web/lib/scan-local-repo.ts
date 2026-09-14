import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { promisify } from "node:util";
import { inventoryFromPaths, shouldIncludePath } from "@tourist/world-generator";
import type { BuildingState, RepositoryFile } from "@tourist/protocol";

const execFileAsync = promisify(execFile);
const MAX_BYTES = 2_000_000;
const ROOT_MARKERS = ["pnpm-workspace.yaml", ".git"];

export async function resolveRepositoryRoot(start = process.cwd()): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: start, encoding: "utf8" });
    if (stdout.trim()) return stdout.trim();
  } catch {
    // Serverless hosts often have no git metadata; walk up for a workspace marker instead.
  }
  let current = start;
  const { root } = parse(current);
  while (true) {
    if (ROOT_MARKERS.some((marker) => existsSync(join(current, marker)))) return current;
    const parent = dirname(current);
    if (parent === current || current === root) return start;
    current = parent;
  }
}

export async function scanLocalRepository(root: string): Promise<{
  name: string;
  revision: string;
  files: RepositoryFile[];
  changedPaths: string[];
}> {
  const paths = await listPaths(root);
  const locByPath = new Map<string, number>();
  await Promise.all(paths.filter(shouldIncludePath).map(async (path) => {
    locByPath.set(path, await countLines(join(root, path)));
  }));
  const files = inventoryFromPaths(paths, locByPath);
  const { changedPaths, states } = await gitChanges(root);
  return {
    name: await repositoryDisplayName(root),
    revision: await gitRevision(root),
    files: files.map((file) => ({ ...file, state: states.get(file.path) ?? file.state })),
    changedPaths: changedPaths.filter((path) => files.some((file) => file.path === path)),
  };
}

export async function repositoryDisplayName(root: string): Promise<string> {
  const owner = process.env.VERCEL_GIT_REPO_OWNER?.trim();
  const slug = process.env.VERCEL_GIT_REPO_SLUG?.trim();
  if (owner && slug) return `${owner}/${slug}`;
  if (slug) return slug;
  try {
    const parsed = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { name?: unknown };
    if (typeof parsed.name === "string") {
      const name = parsed.name.trim().replace(/^@[^/]+\//, "");
      if (name) return name;
    }
  } catch {
    // Fall through to the folder name when package.json is missing or invalid.
  }
  const folder = root.split(/[\\/]/).filter(Boolean).at(-1) || "repository";
  return /^path\d+$/i.test(folder) ? "repository" : folder;
}

async function listPaths(root: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: root, encoding: "utf8", maxBuffer: 20_000_000,
    });
    const fromGit = stdout.split("\0").filter(Boolean);
    if (fromGit.length > 0) return fromGit;
  } catch {
    // Fall through to a filesystem walk when git is missing (Vercel serverless).
  }
  return walk(root, root);
}

async function walk(root: string, directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    const relative = absolute.slice(root.length + 1).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if (shouldIncludePath(`${relative}/file`)) paths.push(...await walk(root, absolute));
      continue;
    }
    if (entry.isFile() && shouldIncludePath(relative)) paths.push(relative);
  }
  return paths;
}

async function countLines(absolute: string): Promise<number> {
  try {
    if ((await stat(absolute)).size > MAX_BYTES) return 0;
    const text = await readFile(absolute, "utf8");
    if (text.includes("\0")) return 0;
    return text.length === 0 ? 0 : text.split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

async function gitRevision(root: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
    return stdout.trim() || "working-tree";
  } catch {
    return "working-tree";
  }
}

async function gitChanges(root: string): Promise<{ changedPaths: string[]; states: Map<string, BuildingState> }> {
  const states = new Map<string, BuildingState>();
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain", "-uall"], { cwd: root, encoding: "utf8" });
    for (const line of stdout.split("\n")) {
      if (line.length < 4) continue;
      const code = line.slice(0, 2);
      const path = line.slice(3).split(" -> ").at(-1)?.replaceAll("\\", "/") ?? "";
      const state: BuildingState = code.includes("D") ? "deleted" : code.includes("A") || code === "??" ? "added" : "modified";
      states.set(path, state);
    }
  } catch {
    return { changedPaths: [], states };
  }
  return { changedPaths: [...states.keys()], states };
}

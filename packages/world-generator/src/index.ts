import {
  CITY_SCHEMA_VERSION,
  CitySnapshotSchema,
  type Anchor,
  type Bounds,
  type Building,
  type BuildingState,
  type CitySnapshot,
  type District,
  type FileKind,
  type RepositoryFile,
  type Sector,
} from "@tourist/protocol";

export interface WorldGeneratorInput {
  id: string;
  repository: { name: string; revision: string };
  generatedAt?: string;
  files: RepositoryFile[];
  report?: {
    changedPaths?: string[];
    anchorPaths?: string[];
    includeTests?: boolean;
    includePullRequest?: boolean;
  };
}

import { planCity, FILES_PER_BLOCK } from "./layout";

const languageColors: Record<string, string> = {
  TypeScript: "#45a8ff",
  JavaScript: "#ffd84a",
  Python: "#7ecf6b",
  CSS: "#d783ff",
  JSON: "#f1a35a",
  Markdown: "#78b7c5",
  SQL: "#ff7f73",
};

const sectorColors = ["#123f58", "#254b45", "#4a385c", "#574430", "#27445d", "#3e4f38"];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "") || "root";
}

function topLevel(path: string): string {
  const [first = "root"] = path.split("/");
  return path.includes("/") ? first : "root";
}

function directory(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/") || "root";
}

function fileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function stateFor(path: string, changedPaths: ReadonlySet<string>, fallback: BuildingState): BuildingState {
  return changedPaths.has(path) && fallback === "idle" ? "modified" : fallback;
}

function buildingColor(language: string, kind: FileKind): string {
  if (kind === "test") return "#66ddb3";
  if (kind === "documentation") return "#9ab6c8";
  if (kind === "config") return "#f1aa61";
  return languageColors[language] ?? "#79a6ba";
}

function enclosingBounds(points: Bounds[]): Bounds {
  const x = Math.min(...points.map(p => p.x)), z = Math.min(...points.map(p => p.z));
  return { x, z, width: Math.max(...points.map(p => p.x + p.width)) - x,
    depth: Math.max(...points.map(p => p.z + p.depth)) - z };
}

export function generateCitySnapshot(input: WorldGeneratorInput): CitySnapshot {
  const files = [...input.files].sort((a, b) => a.path.localeCompare(b.path));
  const changedPaths = new Set(input.report?.changedPaths ?? []);
  const { layout, worldSize, landmarks } = planCity(files.length);
  const fileBlocks = layout.blocks.filter(block => block.use === "files");
  const buildings: Building[] = files.map((file, index) => {
    const block = fileBlocks[Math.floor(index / FILES_PER_BLOCK)]!;
    const slot = index % FILES_PER_BLOCK;
    const footprint = 1.45 + Math.min(file.changeFrequency, 5) * 0.05;
    return {
      id: `building-${slug(file.path)}`, sectorId: `sector-${slug(topLevel(file.path))}`,
      districtId: `district-${slug(directory(file.path))}`, path: file.path, name: fileName(file.path),
      language: file.language, kind: file.kind, linesOfCode: file.linesOfCode,
      state: stateFor(file.path, changedPaths, file.state),
      position: { x: block.bounds.x + block.bounds.width * (slot % 2 === 0 ? .25 : .75), y: 0,
        z: block.bounds.z + block.bounds.depth * (slot < 2 ? .25 : .75) },
      footprint: { width: footprint, depth: footprint },
      height: Math.min(6.5, 1.25 + Math.log2(file.linesOfCode + 1) * .62),
      color: buildingColor(file.language, file.kind),
    };
  });
  // Folder entities retain their evidence anchors; physical blocks are independent
  // so a thousand tiny directories do not each require an empty neighborhood.
  const plotBounds = (building: Building): Bounds => ({ x: building.position.x - 1.7,
    z: building.position.z - 1.7, width: 3.4, depth: 3.4 });
  const sectors: Sector[] = [...new Set(files.map(file => topLevel(file.path)))].sort().map((path, index) => ({
    id: `sector-${slug(path)}`, name: path === "root" ? "Repository root" : path,
    path: path === "root" ? "" : path,
    bounds: enclosingBounds(buildings.filter(b => b.sectorId === `sector-${slug(path)}`).map(plotBounds)),
    color: sectorColors[index % sectorColors.length]!,
  }));
  const districts: District[] = [...new Set(files.map(file => directory(file.path)))].sort().map(path => ({
    id: `district-${slug(path)}`, sectorId: `sector-${slug(topLevel(path === "root" ? "root" : `${path}/file`))}`,
    name: path === "root" ? "Root files" : path.split("/").at(-1)!, path: path === "root" ? "" : path,
    bounds: enclosingBounds(buildings.filter(b => b.districtId === `district-${slug(path)}`).map(plotBounds)),
  }));

  const featured = new Set([...(input.report?.changedPaths ?? []), ...(input.report?.anchorPaths ?? [])]);
  const anchors: Anchor[] = buildings
    .filter((building) => featured.has(building.path))
    .map((building) => ({
      id: `anchor-file-${slug(building.path)}`,
      label: building.path,
      target: { type: "building" as const, buildingId: building.id },
    }));

  if (input.report?.includeTests) {
    anchors.push({
      id: "anchor-tests",
      label: "Test results",
      target: { type: "landmark", landmarkId: "landmark-testing-facility" },
    });
  }
  if (input.report?.includePullRequest) {
    anchors.push({
      id: "anchor-pull-request",
      label: "Pull request",
      target: { type: "landmark", landmarkId: "landmark-merge-harbor" },
    });
  }

  return CitySnapshotSchema.parse({
    schemaVersion: CITY_SCHEMA_VERSION,
    id: input.id,
    repository: input.repository,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    worldSize,
    layout,
    sectors,
    districts,
    buildings,
    landmarks,
    agents: [],
    anchors,
  });
}

export { classifyPath, inventoryFromPaths, shouldIncludePath } from "./inventory";

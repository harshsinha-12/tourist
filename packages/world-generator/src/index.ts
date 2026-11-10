import {
  CITY_SCHEMA_VERSION,
  CitySnapshotSchema,
  type Anchor,
  type Bounds,
  type Building,
  type BuildingMember,
  type BuildingState,
  type CitySnapshot,
  type District,
  type FileKind,
  type RepositoryFile,
  type Sector,
  type SettlementKind,
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
import { planSettlements, settlementKind, sharedDirectory } from "./settlements";

const languageColors: Record<string, string> = {
  TypeScript: "#45a8ff",
  JavaScript: "#ffd84a",
  Python: "#7ecf6b",
  R: "#7ea0c4",
  CSS: "#d783ff",
  JSON: "#f1a35a",
  Markdown: "#78b7c5",
  SQL: "#ff7f73",
};

const STATE_RANK: Record<BuildingState, number> = {
  failed: 6, testing: 5, deleted: 4, modified: 3, added: 2, idle: 1,
};

const MEMBER_PREVIEW = 40;

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

function fileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function stateFor(path: string, changedPaths: ReadonlySet<string>, fallback: BuildingState): BuildingState {
  return changedPaths.has(path) && fallback === "idle" ? "modified" : fallback;
}

function memberFor(file: RepositoryFile, changedPaths: ReadonlySet<string>): BuildingMember {
  return {
    path: file.path,
    name: fileName(file.path),
    language: file.language,
    kind: file.kind,
    linesOfCode: file.linesOfCode,
    state: stateFor(file.path, changedPaths, file.state),
  };
}

function previewMembers(members: readonly BuildingMember[], featured: ReadonlySet<string>): BuildingMember[] | undefined {
  if (members.length <= 1) return undefined;
  const pinned = members.filter((member) => featured.has(member.path));
  const rest = members.filter((member) => !featured.has(member.path));
  return [...pinned, ...rest].slice(0, Math.max(MEMBER_PREVIEW, pinned.length));
}

function placeName(directory: string, settlement: SettlementKind, index: number, total: number): string {
  const parts = directory === "root" ? ["Root"] : directory.split("/").filter(Boolean);
  const leaf = parts.at(-1) ?? "Root";
  const generic = new Set(["src", "lib", "app", "test", "tests", "components", "pages"]);
  const place = generic.has(leaf) && parts.length > 1 ? `${parts.at(-2)}/${leaf}` : leaf;
  const label = `${place} ${settlement}`;
  return total > 1 ? `${label} ${index + 1}` : label;
}

function sectorPathFor(directory: string, files: readonly RepositoryFile[]): string {
  if (directory !== "root") return topLevel(directory);
  const tops = new Set(files.map((file) => topLevel(file.path)));
  if (tops.size === 1) return [...tops][0] ?? "root";
  return "root";
}

function dominant<T extends string>(values: readonly T[]): T {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))[0]![0];
}

function winningKey(votes: ReadonlyMap<string, number>): string {
  return [...votes.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "sector-root";
}

export function countSnapshotFiles(buildings: readonly { fileCount?: number }[]): number {
  return buildings.reduce((sum, building) => sum + (building.fileCount ?? 1), 0);
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
  const featured = new Set([...(input.report?.changedPaths ?? []), ...(input.report?.anchorPaths ?? [])]);
  const drafts = planSettlements(files);
  const { layout, worldSize, landmarks } = planCity(drafts.length);
  const fileBlocks = layout.blocks.filter(block => block.use === "files");
  const directoryTotals = new Map<string, number>();
  const directories = drafts.map((draft) => sharedDirectory(draft.files));
  for (const directory of directories) directoryTotals.set(directory, (directoryTotals.get(directory) ?? 0) + 1);
  const directorySeen = new Map<string, number>();
  const containedPaths: string[][] = [];
  const sectorPathById = new Map<string, string>();
  const buildings: Building[] = drafts.map((draft, index) => {
    const block = fileBlocks[Math.floor(index / FILES_PER_BLOCK)]!;
    const slot = index % FILES_PER_BLOCK;
    const members = draft.files.map((file) => memberFor(file, changedPaths));
    const directory = directories[index] ?? "root";
    const seen = directorySeen.get(directory) ?? 0;
    directorySeen.set(directory, seen + 1);
    const linesOfCode = members.reduce((sum, member) => sum + member.linesOfCode, 0);
    const frequency = Math.max(...draft.files.map((file) => file.changeFrequency));
    const footprint = 1.45 + Math.min(frequency, 5) * 0.05;
    const language = dominant(members.map((member) => member.language));
    const kind = dominant(members.map((member) => member.kind)) as FileKind;
    const state = members.reduce<BuildingState>((strongest, member) =>
      STATE_RANK[member.state] > STATE_RANK[strongest] ? member.state : strongest, "idle");
    const settlement = settlementKind(members.length);
    const primary = members[0]!;
    const sectorPath = sectorPathFor(directory, draft.files);
    const sectorId = `sector-${slug(sectorPath)}`;
    sectorPathById.set(sectorId, sectorPath);
    containedPaths.push(members.map((member) => member.path));
    const preview = previewMembers(members, featured);
    return {
      id: members.length === 1 ? `building-${slug(primary.path)}` : `settlement-${slug(directory)}-${slug(primary.path)}`,
      sectorId,
      districtId: `district-${slug(directory)}`,
      path: members.length === 1 ? primary.path : directory,
      name: members.length === 1 ? primary.name : placeName(directory, settlement, seen, directoryTotals.get(directory) ?? 1),
      language, kind, linesOfCode, state, settlement,
      fileCount: members.length,
      ...(preview ? { members: preview } : {}),
      position: { x: block.bounds.x + block.bounds.width * (slot % 2 === 0 ? .25 : .75), y: 0,
        z: block.bounds.z + block.bounds.depth * (slot < 2 ? .25 : .75) },
      footprint: { width: footprint, depth: footprint },
      height: Math.min(6.5, 1.25 + Math.log2(linesOfCode + 1) * .62),
      color: buildingColor(language, kind),
    };
  });
  // One district can hold files from more than one top-level folder after a
  // collapse. Give that district a single sector, then size sectors from the
  // buildings that actually sit in them.
  const sectorVotes = new Map<string, Map<string, number>>();
  for (const building of buildings) {
    const votes = sectorVotes.get(building.districtId) ?? new Map<string, number>();
    votes.set(building.sectorId, (votes.get(building.sectorId) ?? 0) + building.fileCount);
    sectorVotes.set(building.districtId, votes);
  }
  for (const building of buildings) {
    building.sectorId = winningKey(sectorVotes.get(building.districtId) ?? new Map());
  }
  const plotBounds = (building: Building): Bounds => ({ x: building.position.x - 1.7,
    z: building.position.z - 1.7, width: 3.4, depth: 3.4 });
  const sectors: Sector[] = [...new Set(buildings.map((building) => building.sectorId))]
    .sort((left, right) => (sectorPathById.get(left) ?? left).localeCompare(sectorPathById.get(right) ?? right))
    .map((id, index) => {
      const path = sectorPathById.get(id) ?? "root";
      return {
        id, name: path === "root" ? "Repository root" : path,
        path: path === "root" ? "" : path,
        bounds: enclosingBounds(buildings.filter((building) => building.sectorId === id).map(plotBounds)),
        color: sectorColors[index % sectorColors.length]!,
      };
    });
  const districtPaths = [...new Set(directories)].sort();
  const districts: District[] = districtPaths.flatMap((path) => {
    const id = `district-${slug(path)}`;
    const inside = buildings.filter((building) => building.districtId === id);
    if (inside.length === 0) return [];
    return [{
      id,
      sectorId: inside[0]?.sectorId ?? `sector-${slug(path === "root" ? "root" : topLevel(path))}`,
      name: path === "root" ? "Root files" : path.split("/").at(-1)!,
      path: path === "root" ? "" : path,
      bounds: enclosingBounds(inside.map(plotBounds)),
    }];
  });

  const anchors: Anchor[] = [];
  buildings.forEach((building, index) => {
    for (const path of containedPaths[index] ?? []) {
      if (!featured.has(path)) continue;
      anchors.push({
        id: `anchor-file-${slug(path)}`,
        label: path,
        target: { type: "building", buildingId: building.id },
      });
    }
  });

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
export { FILES_PER_SETTLEMENT, MAX_CITY_STRUCTURES, planSettlements, settlementKind } from "./settlements";

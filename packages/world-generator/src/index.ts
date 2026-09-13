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
  type Landmark,
  type LandmarkKind,
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
    includeTests?: boolean;
    includePullRequest?: boolean;
  };
}

const SECTOR_SIZE = 15;
const SECTOR_GAP = 4;
const PLOT_SPACING = 4.2;

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

function boundsForSector(index: number, count: number, size: number): Bounds {
  const columns = Math.ceil(Math.sqrt(count));
  const row = Math.floor(index / columns);
  const column = index % columns;
  return {
    x: column * (size + SECTOR_GAP),
    z: row * (size + SECTOR_GAP),
    width: size,
    depth: size,
  };
}

function groupBy<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    result.set(key, [...(result.get(key) ?? []), item]);
  }
  return result;
}

function createLandmarks(worldWidth: number, worldDepth: number): Landmark[] {
  const definitions: Array<[LandmarkKind, string]> = [
    ["command-center", "Main command"],
    ["testing-facility", "Testing"],
    ["data-archive", "Data archive"],
    ["tool-workshop", "Tool workshop"],
    ["merge-harbor", "Merge harbor"],
    ["review-center", "PR review navy"],
    ["research-lab", "Research observatory"],
  ];

  return definitions.map(([kind, label], index) => ({
    id: `landmark-${kind}`,
    kind,
    label,
    position: kind === "command-center"
      ? { x: worldWidth / 2, y: 0, z: worldDepth / 2 }
      : { x: 2 + index * 4, y: 0, z: worldDepth + 5 },
  }));
}

export function generateCitySnapshot(input: WorldGeneratorInput): CitySnapshot {
  const files = [...input.files].sort((a, b) => a.path.localeCompare(b.path));
  const changedPaths = new Set(input.report?.changedPaths ?? []);
  const filesBySector = groupBy(files, (file) => topLevel(file.path));
  const sectorNames = [...filesBySector.keys()].sort();
  // Reserve square districts large enough for their file grids, including margins.
  // Fixed sector sizes previously let dense directories spill into neighboring plots.
  const sectorSize = Math.max(SECTOR_SIZE, ...[...filesBySector.values()].map((sectorFiles) => {
    const groups = groupBy(sectorFiles, (file) => directory(file.path));
    const districtColumns = Math.ceil(Math.sqrt(groups.size));
    const fileColumns = Math.ceil(Math.sqrt(Math.max(...[...groups.values()].map((group) => group.length))));
    return 2 + districtColumns * (fileColumns * PLOT_SPACING + 2);
  }));
  const sectors: Sector[] = [];
  const districts: District[] = [];
  const buildings: Building[] = [];

  sectorNames.forEach((sectorPath, sectorIndex) => {
    const bounds = boundsForSector(sectorIndex, sectorNames.length, sectorSize);
    const sectorId = `sector-${slug(sectorPath)}`;
    sectors.push({
      id: sectorId,
      name: sectorPath === "root" ? "Repository root" : sectorPath,
      path: sectorPath === "root" ? "" : sectorPath,
      bounds,
      color: sectorColors[sectorIndex % sectorColors.length] ?? "#123f58",
    });

    const districtGroups = groupBy(filesBySector.get(sectorPath) ?? [], (file) => directory(file.path));
    const districtPaths = [...districtGroups.keys()].sort();
    districtPaths.forEach((districtPath, districtIndex) => {
      const districtId = `district-${slug(districtPath)}`;
      const districtColumns = Math.ceil(Math.sqrt(districtPaths.length));
      const districtWidth = (sectorSize - 2) / districtColumns;
      const districtRow = Math.floor(districtIndex / districtColumns);
      const districtColumn = districtIndex % districtColumns;
      const districtBounds = {
        x: bounds.x + 1 + districtColumn * districtWidth,
        z: bounds.z + 1 + districtRow * districtWidth,
        width: Math.max(districtWidth - 0.5, 2.5),
        depth: Math.max(districtWidth - 0.5, 2.5),
      };
      districts.push({
        id: districtId,
        sectorId,
        name: districtPath === "root" ? "Root files" : districtPath.split("/").at(-1) ?? districtPath,
        path: districtPath === "root" ? "" : districtPath,
        bounds: districtBounds,
      });

      const districtFiles = districtGroups.get(districtPath) ?? [];
      const columns = Math.max(1, Math.ceil(Math.sqrt(districtFiles.length)));
      districtFiles.forEach((file, fileIndex) => {
        const row = Math.floor(fileIndex / columns);
        const column = fileIndex % columns;
        const footprint = 1.45 + Math.min(file.changeFrequency, 5) * 0.05;
        buildings.push({
          id: `building-${slug(file.path)}`,
          sectorId,
          districtId,
          path: file.path,
          name: fileName(file.path),
          language: file.language,
          kind: file.kind,
          linesOfCode: file.linesOfCode,
          state: stateFor(file.path, changedPaths, file.state),
          position: {
            x: districtBounds.x + 1.1 + column * PLOT_SPACING,
            y: 0,
            z: districtBounds.z + 1.1 + row * PLOT_SPACING,
          },
          footprint: { width: footprint, depth: footprint },
          height: Math.min(6.5, 1.25 + Math.log2(file.linesOfCode + 1) * 0.62),
          color: buildingColor(file.language, file.kind),
        });
      });
    });
  });

  const columns = Math.ceil(Math.sqrt(Math.max(sectors.length, 1)));
  const rows = Math.ceil(Math.max(sectors.length, 1) / columns);
  const worldSize = {
    width: columns * sectorSize + Math.max(0, columns - 1) * SECTOR_GAP,
    depth: rows * sectorSize + Math.max(0, rows - 1) * SECTOR_GAP,
  };
  const landmarks = createLandmarks(worldSize.width, worldSize.depth);
  const anchors: Anchor[] = buildings
    .filter((building) => changedPaths.has(building.path))
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
    sectors,
    districts,
    buildings,
    landmarks,
    agents: [],
    anchors,
  });
}

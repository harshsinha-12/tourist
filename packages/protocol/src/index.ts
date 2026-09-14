import { z } from "zod";

export const CITY_SCHEMA_VERSION = 1 as const;

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const BoundsSchema = z.object({
  x: z.number(),
  z: z.number(),
  width: z.number().positive(),
  depth: z.number().positive(),
});

export const FileKindSchema = z.enum([
  "source",
  "test",
  "config",
  "documentation",
  "asset",
  "data",
  "other",
]);

export const BuildingStateSchema = z.enum([
  "idle",
  "added",
  "modified",
  "deleted",
  "testing",
  "failed",
]);

export const RepositoryFileSchema = z.object({
  path: z.string().min(1),
  language: z.string().min(1),
  kind: FileKindSchema,
  linesOfCode: z.number().int().nonnegative(),
  changeFrequency: z.number().nonnegative().default(0),
  state: BuildingStateSchema.default("idle"),
});

export const SectorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string(),
  bounds: BoundsSchema,
  color: z.string().regex(/^#[0-9a-f]{6}$/iu),
});

export const DistrictSchema = z.object({
  id: z.string().min(1),
  sectorId: z.string().min(1),
  name: z.string().min(1),
  path: z.string(),
  bounds: BoundsSchema,
});

export const BuildingSchema = z.object({
  id: z.string().min(1),
  sectorId: z.string().min(1),
  districtId: z.string().min(1),
  path: z.string().min(1),
  name: z.string().min(1),
  language: z.string().min(1),
  kind: FileKindSchema,
  linesOfCode: z.number().int().nonnegative(),
  state: BuildingStateSchema,
  position: PointSchema,
  footprint: z.object({ width: z.number().positive(), depth: z.number().positive() }),
  height: z.number().positive(),
  color: z.string().regex(/^#[0-9a-f]{6}$/iu),
});

export const LandmarkKindSchema = z.enum([
  "command-center",
  "testing-facility",
  "data-archive",
  "tool-workshop",
  "research-lab",
  "review-center",
  "merge-harbor",
]);

export const LandmarkSchema = z.object({
  id: z.string().min(1),
  kind: LandmarkKindSchema,
  label: z.string().min(1),
  position: PointSchema,
});

export const AgentPawnSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(["planner", "coder", "researcher", "tester", "reviewer", "tool-builder", "integrator"]),
  status: z.enum(["idle", "moving", "working", "waiting", "failed"]),
  position: PointSchema,
  targetAnchorId: z.string().optional(),
});

export const AnchorTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("building"), buildingId: z.string().min(1) }),
  z.object({ type: z.literal("district"), districtId: z.string().min(1) }),
  z.object({ type: z.literal("landmark"), landmarkId: z.string().min(1) }),
  z.object({ type: z.literal("point"), position: PointSchema }),
]);

export const AnchorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  target: AnchorTargetSchema,
});

// Optional so published v1 reports without a street plan remain readable.
export const CityLayoutSchema = z.object({
  blockSize: z.number().positive(),
  columns: z.number().int().positive(),
  rows: z.number().int().positive(),
  origin: z.object({ x: z.number(), z: z.number() }),
  blocks: z.array(z.object({
    id: z.string(),
    bounds: BoundsSchema,
    use: z.enum(["files", "park", "command-center", "testing-facility", "data-archive", "tool-workshop", "research-lab"]),
  })),
});

export const CitySnapshotSchema = z.object({
  schemaVersion: z.literal(CITY_SCHEMA_VERSION),
  id: z.string().min(1),
  repository: z.object({
    name: z.string().min(1),
    revision: z.string().min(1),
  }),
  generatedAt: z.string().datetime(),
  worldSize: z.object({ width: z.number().positive(), depth: z.number().positive() }),
  layout: CityLayoutSchema.optional(),
  sectors: z.array(SectorSchema),
  districts: z.array(DistrictSchema),
  buildings: z.array(BuildingSchema),
  landmarks: z.array(LandmarkSchema),
  agents: z.array(AgentPawnSchema),
  anchors: z.array(AnchorSchema),
});

export const ReportSectionSchema = z.object({
  id: z.string().min(1),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  status: z.enum(["neutral", "success", "warning", "failure"]),
  anchorId: z.string().min(1),
});

export const PublicReportSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  createdAt: z.string().datetime(),
  snapshot: CitySnapshotSchema,
  sections: z.array(ReportSectionSchema),
});

export type Point = z.infer<typeof PointSchema>;
export type Bounds = z.infer<typeof BoundsSchema>;
export type FileKind = z.infer<typeof FileKindSchema>;
export type BuildingState = z.infer<typeof BuildingStateSchema>;
export type RepositoryFile = z.infer<typeof RepositoryFileSchema>;
export type Sector = z.infer<typeof SectorSchema>;
export type District = z.infer<typeof DistrictSchema>;
export type Building = z.infer<typeof BuildingSchema>;
export type LandmarkKind = z.infer<typeof LandmarkKindSchema>;
export type Landmark = z.infer<typeof LandmarkSchema>;
export type AgentPawn = z.infer<typeof AgentPawnSchema>;
export type Anchor = z.infer<typeof AnchorSchema>;
export type CitySnapshot = z.infer<typeof CitySnapshotSchema>;
export type CityLayout = z.infer<typeof CityLayoutSchema>;
export type ReportSection = z.infer<typeof ReportSectionSchema>;
export type PublicReport = z.infer<typeof PublicReportSchema>;

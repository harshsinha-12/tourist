import type { Bounds, CitySnapshot } from "@tourist/protocol";
import type { EnvironmentAsset } from "../components/EnvironmentSprite";

export interface GroundPoint { x: number; z: number }
export type Street = readonly [GroundPoint, GroundPoint];
export interface Decoration extends GroundPoint { asset: EnvironmentAsset; width: number }
export const ROAD_WIDTH = .82;

export function distanceToStreet(x: number, z: number, [a, b]: Street) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
}

export function createCityMap(snapshot: CitySnapshot) {
  const { width, depth } = snapshot.worldSize;
  const layout = snapshot.layout;
  const center = { x: width / 2, z: depth / 2 };
  const plaza = { x: center.x - 3.4, z: center.z - 3.4, width: 6.8, depth: 6.8 };
  const streets: Street[] = [];
  const junctions: GroundPoint[] = [];
  const blocks = layout?.blocks ?? snapshot.districts.map(d => ({ id: d.id, bounds: d.bounds, use: "files" as const }));
  if (layout) {
    const { origin, blockSize, columns, rows } = layout;
    for (let col = 0; col <= columns; col++) {
      const x = origin.x + col * blockSize;
      streets.push([{ x, z: origin.z }, { x, z: origin.z + rows * blockSize }]);
      for (let row = 0; row <= rows; row++) junctions.push({ x, z: origin.z + row * blockSize });
    }
    for (let row = 0; row <= rows; row++) {
      const z = origin.z + row * blockSize;
      streets.push([{ x: origin.x, z }, { x: origin.x + columns * blockSize, z }]);
    }
  } else {
    // Published v1 reports keep their original positions and boundary streets.
    for (const { bounds: b } of blocks) {
      const x = b.x - .6, z = b.z - .6, right = b.x + b.width + .6, bottom = b.z + b.depth + .6;
      streets.push([{ x, z }, { x: right, z }], [{ x: right, z }, { x: right, z: bottom }],
        [{ x: right, z: bottom }, { x, z: bottom }], [{ x, z: bottom }, { x, z }]);
    }
  }
  const airbase = { x: 2.3, z: depth * .57 };
  const trees: Array<GroundPoint & { size: number; asset: "small-tree" | "conifer" }> = [];
  const decorations: Decoration[] = [];
  const obstacles = [...snapshot.buildings.map(b => ({ ...b.position, clearance: 1.15 })),
    ...snapshot.landmarks.map(l => ({ ...l.position, clearance: l.kind === "command-center" ? 2.5 : 2.15 })),
    { ...airbase, clearance: 2.4 }];
  const available = (x: number, z: number) => streets.every(s => distanceToStreet(x, z, s) > .72)
    && obstacles.every(p => Math.abs(p.x - x) >= p.clearance || Math.abs(p.z - z) >= p.clearance);
  const plant = (x: number, z: number, size = .55, asset: "small-tree" | "conifer" = "small-tree") => {
    if (available(x, z)) trees.push({ x, z, size, asset });
  };
  for (const block of blocks) {
    const b = block.bounds, inset = 1;
    for (const t of [.12, .5, .88]) {
      plant(b.x + b.width * t, b.z + inset);
      plant(b.x + b.width * t, b.z + b.depth - inset);
      if (t === .5) {
        plant(b.x + inset, b.z + b.depth * t);
        plant(b.x + b.width - inset, b.z + b.depth * t);
      }
    }
    if (block.use === "park") {
      decorations.push({ x: b.x + b.width / 2, z: b.z + b.depth / 2, asset: "fountain", width: 100 });
      plant(b.x + 2.2, b.z + 2.2, .75, "conifer");
      plant(b.x + b.width - 2.2, b.z + b.depth - 2.2, .75, "conifer");
    }
    for (const [dx, dz, asset] of [[.5, .25, "bench"], [.25, .5, "flower-bed"], [.75, .5, "street-lamp"]] as const) {
      const x = b.x + b.width * dx, z = b.z + b.depth * dz;
      if (available(x, z) && trees.every(t => Math.hypot(t.x - x, t.z - z) > .65)) decorations.push({ x, z, asset, width: asset === "street-lamp" ? 30 : 46 });
    }
  }
  for (let offset = 2; offset < width - 1; offset += 2.8) {
    plant(offset, 2, .85, "conifer"); plant(offset, depth - 2, .65);
    plant(2, offset, .65); plant(width - 2, offset, .65);
  }
  decorations.push({ x: width - 1.3, z: depth - 1.3, asset: "lighthouse", width: 130 });
  // Ground-space polygons give both isometric axes identical road widths.
  const roadBounds = ([a, b]: Street, roadWidth = ROAD_WIDTH): Bounds => ({
    x: Math.min(a.x, b.x) - roadWidth / 2, z: Math.min(a.z, b.z) - roadWidth / 2,
    width: Math.abs(b.x - a.x) + roadWidth, depth: Math.abs(b.z - a.z) + roadWidth,
  });
  return { streets, junctions, blocks, plaza, airbase, trees, decorations, roadBounds };
}

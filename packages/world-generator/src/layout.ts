import type { CityLayout, Landmark, LandmarkKind } from "@tourist/protocol";

export const BLOCK_SIZE = 8.4;
export const FILES_PER_BLOCK = 4;
const COAST_MARGIN = 5;

export function planCity(fileCount: number) {
  const fileBlocksNeeded = Math.ceil(fileCount / FILES_PER_BLOCK);
  const required = fileBlocksNeeded + 5;
  const side = Math.max(3, Math.ceil(Math.sqrt(required)));
  const center = Math.floor(side / 2);
  const reserved = new Map<string, CityLayout["blocks"][number]["use"]>([
    [`${center},${center}`, "command-center"],
    ["0,0", "research-lab"], [`${side - 1},0`, "testing-facility"],
    [`0,${side - 1}`, "tool-workshop"], [`${side - 1},${side - 1}`, "data-archive"],
  ]);
  const open: Array<{ col: number; row: number }> = [];
  for (let row = 0; row < side; row++) for (let col = 0; col < side; col++) {
    if (!reserved.has(`${col},${row}`)) open.push({ col, row });
  }
  const parkCount = Math.max(0, open.length - fileBlocksNeeded);
  const parks = new Set<string>();
  for (let index = 0; index < open.length; index++) {
    if (Math.floor((index + 1) * parkCount / open.length) > Math.floor(index * parkCount / open.length)) {
      const cell = open[index]!;
      parks.add(`${cell.col},${cell.row}`);
    }
  }
  const blocks: CityLayout["blocks"] = [];
  for (let row = 0; row < side; row++) for (let col = 0; col < side; col++) {
    const use = reserved.get(`${col},${row}`) ?? (parks.has(`${col},${row}`) ? "park" : "files");
    blocks.push({ id: `block-${col}-${row}`, use,
      bounds: { x: COAST_MARGIN + col * BLOCK_SIZE, z: COAST_MARGIN + row * BLOCK_SIZE, width: BLOCK_SIZE, depth: BLOCK_SIZE } });
  }
  const layout: CityLayout = { blockSize: BLOCK_SIZE, columns: side, rows: side,
    origin: { x: COAST_MARGIN, z: COAST_MARGIN }, blocks };
  const worldSize = { width: side * BLOCK_SIZE + COAST_MARGIN * 2, depth: side * BLOCK_SIZE + COAST_MARGIN * 2 };
  const labels: Partial<Record<LandmarkKind, string>> = { "command-center": "Town hall", "research-lab": "Research observatory",
    "testing-facility": "Testing", "tool-workshop": "Tool workshop", "data-archive": "Data archive" };
  const landmarks: Landmark[] = blocks.filter(b => b.use !== "files" && b.use !== "park").map(b => ({
    id: `landmark-${b.use}`, kind: b.use as LandmarkKind, label: labels[b.use as LandmarkKind]!,
    position: { x: b.bounds.x + BLOCK_SIZE / 2, y: 0, z: b.bounds.z + BLOCK_SIZE / 2 },
  }));
  landmarks.push(
    { id: "landmark-merge-harbor", kind: "merge-harbor", label: "Skill harbor", position: { x: worldSize.width * .64, y: 0, z: worldSize.depth - .6 } },
    { id: "landmark-review-center", kind: "review-center", label: "PR review navy", position: { x: worldSize.width - .6, y: 0, z: worldSize.depth * .64 } },
  );
  return { layout, worldSize, landmarks };
}

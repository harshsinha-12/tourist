import { createTrafficGraph, nodeId, spriteFacing, carTransform, type TrafficGraph } from "./traffic";
import type { GroundPoint, Street } from "./city-map";

export type ShipAsset = "cargo-ship" | "speedboat";

export interface Ship {
  id: number;
  asset: ShipAsset;
  from: string;
  to: string;
  progress: number;
  speed: number;
  dwell: number;
}

export interface ShippingLane {
  graph: TrafficGraph;
  berths: Map<string, "harbor" | "navy">;
}

export { spriteFacing, carTransform as shipTransform };

export function createShippingLane(
  maxX: number,
  maxZ: number,
  docks: { harbor?: GroundPoint | undefined; navy?: GroundPoint | undefined },
  margin: number,
  berthMargin: number,
): ShippingLane {
  const left = -margin, right = maxX + margin, north = -margin, south = maxZ + margin;
  const corners: GroundPoint[] = [
    { x: left, z: south }, { x: right, z: south }, { x: right, z: north }, { x: left, z: north },
  ];
  const streets: Street[] = [
    [corners[0]!, corners[1]!],
    [corners[1]!, corners[2]!],
    [corners[2]!, corners[3]!],
    [corners[3]!, corners[0]!],
  ];
  const junctions = [...corners];
  const berths = new Map<string, "harbor" | "navy">();
  const addBerth = (along: GroundPoint, berth: GroundPoint, kind: "harbor" | "navy") => {
    junctions.push(along, berth);
    streets.push([along, berth]);
    berths.set(nodeId(berth.x, berth.z), kind);
  };
  if (docks.harbor) {
    const x = Math.min(right - 0.8, Math.max(left + 0.8, docks.harbor.x));
    addBerth({ x, z: south }, { x, z: maxZ + berthMargin }, "harbor");
  }
  if (docks.navy) {
    const z = Math.min(south - 0.8, Math.max(north + 0.8, docks.navy.z));
    addBerth({ x: right, z }, { x: maxX + berthMargin, z }, "navy");
  }
  return { graph: createTrafficGraph(streets, junctions), berths };
}

export function spawnShips(lane: ShippingLane, specs: Array<{ asset: ShipAsset; speed: number }>, random = Math.random): Ship[] {
  const edges = [...lane.graph.nodes.values()].flatMap((node) => node.neighbors.map((to) => ({ from: node.id, to })));
  if (edges.length === 0) return [];
  return specs.map((spec, id) => {
    const ring = edges.filter((edge) => !lane.berths.has(edge.from) && !lane.berths.has(edge.to));
    const pool = ring.length > 0 ? ring : edges;
    const edge = pool[Math.floor(random() * pool.length)]!;
    const reverse = id % 2 === 1;
    return {
      id,
      asset: spec.asset,
      from: reverse ? edge.to : edge.from,
      to: reverse ? edge.from : edge.to,
      progress: random(),
      speed: spec.speed,
      dwell: 0,
    };
  });
}

export function advanceShips(lane: ShippingLane, ships: readonly Ship[], dt: number, random = Math.random): Ship[] {
  return ships.map((ship) => {
    if (ship.dwell > 0) return { ...ship, dwell: Math.max(0, ship.dwell - dt) };
    const start = lane.graph.nodes.get(ship.from);
    const end = lane.graph.nodes.get(ship.to);
    if (!start || !end) return ship;
    let arrived = end;
    let length = Math.hypot(end.x - start.x, end.z - start.z) || 1;
    let progress = ship.progress + (ship.speed * dt) / length;
    let current = ship;
    while (progress >= 1) {
      const leftover = (progress - 1) * length;
      const docked = lane.berths.get(current.to);
      const nextId = pickCourse(lane, current.to, current.from, current.asset, random);
      const next = lane.graph.nodes.get(nextId);
      if (!next) break;
      length = Math.hypot(next.x - arrived.x, next.z - arrived.z) || 1;
      current = {
        ...current,
        from: current.to,
        to: nextId,
        progress: leftover / length,
        dwell: docked && shouldDock(current.asset, docked, random) ? 6 + random() * 5 : 0,
      };
      progress = current.progress;
      arrived = next;
      if (current.dwell > 0) {
        progress = 0;
        break;
      }
    }
    return { ...current, progress: Math.min(progress, 0.999) };
  });
}

export function shipPose(lane: ShippingLane, ship: Ship): { x: number; z: number; dx: number; dz: number } {
  const from = lane.graph.nodes.get(ship.from);
  const to = lane.graph.nodes.get(ship.to);
  if (!from || !to) return { x: 0, z: 0, dx: 0, dz: 0 };
  let dx = to.x - from.x, dz = to.z - from.z;
  if (ship.dwell > 0) {
    dx = -dx;
    dz = -dz;
  }
  const length = Math.hypot(to.x - from.x, to.z - from.z) || 1;
  return {
    x: from.x + (to.x - from.x) * ship.progress,
    z: from.z + (to.z - from.z) * ship.progress,
    dx,
    dz,
  };
}

export function shipSpriteSrc(asset: ShipAsset, facing: ReturnType<typeof spriteFacing>): string {
  const rear = facing === "ne" || facing === "nw";
  return `/assets/environment/${asset}${rear ? "-rear" : ""}.webp`;
}

function shouldDock(asset: ShipAsset, kind: "harbor" | "navy", random: () => number): boolean {
  const prefer = asset === "cargo-ship" ? "harbor" : "navy";
  return random() < (kind === prefer ? 0.7 : 0.28);
}

function pickCourse(lane: ShippingLane, atId: string, fromId: string, asset: ShipAsset, random: () => number): string {
  const node = lane.graph.nodes.get(atId);
  if (!node || node.neighbors.length === 0) return fromId;
  const options = node.neighbors.filter((id) => id !== fromId);
  const choices = options.length > 0 ? options : node.neighbors;
  const dock = choices.find((id) => lane.berths.has(id));
  if (dock && random() < (asset === "cargo-ship" ? 0.4 : 0.32)) return dock;
  const from = lane.graph.nodes.get(fromId);
  const incoming = from ? { x: node.x - from.x, z: node.z - from.z } : { x: 0, z: 0 };
  const straight = choices.find((id) => {
    const next = lane.graph.nodes.get(id);
    if (!next || lane.berths.has(id)) return false;
    return incoming.x * (next.x - node.x) + incoming.z * (next.z - node.z) > 0.01;
  });
  if (straight && random() < 0.7) return straight;
  const ring = choices.filter((id) => !lane.berths.has(id));
  const pool = ring.length > 0 ? ring : choices;
  return pool[Math.floor(random() * pool.length)]!;
}

import { distanceToStreet, type GroundPoint, type Street } from "./city-map";

export interface TrafficNode {
  id: string;
  x: number;
  z: number;
  neighbors: string[];
}

export interface TrafficGraph {
  nodes: Map<string, TrafficNode>;
}

export interface Car {
  id: number;
  asset: "compact-car" | "delivery-van";
  from: string;
  to: string;
  progress: number;
  speed: number;
  heading: number;
}

const ON_STREET = 0.08;

export function seededRandom(seed: number): () => number {
  let state = ((seed % 233280) + 233280) % 233280;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

export function nodeId(x: number, z: number): string {
  return `${x.toFixed(2)},${z.toFixed(2)}`;
}

export function createTrafficGraph(streets: readonly Street[], junctions: readonly GroundPoint[]): TrafficGraph {
  const nodes = new Map<string, TrafficNode>();
  const intern = (point: GroundPoint) => {
    const id = nodeId(point.x, point.z);
    const existing = nodes.get(id);
    if (existing) return existing;
    const node = { id, x: point.x, z: point.z, neighbors: [] as string[] };
    nodes.set(id, node);
    return node;
  };
  for (const junction of junctions) intern(junction);
  for (const street of streets) {
    intern(street[0]);
    intern(street[1]);
    const along = [...nodes.values()]
      .filter((node) => distanceToStreet(node.x, node.z, street) < ON_STREET)
      .sort((left, right) => (left.x + left.z) - (right.x + right.z) || left.x - right.x);
    for (let index = 1; index < along.length; index++) {
      const previous = along[index - 1]!;
      const next = along[index]!;
      if (previous.id === next.id) continue;
      if (!previous.neighbors.includes(next.id)) previous.neighbors.push(next.id);
      if (!next.neighbors.includes(previous.id)) next.neighbors.push(previous.id);
    }
  }
  return { nodes };
}

export function spawnCars(graph: TrafficGraph, count: number, random = Math.random): Car[] {
  const edges = [...graph.nodes.values()].flatMap((node) => node.neighbors.map((to) => ({ from: node.id, to })));
  if (edges.length === 0) return [];
  return Array.from({ length: Math.min(count, edges.length) }, (_, id) => {
    const edge = edges[Math.floor(random() * edges.length)]!;
    const heading = headingBetween(graph, edge.from, edge.to);
    return {
      id,
      asset: id % 4 === 1 ? "delivery-van" : "compact-car",
      from: edge.from,
      to: edge.to,
      progress: random(),
      speed: 1.7 + random() * 1.4,
      heading,
    };
  });
}

export function advanceCars(graph: TrafficGraph, cars: readonly Car[], dt: number, random = Math.random): Car[] {
  return cars.map((car) => {
    const start = graph.nodes.get(car.from);
    const end = graph.nodes.get(car.to);
    if (!start || !end) return car;
    let arrived = end;
    let length = Math.hypot(end.x - start.x, end.z - start.z) || 1;
    let progress = car.progress + (car.speed * dt) / length;
    let current = car;
    while (progress >= 1) {
      const leftover = (progress - 1) * length;
      const nextId = pickTurn(graph, current.to, current.from, random);
      const next = graph.nodes.get(nextId);
      if (!next) break;
      length = Math.hypot(next.x - arrived.x, next.z - arrived.z) || 1;
      current = {
        ...current,
        from: current.to,
        to: nextId,
        heading: headingBetween(graph, current.to, nextId),
        progress: leftover / length,
      };
      progress = current.progress;
      arrived = next;
    }
    return { ...current, progress: Math.min(progress, 0.999) };
  });
}

export function carPose(graph: TrafficGraph, car: Car): { x: number; z: number; heading: number; dx: number; dz: number } {
  const from = graph.nodes.get(car.from);
  const to = graph.nodes.get(car.to);
  if (!from || !to) return { x: 0, z: 0, heading: car.heading, dx: 0, dz: 0 };
  const dx = to.x - from.x, dz = to.z - from.z;
  const length = Math.hypot(dx, dz) || 1;
  const rightX = dz / length, rightZ = -dx / length;
  const lane = 0.14;
  return {
    x: from.x + dx * car.progress + rightX * lane,
    z: from.z + dz * car.progress + rightZ * lane,
    heading: car.heading,
    dx,
    dz,
  };
}

export function screenHeading(worldDx: number, worldDz: number): number {
  return Math.atan2(worldDx + worldDz, worldDx - worldDz) * (180 / Math.PI);
}

export type SpriteFacing = "sw" | "se" | "ne" | "nw";

export function spriteFacing(dx: number, dz: number): SpriteFacing {
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? "se" : "nw";
  return dz >= 0 ? "sw" : "ne";
}

export function carSpriteSrc(asset: Car["asset"], facing: SpriteFacing): string {
  const rear = facing === "ne" || facing === "nw";
  return `/assets/environment/${asset}${rear ? "-rear" : ""}.webp`;
}

export function carTransform(facing: SpriteFacing): string {
  const origin = "translate(-50%, -78%)";
  return facing === "se" || facing === "nw" ? `${origin} scaleX(-1)` : origin;
}

function headingBetween(graph: TrafficGraph, fromId: string, toId: string): number {
  const from = graph.nodes.get(fromId);
  const to = graph.nodes.get(toId);
  if (!from || !to) return 0;
  return screenHeading(to.x - from.x, to.z - from.z);
}

function pickTurn(graph: TrafficGraph, atId: string, fromId: string, random: () => number): string {
  const node = graph.nodes.get(atId);
  if (!node || node.neighbors.length === 0) return fromId;
  const options = node.neighbors.filter((id) => id !== fromId);
  const choices = options.length > 0 ? options : node.neighbors;
  const from = graph.nodes.get(fromId);
  const at = node;
  const incoming = from ? { x: at.x - from.x, z: at.z - from.z } : { x: 0, z: 0 };
  const straight = choices.find((id) => {
    const next = graph.nodes.get(id);
    if (!next) return false;
    return incoming.x * (next.x - at.x) + incoming.z * (next.z - at.z) > 0.01;
  });
  if (straight && random() < 0.45) return straight;
  return choices[Math.floor(random() * choices.length)]!;
}

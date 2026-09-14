import type { GroundPoint } from "./city-map";

export interface CloudRoute {
  width: number;
  duration: string;
  delay: string;
  reverse: boolean;
  opacity: number;
  margin: number;
  seed: number;
  bob: string;
}

export const CLOUD_ROUTES: readonly CloudRoute[] = [
  { width: 158, duration: "190s", delay: "-40s", reverse: false, opacity: 0.72, margin: 6.4, seed: 0.4, bob: "18s" },
  { width: 124, duration: "160s", delay: "-75s", reverse: true, opacity: 0.64, margin: 1.6, seed: 1.9, bob: "22s" },
  { width: 98, duration: "230s", delay: "-110s", reverse: false, opacity: 0.58, margin: -1.8, seed: 3.3, bob: "15s" },
];

export function wanderLoop(maxX: number, maxZ: number, margin: number, seed: number, count = 16): GroundPoint[] {
  const cx = maxX / 2, cz = maxZ / 2;
  const rx = Math.max(8, maxX / 2 + margin);
  const rz = Math.max(8, maxZ / 2 + margin);
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const wobble = 1
      + 0.24 * Math.sin(angle * 2 + seed)
      + 0.16 * Math.sin(angle * 3 - seed * 1.7)
      + 0.09 * Math.cos(angle * 5 + seed * 0.6);
    return { x: cx + Math.cos(angle) * rx * wobble, z: cz + Math.sin(angle) * rz * wobble };
  });
}

export function projectedLoopPath(
  points: readonly GroundPoint[],
  project: (x: number, z: number) => { x: number; y: number },
): string {
  const screen = points.map((point) => project(point.x, point.z));
  if (screen.length < 3) return "";
  const count = screen.length;
  const at = (index: number) => screen[(index + count) % count]!;
  const fmt = (value: number) => value.toFixed(2);
  const curves = screen.map((_, index) => {
    const previous = at(index - 1), current = at(index), next = at(index + 1), after = at(index + 2);
    const c1x = current.x + (next.x - previous.x) / 6;
    const c1y = current.y + (next.y - previous.y) / 6;
    const c2x = next.x - (after.x - current.x) / 6;
    const c2y = next.y - (after.y - current.y) / 6;
    return `C ${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(next.x)} ${fmt(next.y)}`;
  });
  return `M ${fmt(screen[0]!.x)} ${fmt(screen[0]!.y)} ${curves.join(" ")}`;
}

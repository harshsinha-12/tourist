import type { Bounds, CitySnapshot } from "@tourist/protocol";

export interface MapPoint { x: number; y: number; }
export interface Camera { x: number; y: number; scale: number; }
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 2;

export function zoomAt(camera: Camera, point: MapPoint, requestedScale: number): Camera {
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requestedScale));
  const ratio = scale / camera.scale;
  return { x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio, scale };
}

export function createCityScene(snapshot: CitySnapshot) {
  const maxZ = Math.max(snapshot.worldSize.depth, ...snapshot.landmarks.map((item) => item.position.z));
  const maxX = Math.max(snapshot.worldSize.width, ...snapshot.landmarks.map((item) => item.position.x));
  const project = (x: number, z: number): MapPoint => ({ x: (x-z+maxZ)*48+180, y: (x+z)*24+210 });
  const width = (maxX+maxZ)*48+360;
  const height = (maxX+maxZ)*24+430;
  const polygon = (bounds: Bounds, offsetY = 0) => [
    [bounds.x, bounds.z], [bounds.x+bounds.width, bounds.z],
    [bounds.x+bounds.width, bounds.z+bounds.depth], [bounds.x, bounds.z+bounds.depth],
  ].map(([x,z]) => { const point=project(x!,z!); return `${point.x},${point.y+offsetY}`; }).join(" ");
  const targets = new Map<string, MapPoint>();
  for (const building of snapshot.buildings) targets.set(building.id, project(building.position.x, building.position.z));
  for (const landmark of snapshot.landmarks) targets.set(landmark.id, project(landmark.position.x, landmark.position.z));
  for (const district of snapshot.districts) targets.set(district.id, project(district.bounds.x+district.bounds.width/2, district.bounds.z+district.bounds.depth/2));
  return { maxX, maxZ, width, height, project, polygon, targets };
}

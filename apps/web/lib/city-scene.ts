import type { Bounds, CitySnapshot } from "@tourist/protocol";

export interface MapPoint { x: number; y: number; }
export interface Camera { x: number; y: number; scale: number; }
export interface ViewportSize { width: number; height: number; }
export const MIN_ZOOM = 0.025;
export const MAX_ZOOM = 2;
const FIT_PADDING_X = 40;
const FIT_PADDING_Y = 70;
const CAMERA_PADDING = 80;

export function isMapZoomWheel(event: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return !event.ctrlKey && !event.metaKey;
}

/** Scale that fits the whole island in the viewport, capped at 1. */
export function fitScaleFor(viewportWidth: number, viewportHeight: number, sceneWidth: number, sceneHeight: number): number {
  if (viewportWidth <= 0 || viewportHeight <= 0 || sceneWidth <= 0 || sceneHeight <= 0) return MIN_ZOOM;
  const raw = Math.min((viewportWidth - FIT_PADDING_X) / sceneWidth, (viewportHeight - FIT_PADDING_Y) / sceneHeight);
  return Math.max(MIN_ZOOM, Math.min(1, raw));
}

/** Zoom-out floor. A huge island can still fit; a normal one cannot shrink to a speck. */
export function minZoomFor(fitScale: number): number {
  return Math.min(fitScale, Math.max(0.08, fitScale * 0.65));
}

export function zoomAt(camera: Camera, point: MapPoint, requestedScale: number, minZoom = MIN_ZOOM): Camera {
  const scale = Math.max(minZoom, Math.min(MAX_ZOOM, requestedScale));
  const ratio = camera.scale === 0 ? 1 : scale / camera.scale;
  return { x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio, scale };
}

export function clampCamera(
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  sceneWidth: number,
  sceneHeight: number,
  padding = CAMERA_PADDING,
): Camera {
  if (viewportWidth <= 0 || viewportHeight <= 0) return camera;
  const scaledWidth = sceneWidth * camera.scale;
  const scaledHeight = sceneHeight * camera.scale;
  const x = scaledWidth <= viewportWidth
    ? (viewportWidth - scaledWidth) / 2
    : Math.min(padding, Math.max(viewportWidth - scaledWidth - padding, camera.x));
  const y = scaledHeight <= viewportHeight
    ? (viewportHeight - scaledHeight) / 2
    : Math.min(padding, Math.max(viewportHeight - scaledHeight - padding, camera.y));
  return { ...camera, x, y };
}

export function settleCamera(
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  sceneWidth: number,
  sceneHeight: number,
): Camera {
  const minZoom = minZoomFor(fitScaleFor(viewportWidth, viewportHeight, sceneWidth, sceneHeight));
  const scale = Math.max(minZoom, Math.min(MAX_ZOOM, camera.scale));
  const adjusted = scale === camera.scale
    ? camera
    : zoomAt(camera, { x: viewportWidth / 2, y: viewportHeight / 2 }, scale, minZoom);
  return clampCamera(adjusted, viewportWidth, viewportHeight, sceneWidth, sceneHeight);
}

export function preserveWorldPoint(camera: Camera, from: ViewportSize, to: ViewportSize): Camera {
  const worldX = (from.width / 2 - camera.x) / camera.scale;
  const worldY = (from.height / 2 - camera.y) / camera.scale;
  return {
    scale: camera.scale,
    x: to.width / 2 - worldX * camera.scale,
    y: to.height / 2 - worldY * camera.scale,
  };
}

export function fitCamera(viewportWidth: number, viewportHeight: number, sceneWidth: number, sceneHeight: number): Camera {
  const scale = fitScaleFor(viewportWidth, viewportHeight, sceneWidth, sceneHeight);
  return clampCamera({
    x: (viewportWidth - sceneWidth * scale) / 2,
    y: (viewportHeight - sceneHeight * scale) / 2,
    scale,
  }, viewportWidth, viewportHeight, sceneWidth, sceneHeight);
}

export function focusCamera(
  point: MapPoint,
  viewportWidth: number,
  viewportHeight: number,
  sceneWidth: number,
  sceneHeight: number,
  requestedScale = 0.85,
  focalLift = 70,
): Camera {
  const minZoom = minZoomFor(fitScaleFor(viewportWidth, viewportHeight, sceneWidth, sceneHeight));
  const scale = Math.max(minZoom, Math.min(MAX_ZOOM, requestedScale));
  return clampCamera({
    x: viewportWidth / 2 - point.x * scale,
    y: viewportHeight / 2 - (point.y - focalLift) * scale,
    scale,
  }, viewportWidth, viewportHeight, sceneWidth, sceneHeight);
}

export function createCityScene(snapshot: CitySnapshot) {
  const maxZ = Math.max(snapshot.worldSize.depth, ...snapshot.landmarks.map((item) => item.position.z));
  const maxX = Math.max(snapshot.worldSize.width, ...snapshot.landmarks.map((item) => item.position.x));
  const project = (x: number, z: number): MapPoint => ({ x: (x-z+maxZ)*48+360, y: (x+z)*24+260 });
  const width = (maxX+maxZ)*48+720;
  const height = (maxX+maxZ)*24+500;
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

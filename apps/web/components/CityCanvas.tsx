"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { CitySnapshot, Building, Landmark, LandmarkKind } from "@tourist/protocol";
import { FileBuilding } from "./buildings/FileBuilding";
import { EnvironmentSprite, type EnvironmentAsset } from "./EnvironmentSprite";
import { LandmarkSprite, type CustomLandmarkAsset } from "./LandmarkSprite";
import { createCityScene, zoomAt, MIN_ZOOM, MAX_ZOOM, type Camera } from "../lib/city-scene";
import { createCityMap } from "../lib/city-map";
import { CityTraffic } from "./CityTraffic";
import { CityShips } from "./CityShips";

interface CityCanvasProps {
  snapshot: CitySnapshot;
  focusedAnchorId?: string | undefined;
  selectedBuildingId?: string | undefined;
  onSelectBuilding: (building: Building) => void;
  editingBuildingIds?: readonly string[];
  onSelectLandmark?: (landmark: Landmark) => void;
  onOpenOperation?: (operation: "airbase" | "skill-port" | "pr-base" | "command") => void;
}

const landmarkArtwork: Record<LandmarkKind, EnvironmentAsset | CustomLandmarkAsset> = {
  "command-center": "town-hall", "testing-facility": "testing-facility", "data-archive": "data-archive",
  "tool-workshop": "tools-workshop", "research-lab": "research-observatory", "review-center": "navy-review-yard", "merge-harbor": "skill-harbor",
};

function LandmarkArt({ asset, className = "" }: { asset: EnvironmentAsset | CustomLandmarkAsset; className?: string }) {
  return ["airbase", "skill-harbor", "navy-review-yard", "builder-worker", "town-hall"].includes(asset)
    ? <LandmarkSprite asset={asset as CustomLandmarkAsset} className={className} />
    : <EnvironmentSprite asset={asset as EnvironmentAsset} className={className} />;
}

function SceneSprite({ asset, scene, x, z, width, className = "", style }: {
  asset: EnvironmentAsset;
  scene: ReturnType<typeof createCityScene>;
  x: number;
  z: number;
  width: number;
  className?: string;
  style?: CSSProperties;
}) {
  const point = scene.project(x, z);
  return <EnvironmentSprite asset={asset} className={className} style={{ left: point.x, top: point.y, width, ...style }} />;
}

export function CityCanvas({ snapshot, focusedAnchorId, selectedBuildingId, onSelectBuilding, editingBuildingIds = [], onSelectLandmark, onOpenOperation }: CityCanvasProps) {
  const scene = useMemo(() => createCityScene(snapshot), [snapshot]);
  const map = useMemo(() => createCityMap(snapshot), [snapshot]);
  const trees = map.trees;
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [camera, setCamera] = useState<Camera>(() => {
    const scale = Math.max(MIN_ZOOM, Math.min(1, 960 / scene.width, 630 / scene.height));
    return { x: (1000 - scene.width * scale) / 2, y: (700 - scene.height * scale) / 2, scale };
  });
  const [showLabels, setShowLabels] = useState(false);
  const [hoveredBlockId, setHoveredBlockId] = useState<string>();
  const drag = useRef<{ x: number; y: number; origin: Camera; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const anchor = snapshot.anchors.find((item) => item.id === focusedAnchorId);
  const target = anchor?.target;
  const focusId = target?.type === "building" ? target.buildingId : target?.type === "landmark" ? target.landmarkId : target?.type === "district" ? target.districtId : undefined;
  const fit = useCallback(() => {
    const scale = Math.max(MIN_ZOOM, Math.min(1, (size.width-40)/scene.width, (size.height-70)/scene.height));
    setCamera({ x: (size.width-scene.width*scale)/2, y: (size.height-scene.height*scale)/2, scale });
  }, [scene, size]);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(fit, [fit]);
  useEffect(() => {
    const point = target?.type === "point" ? scene.project(target.position.x,target.position.z) : focusId ? scene.targets.get(focusId) : undefined;
    if (point) setCamera({ x: size.width/2-point.x*.85, y: size.height/2-(point.y-70)*.85, scale: .85 });
  }, [focusId, target, scene, size]);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = node.getBoundingClientRect();
      const delta = event.deltaMode === 1 ? event.deltaY*16 : event.deltaMode === 2 ? event.deltaY*size.height : event.deltaY;
      setCamera((value) => zoomAt(value, { x: event.clientX-bounds.left, y: event.clientY-bounds.top }, value.scale*Math.exp(-delta*.0015)));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [size.height]);

  const island = { x: 0, z: 0, width: scene.maxX, depth: scene.maxZ };
  const coastTiles = [
    ...Array.from({ length: Math.ceil(scene.maxX) }, (_, x) => [
      { x, z: -1, width: 1, depth: 1 }, { x, z: scene.maxZ, width: 1, depth: 1 },
      ...(x % 4 === 0 ? [{ x, z: -2, width: 1, depth: 1 }, { x, z: scene.maxZ + 1, width: 1, depth: 1 }] : []),
    ]).flat(),
    ...Array.from({ length: Math.ceil(scene.maxZ) }, (_, z) => [
      { x: -1, z, width: 1, depth: 1 }, { x: scene.maxX, z, width: 1, depth: 1 },
      ...(z % 5 < 2 ? [{ x: -2, z, width: 1, depth: 1 }, { x: scene.maxX + 1, z, width: 1, depth: 1 }] : []),
    ]).flat(),
  ];
  const allRoadRoutes = map.streets.map(([a, b]) => [scene.project(a.x, a.z), scene.project(b.x, b.z)] as const);
  const drawables = [
    ...snapshot.buildings.map((building) => ({ id: building.id, position: building.position, building })),
    ...snapshot.landmarks.map((landmark) => ({ id: landmark.id, position: landmark.position, landmark })),
  ].sort((a,b) => (a.position.x+a.position.z)-(b.position.x+b.position.z));
  // Snapshot states describe historical report evidence. Only live edit IDs
  // should send builders out of the town hall.
  const builderBuildings = snapshot.buildings.filter((building) => editingBuildingIds.includes(building.id));
  const builderOrigin = scene.targets.get("landmark-command-center") ?? scene.project(scene.maxX / 2, scene.maxZ / 2);

  return <div className="pixel-city" aria-label={`Interactive city of ${snapshot.repository.name}`}>
    <div className="city-viewport" ref={viewport} data-viewport-width={size.width} style={{ backgroundSize: `${96 * camera.scale}px ${48 * camera.scale}px, 100% 100%`, backgroundPosition: `${camera.x}px ${camera.y}px, center` }} tabIndex={0} aria-label="City map. Drag to pan, scroll to zoom. Arrow keys pan; plus and minus zoom."
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        suppressClick.current = false;
        drag.current = { x: event.clientX, y: event.clientY, origin: camera, moved: false };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start) return;
        const dx = event.clientX-start.x, dy = event.clientY-start.y;
        if (Math.abs(dx)+Math.abs(dy)>5) {
          start.moved = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setCamera({ ...start.origin, x: start.origin.x+dx, y: start.origin.y+dy });
        }
      }}
      onPointerUp={() => { suppressClick.current = drag.current?.moved ?? false; drag.current = null; }}
      onPointerCancel={() => { drag.current = null; suppressClick.current = true; }}
      onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
      onKeyDown={(event) => {
        const shifts: Record<string, [number,number]> = { ArrowLeft: [60,0], ArrowRight: [-60,0], ArrowUp: [0,60], ArrowDown: [0,-60] };
        const shift = shifts[event.key];
        if (shift) { event.preventDefault(); setCamera((value) => ({ ...value, x: value.x+shift[0], y: value.y+shift[1] })); }
        if (["+", "=", "-"].includes(event.key)) { event.preventDefault(); setCamera((value) => zoomAt(value, { x: size.width/2, y: size.height/2 }, value.scale*(event.key === "-" ? .8 : 1.25))); }
      }}>
      <div className={`city-artboard ${showLabels ? "show-labels" : ""}`} style={{ width: scene.width, height: scene.height, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
        <svg className="city-ground" width={scene.width} height={scene.height} aria-hidden="true">
          <defs>
            <mask id="street-junction-mask">
              <rect width={scene.width} height={scene.height} fill="white" />
              {map.junctions.map((point, i) => <polygon key={i} points={scene.polygon({ x: point.x - .8, z: point.z - .8, width: 1.6, depth: 1.6 })} fill="black" />)}
            </mask>
            <pattern id="city-grass-pixels" width="96" height="48" patternUnits="userSpaceOnUse">
              <rect width="96" height="48" fill="#7cb454" />
              <path d="M48 0L96 24 48 48 0 24Z" fill="#86bc5b" stroke="#74ab50" strokeWidth=".5" />
              <path d="M22 22h3M62 33h3M48 9h2" stroke="#a1ca71" strokeWidth="2" opacity=".55" />
            </pattern>
            <pattern id="city-plaza-pavers" width="48" height="24" patternUnits="userSpaceOnUse">
              <rect width="48" height="24" fill="#c7be99" /><path d="M24 0L48 12 24 24 0 12Z" fill="none" stroke="#ddd2af" strokeWidth="1" />
            </pattern>
            <pattern id="city-lawn-tiles" width="192" height="96" patternUnits="userSpaceOnUse">
              <rect width="192" height="96" fill="#85af60" /><path d="M96 0L192 48 96 96 0 48Z" fill="#8cb665" stroke="#78a659" strokeWidth="1" />
            </pattern>
            <clipPath id="city-island-clip"><polygon points={scene.polygon(island)} /></clipPath>
          </defs>
          <rect width={scene.width} height={scene.height} fill="#1f7897" />
          <g className="water-glints" aria-hidden="true">
            {Array.from({ length: 26 }, (_, index) => {
              const x = 60 + ((index * 197) % Math.max(scene.width - 120, 1));
              const y = 50 + ((index * 113) % Math.max(scene.height - 100, 1));
              return <path key={index} d={`M${x} ${y}h${10 + (index % 4) * 5}`} />;
            })}
          </g>
          <polygon points={scene.polygon(island, 30)} fill="#817351" stroke="#345949" strokeWidth="10" />
          <polygon points={scene.polygon(island, 10)} fill="#d5be84" stroke="#ecdba9" strokeWidth="14" />
          {coastTiles.map((tile, index) => <polygon key={`beach-${index}`} points={scene.polygon(tile)}
            fill={index % 3 === 0 ? "#e8d59e" : "#dbc78e"} stroke="#f0dfae" strokeWidth="1" />)}
          <polygon points={scene.polygon(island)} fill="url(#city-grass-pixels)" />
          <polygon className="civic-plaza" points={scene.polygon(map.plaza)} fill="url(#city-plaza-pavers)" stroke="#efdfa9" strokeWidth="8" />
          {snapshot.layout && <g className="coastal-walkways">
            <polygon points={scene.polygon({ x: map.airbase.x - .3, z: map.airbase.z - .35, width: snapshot.layout.origin.x - map.airbase.x + .3, depth: .7 })} fill="#d7ceb0" />
            {snapshot.landmarks.filter(l => l.kind === "merge-harbor" || l.kind === "review-center").map(l => <polygon key={l.id}
              points={scene.polygon(l.kind === "merge-harbor"
                ? { x: l.position.x - .4, z: scene.maxZ - 5, width: .8, depth: 4.5 }
                : { x: scene.maxX - 5, z: l.position.z - .4, width: 4.5, depth: .8 })} fill="#d7ceb0" />)}
          </g>}
          {map.blocks.map((block, index) => {
            const b = block.bounds;
            const garden = { x: b.x + .7, z: b.z + .7, width: b.width - 1.4, depth: b.depth - 1.4 };
            return <g key={block.id}>
              <polygon points={scene.polygon(garden)} fill={block.use === "command-center" ? "url(#city-plaza-pavers)" : index % 2 ? "#75b452" : "#7dbb55"} />
              {[0, 1, 2, 3].map(slot => <polygon key={slot} points={scene.polygon({
                x: garden.x + (slot % 2) * garden.width / 2, z: garden.z + Math.floor(slot / 2) * garden.depth / 2,
                width: garden.width / 2, depth: garden.depth / 2,
              })} fill={block.use === "command-center" ? "transparent" : slot % 3 === 0 ? "#91c565" : "#6dac4e"} opacity=".5" />)}
              <polygon className={`district-block ${hoveredBlockId === block.id ? "is-hovered" : ""}`}
                points={scene.polygon(garden)} fill="transparent" stroke="transparent"
                onMouseEnter={() => setHoveredBlockId(block.id)} onMouseLeave={() => setHoveredBlockId(undefined)}>
                <title>{block.use === "files" ? "File block" : block.use.replaceAll("-", " ")}</title>
              </polygon>
            </g>;
          })}
          <g className="planned-roads" aria-hidden="true">
            {map.streets.map((street, index) => <polygon key={`pavement-${index}`} points={scene.polygon(map.roadBounds(street, 1.18))} fill="#cfceb7" />)}
            {map.streets.map((street, index) => <polygon key={`road-${index}`} points={scene.polygon(map.roadBounds(street))} fill="#89999a" />)}
            <g mask="url(#street-junction-mask)">
              {allRoadRoutes.map(([a, b], index) => <path key={index} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} fill="none" stroke="#e8ecda" strokeWidth="2.2" strokeDasharray="12 13" />)}
            </g>
            {map.junctions.filter(p => Math.abs(p.x - scene.maxX / 2) < 5 && Math.abs(p.z - scene.maxZ / 2) < 5).flatMap((p, i) =>
              [-1, 1].flatMap(sign => Array.from({ length: 4 }, (_, n) => <g key={`${i}-${sign}-${n}`}>
                <polygon points={scene.polygon({ x: p.x + sign * .95, z: p.z - .32 + n * .18, width: .4, depth: .08 })} fill="#f0eee0" />
                <polygon points={scene.polygon({ z: p.z + sign * .95, x: p.x - .32 + n * .18, depth: .4, width: .08 })} fill="#f0eee0" />
              </g>)))}
          </g>
        </svg>
        <CityTraffic map={map} scene={scene} />
        <CityShips
          scene={scene}
          harbor={snapshot.landmarks.find((item) => item.kind === "merge-harbor")?.position}
          navy={snapshot.landmarks.find((item) => item.kind === "review-center")?.position}
        />
        <div className="operation-marker airbase-marker" style={{ left: scene.project(map.airbase.x, map.airbase.z).x, top: scene.project(map.airbase.x, map.airbase.z).y, zIndex: Math.round((map.airbase.x + map.airbase.z) * 10) + 100 }}>
          <button type="button" onClick={() => onOpenOperation?.("airbase")} aria-label="Open the repository airbase and import a repository">
            <LandmarkSprite asset="airbase" className="airbase-art" />
            <span className="operation-marker-label">AIRBASE</span>
          </button>
        </div>
        <div className="environment-layer" aria-hidden="true">
          {map.decorations.map((decoration, index) => <SceneSprite key={`decoration-${index}`} asset={decoration.asset} scene={scene}
            x={decoration.x} z={decoration.z} width={decoration.width}
            style={{ zIndex: Math.round((decoration.x + decoration.z) * 10) + 100 }} />)}
          {trees.map((tree, index) => <SceneSprite key={`tree-${index}`} asset={tree.asset} scene={scene} x={tree.x} z={tree.z} width={Math.round(tree.size * 90)} className="environment-tree" style={{ zIndex: Math.round((tree.x + tree.z) * 10) + 100 }} />)}
          <SceneSprite asset="cloud" scene={scene} x={-3} z={scene.maxZ * .4} width={150} className="environment-cloud cloud-drift-one" />
          <SceneSprite asset="cloud" scene={scene} x={scene.maxX + 4} z={scene.maxZ * .3} width={120} className="environment-cloud cloud-drift-two" />
        </div>
        {drawables.map((item) => {
          const point = scene.targets.get(item.id)!;
          return <div className={`city-plot ${"landmark" in item ? `city-landmark landmark-${item.landmark.kind}` : ""} ${focusId===item.id ? "is-active" : ""}`} key={item.id} style={{ left: point.x, top: point.y, zIndex: Math.round((item.position.x + item.position.z) * 10) + 100 }}>
            {"building" in item ? <FileBuilding building={item.building} active={item.id===selectedBuildingId || item.id===focusId} onSelect={onSelectBuilding} /> : <button
              type="button"
              className="landmark-action"
              onClick={() => {
                onSelectLandmark?.(item.landmark);
                const operation = item.landmark.kind === "merge-harbor" ? "skill-port" : item.landmark.kind === "review-center" ? "pr-base" : item.landmark.kind === "command-center" ? "command" : undefined;
                if (operation) onOpenOperation?.(operation);
              }}
              aria-label={`Open ${item.landmark.label}`}
            ><LandmarkArt asset={landmarkArtwork[item.landmark.kind]} className="landmark-sprite" /><span className="building-name">{item.landmark.label}</span></button>}
          </div>;
        })}
        {builderBuildings.map((building, index) => {
          const destination = scene.targets.get(building.id);
          const origin = builderOrigin;
          if (!destination) return null;
          return <div
            className="builder-pawn"
            key={`builder-${building.id}`}
            style={{
              left: 0,
              top: 0,
              offsetPath: `path("M ${origin.x} ${origin.y} L ${destination.x} ${destination.y}")`,
              animationDelay: `${index * -1.4}s`,
            } as CSSProperties}
            aria-label={`Builder crew working on ${building.path}`}
          ><LandmarkSprite asset="builder-worker" className="builder-sprite" /><span className="builder-status">BUILDER · WORKING</span></div>;
        })}
        {builderBuildings.length === 0 && <div className="builder-pawn builder-pawn-idle" style={{ left: builderOrigin.x, top: builderOrigin.y }} aria-label="Builder crew waiting at town hall">
          <LandmarkSprite asset="builder-worker" className="builder-sprite" /><span className="builder-status">BUILDER · IDLE</span>
        </div>}
        {snapshot.buildings.length===0 && <div className="city-empty" style={{ left: scene.width/2, top: scene.height/2 }}>No files in this snapshot</div>}
      </div>
    </div>
    <div className="map-controls glass-panel" aria-label="Map controls">
      <button onClick={() => setCamera((value) => zoomAt(value,{ x: size.width/2,y:size.height/2 },value.scale*1.25))} disabled={camera.scale>=MAX_ZOOM} type="button">+</button>
      <span className="map-zoom">{Math.round(camera.scale*100)}%</span>
      <button onClick={() => setCamera((value) => zoomAt(value,{ x: size.width/2,y:size.height/2 },value.scale*.8))} disabled={camera.scale<=MIN_ZOOM} type="button">−</button>
      <button onClick={fit} type="button">Fit island</button>
      <button onClick={() => setShowLabels((value) => !value)} aria-pressed={showLabels} type="button">File names</button>
    </div>
    <div className="map-hint">DRAG TO EXPLORE · SCROLL TO ZOOM · SELECT A BUILDING</div>
  </div>;
}

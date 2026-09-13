"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { CitySnapshot, Building, Landmark, LandmarkKind } from "@tourist/protocol";
import { FileBuilding } from "./buildings/FileBuilding";
import { EnvironmentSprite, type EnvironmentAsset } from "./EnvironmentSprite";
import { LandmarkSprite, type CustomLandmarkAsset } from "./LandmarkSprite";
import { createCityScene, zoomAt, type Camera } from "../lib/city-scene";

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

function nearBuilding(x: number, z: number, buildings: readonly Building[]): boolean {
  return buildings.some((building) => Math.abs(building.position.x - x) < 1.8 && Math.abs(building.position.z - z) < 1.8);
}

function treePoints(snapshot: CitySnapshot) {
  const points: Array<{ x: number; z: number; size: number }> = [];
  for (const sector of snapshot.sectors) {
    for (let x = sector.bounds.x + 1.8; x < sector.bounds.x + sector.bounds.width - 1; x += 3.4) {
      for (let z = sector.bounds.z + 1.8; z < sector.bounds.z + sector.bounds.depth - 1; z += 3.4) {
        const seed = Math.round(x * 13 + z * 17 + sector.bounds.x * 7 + sector.bounds.z * 11);
        if (seed % 5 > 1 || nearBuilding(x, z, snapshot.buildings)) continue;
        points.push({ x, z, size: seed % 3 === 0 ? 1.2 : .9 });
      }
    }
  }
  return points;
}

export function CityCanvas({ snapshot, focusedAnchorId, selectedBuildingId, onSelectBuilding, editingBuildingIds = [], onSelectLandmark, onOpenOperation }: CityCanvasProps) {
  const scene = useMemo(() => createCityScene(snapshot), [snapshot]);
  const trees = useMemo(() => treePoints(snapshot), [snapshot]);
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: .4 });
  const [showLabels, setShowLabels] = useState(false);
  const [hoveredDistrictId, setHoveredDistrictId] = useState<string>();
  const drag = useRef<{ x: number; y: number; origin: Camera; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const anchor = snapshot.anchors.find((item) => item.id === focusedAnchorId);
  const target = anchor?.target;
  const focusId = target?.type === "building" ? target.buildingId : target?.type === "landmark" ? target.landmarkId : target?.type === "district" ? target.districtId : undefined;
  const fit = useCallback(() => {
    const scale = Math.max(.15, Math.min(.75, (size.width-60)/scene.width, (size.height-90)/scene.height));
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

  const island = { x: -1, z: -1, width: scene.maxX+3, depth: scene.maxZ+3 };
  const roadRoutes = snapshot.sectors.flatMap((sector) => {
    const horizontal = [0.25, 0.5, 0.75].map((ratio) => [
      scene.project(sector.bounds.x + 1, sector.bounds.z + sector.bounds.depth * ratio),
      scene.project(sector.bounds.x + sector.bounds.width - 1, sector.bounds.z + sector.bounds.depth * ratio),
    ] as const);
    const vertical = [0.25, 0.5, 0.75].map((ratio) => [
      scene.project(sector.bounds.x + sector.bounds.width * ratio, sector.bounds.z + 1),
      scene.project(sector.bounds.x + sector.bounds.width * ratio, sector.bounds.z + sector.bounds.depth - 1),
    ] as const);
    return [...horizontal, ...vertical];
  });
  const arterialRoutes = [
    [scene.project(0, scene.maxZ / 2), scene.project(scene.maxX, scene.maxZ / 2)],
    [scene.project(scene.maxX / 2, 0), scene.project(scene.maxX / 2, scene.maxZ)],
  ] as const;
  const allRoadRoutes = [...roadRoutes, ...arterialRoutes];
  const drawables = [
    ...snapshot.buildings.map((building) => ({ id: building.id, position: building.position, building })),
    ...snapshot.landmarks.map((landmark) => ({ id: landmark.id, position: landmark.position, landmark })),
  ].sort((a,b) => (a.position.x+a.position.z)-(b.position.x+b.position.z));
  // Snapshot states describe historical report evidence. Only live edit IDs
  // should send builders out of the town hall.
  const builderBuildings = snapshot.buildings.filter((building) => editingBuildingIds.includes(building.id));
  const builderOrigin = scene.targets.get("landmark-command-center") ?? scene.project(scene.maxX / 2, scene.maxZ / 2);

  return <div className="pixel-city" aria-label={`Interactive city of ${snapshot.repository.name}`}>
    <div className="city-viewport" ref={viewport} tabIndex={0} aria-label="City map. Drag to pan, scroll to zoom. Arrow keys pan; plus and minus zoom."
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
            <pattern id="city-grass-pixels" width="32" height="32" patternUnits="userSpaceOnUse">
              <rect width="32" height="32" fill="#729750" />
              <path d="M0 16h12M22 7h7M15 28h10" stroke="#87aa5c" strokeWidth="2" opacity=".38" />
              <path d="M4 5h5M27 25h3" stroke="#5e874b" strokeWidth="2" opacity=".28" />
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
          <polygon points={scene.polygon(island, 30)} fill="#766646" stroke="#345949" strokeWidth="10" />
          <polygon points={scene.polygon(island, 10)} fill="#d5be84" stroke="#ecdba9" strokeWidth="14" />
          <polygon points={scene.polygon(island)} fill="url(#city-grass-pixels)" />
          {snapshot.sectors.map((sector) => <g key={sector.id}>
            <polygon points={scene.polygon(sector.bounds)} fill="#83a35b" stroke="#d4c796" strokeWidth="28" />
            <polygon points={scene.polygon(sector.bounds)} fill="none" stroke="#65736e" strokeWidth="18" />
            <polygon points={scene.polygon(sector.bounds)} fill="none" stroke="#dbd8b0" strokeWidth="1.5" strokeDasharray="10 10" />
            <text x={scene.project(sector.bounds.x,sector.bounds.z).x} y={scene.project(sector.bounds.x,sector.bounds.z).y-30} textAnchor="middle" className="sector-label">{sector.name}</text>
          </g>)}
          {snapshot.districts.map((district) => <polygon
            key={district.id}
            className={`district-block ${hoveredDistrictId === district.id ? "is-hovered" : ""}`}
            points={scene.polygon(district.bounds)}
            fill="#91ab6b"
            stroke="#bbc791"
            strokeWidth={hoveredDistrictId === district.id ? 8 : 3}
            onMouseEnter={() => setHoveredDistrictId(district.id)}
            onMouseLeave={() => setHoveredDistrictId(undefined)}
          />)}
          <g className="city-roads" aria-hidden="true">
            {allRoadRoutes.map(([from, to], index) => <g key={index} className={index >= roadRoutes.length ? "city-arterial" : undefined}>
              <path d={`M${from.x} ${from.y}L${to.x} ${to.y}`} />
              <path className="road-markings" d={`M${from.x} ${from.y}L${to.x} ${to.y}`} />
            </g>)}
          </g>
          <g className="city-trees" aria-hidden="true">
            {trees.map((tree, index) => {
              const point = scene.project(tree.x, tree.z);
              const s = tree.size;
              return <g key={index} transform={`translate(${point.x} ${point.y}) scale(${s})`}>
                <ellipse cx="0" cy="2" rx="11" ry="4" fill="#365c45" opacity=".28" />
                <path d="M-2 1v-19h4V1Z" fill="#725037" />
                <path d="M-14-16 0-39 14-16 8-18 0-28-8-18Z" fill="#2c6548" stroke="#214d40" strokeWidth="1.5" />
                <path d="M-9-22 0-35 9-22 3-24 0-29-3-24Z" fill="#4d9251" />
              </g>;
            })}
          </g>
          <g className="city-lamps" aria-hidden="true">
            {snapshot.sectors.flatMap((sector) => [0, 1, 2].map((index) => {
              const point = scene.project(sector.bounds.x + 2 + index * 5, sector.bounds.z + 1.3);
              return <g key={`${sector.id}-lamp-${index}`} transform={`translate(${point.x} ${point.y})`}><path d="M0 0v-12" stroke="#273f43" strokeWidth="2"/><circle cy="-14" r="3" fill="#ffe7a3" stroke="#815f2c" strokeWidth="1"/></g>;
            }))}
          </g>
          <g className="city-fountain" transform={`translate(${scene.project(scene.maxX / 2, scene.maxZ / 2).x} ${scene.project(scene.maxX / 2, scene.maxZ / 2).y})`} aria-hidden="true">
            <ellipse cx="0" cy="2" rx="26" ry="9" fill="#315f66" opacity=".28" />
            <path d="M-22 0 0-10 22 0 0 10Z" fill="#d4c383" stroke="#6d765e" strokeWidth="2" />
            <path d="M0 0v-18" stroke="#9ee7e3" strokeWidth="3" strokeDasharray="3 3" />
            <path d="M-10-8Q-5-16 0-18Q5-16 10-8" fill="none" stroke="#8ddbd8" strokeWidth="2" />
          </g>
          <g className="city-clouds" aria-hidden="true">
            <g className="city-cloud cloud-one"><path d="M120 180q10-17 27 0 18-25 37 1h28v9h-92Z" fill="#dff5ee" opacity=".45" /></g>
            <g className="city-cloud cloud-two"><path d="M1050 310q10-17 27 0 18-25 37 1h28v9h-92Z" fill="#dff5ee" opacity=".36" /></g>
          </g>
          <g className="city-birds" aria-hidden="true">
            <path d="M170 270q7-8 14 0 7-8 14 0" />
            <path d="M1180 170q6-7 12 0 6-7 12 0" />
          </g>
          <g className="city-piers" aria-hidden="true">
            {[scene.project(1, scene.maxZ + 2), scene.project(scene.maxX + 2, 1)].map((point, index) => <g key={index} transform={`translate(${point.x} ${point.y}) rotate(${index ? 35 : -35})`}>
              <path d="M0 0v-58M14 0v-58M28 0v-58" stroke="#6b4d34" strokeWidth="5" />
              <path d="M-12-56h54v12h-54Z" fill="#9a6c43" stroke="#493c36" strokeWidth="2" />
              <path d="M-5-52h40M-5-46h40" stroke="#d19a5b" strokeWidth="2" />
              <circle cx="-12" cy="-61" r="4" fill="#ffe09b" />
              <circle cx="42" cy="-61" r="4" fill="#ffe09b" />
            </g>)}
          </g>
          <g className="city-traffic" aria-hidden="true">
            {allRoadRoutes.slice(0, 5).map(([from, to], index) => <image key={index} href={`/assets/environment/${index === 1 ? "delivery-van" : "compact-car"}.webp`} x={-34} y={-34} width="68" height="68" preserveAspectRatio="xMidYMid meet">
              <animateMotion dur={`${13 + index * 4}s`} repeatCount="indefinite" rotate="auto" path={`M${from.x} ${from.y}L${to.x} ${to.y}`} />
            </image>)}
          </g>
          <g className="city-ships" aria-hidden="true">
            <image href="/assets/environment/cargo-ship.webp" x={-82} y={-48} width="164" height="96" preserveAspectRatio="xMidYMid meet"><animateMotion dur="30s" repeatCount="indefinite" path={`M${scene.project(-4, scene.maxZ + 5).x} ${scene.project(-4, scene.maxZ + 5).y}L${scene.project(scene.maxX + 5, scene.maxZ + 5).x} ${scene.project(scene.maxX + 5, scene.maxZ + 5).y}`} /></image>
            <image href="/assets/environment/speedboat.webp" x={-70} y={-44} width="140" height="88" preserveAspectRatio="xMidYMid meet"><animateMotion dur="22s" repeatCount="indefinite" path={`M${scene.project(scene.maxX + 5, -3).x} ${scene.project(scene.maxX + 5, -3).y}L${scene.project(scene.maxX + 5, scene.maxZ + 5).x} ${scene.project(scene.maxX + 5, scene.maxZ + 5).y}`} /></image>
          </g>
        </svg>
        <div className="operation-marker airbase-marker" style={{ left: scene.project(scene.maxX * .1, scene.maxZ * .78).x, top: scene.project(scene.maxX * .1, scene.maxZ * .78).y }}>
          <button type="button" onClick={() => onOpenOperation?.("airbase")} aria-label="Open the repository airbase and import a repository">
            <LandmarkSprite asset="airbase" className="airbase-art" />
            <span className="operation-marker-label">AIRBASE</span>
          </button>
        </div>
        <div className="environment-layer" aria-hidden="true">
          {trees.map((tree, index) => <SceneSprite key={`tree-${index}`} asset={index % 4 === 0 ? "conifer" : "broadleaf-tree"} scene={scene} x={tree.x} z={tree.z} width={tree.size > 1 ? 120 : 94} className="environment-tree" />)}
          {snapshot.sectors.map((sector, index) => {
            const centerX = sector.bounds.x + sector.bounds.width / 2;
            const centerZ = sector.bounds.z + sector.bounds.depth / 2;
            return <span key={sector.id}>
              <SceneSprite asset="road-intersection" scene={scene} x={centerX} z={centerZ} width={180} className="environment-road" />
              <SceneSprite asset="fountain" scene={scene} x={centerX + (index % 2 ? 2 : -2)} z={centerZ + (index % 2 ? -2 : 2)} width={105} className="environment-fountain" />
              <SceneSprite asset="street-lamp" scene={scene} x={sector.bounds.x + 2} z={sector.bounds.z + 1.3} width={48} className="environment-lamp" />
              <SceneSprite asset="street-lamp" scene={scene} x={sector.bounds.x + sector.bounds.width - 2} z={sector.bounds.z + sector.bounds.depth - 1.3} width={48} className="environment-lamp" />
            </span>;
          })}
          <SceneSprite asset="cloud" scene={scene} x={scene.maxX * .14} z={scene.maxZ * .2} width={150} className="environment-cloud cloud-drift-one" />
          <SceneSprite asset="cloud" scene={scene} x={scene.maxX * .78} z={scene.maxZ * .12} width={120} className="environment-cloud cloud-drift-two" />
          <SceneSprite asset="pier" scene={scene} x={1} z={scene.maxZ + 2} width={190} className="environment-pier" />
          <SceneSprite asset="pier" scene={scene} x={scene.maxX + 2} z={2} width={190} className="environment-pier pier-two" />
        </div>
        {drawables.map((item) => {
          const point = scene.targets.get(item.id)!;
          return <div className={`city-plot ${"landmark" in item ? `city-landmark landmark-${item.landmark.kind}` : ""} ${focusId===item.id ? "is-active" : ""}`} key={item.id} style={{ left: point.x, top: point.y }}>
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
      <button onClick={() => setCamera((value) => zoomAt(value,{ x: size.width/2,y:size.height/2 },value.scale*1.25))} disabled={camera.scale>=2} type="button">+</button>
      <span className="map-zoom">{Math.round(camera.scale*100)}%</span>
      <button onClick={() => setCamera((value) => zoomAt(value,{ x: size.width/2,y:size.height/2 },value.scale*.8))} disabled={camera.scale<=.15} type="button">−</button>
      <button onClick={fit} type="button">Fit island</button>
      <button onClick={() => setShowLabels((value) => !value)} aria-pressed={showLabels} type="button">File names</button>
    </div>
    <div className="map-hint">DRAG TO EXPLORE · SCROLL TO ZOOM · SELECT A BUILDING</div>
  </div>;
}

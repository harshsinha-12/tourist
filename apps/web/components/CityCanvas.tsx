"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import type { Anchor, Building, CitySnapshot, Landmark } from "@tourist/protocol";
import cityArtwork from "../../../Pixel-Art Software Development Island City.png";

interface CityCanvasProps {
  snapshot: CitySnapshot;
  focusedAnchorId?: string | undefined;
  selectedBuildingId?: string | undefined;
  onSelectBuilding: (building: Building) => void;
}

interface MapPoint { x: number; y: number; }

const landmarkPoints: Record<Landmark["kind"], MapPoint> = {
  "command-center": { x: 46.2, y: 41.4 },
  "testing-facility": { x: 61.5, y: 17.3 },
  "data-archive": { x: 83.2, y: 33.5 },
  "tool-workshop": { x: 34.6, y: 59.8 },
  "research-lab": { x: 31.2, y: 17.8 },
  "review-center": { x: 75.8, y: 50.2 },
  "merge-harbor": { x: 76.1, y: 75.2 },
};

const districtZones: Record<string, { center: MapPoint; spreadX: number; spreadY: number }> = {
  apps: { center: { x: 23.5, y: 42 }, spreadX: 9, spreadY: 14 },
  packages: { center: { x: 83, y: 38 }, spreadX: 8, spreadY: 16 },
  root: { center: { x: 47, y: 42 }, spreadX: 10, spreadY: 10 },
};

export function CityCanvas({ snapshot, focusedAnchorId, selectedBuildingId, onSelectBuilding }: CityCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const anchor = snapshot.anchors.find((candidate) => candidate.id === focusedAnchorId);
  const focusPoint = resolveAnchorPoint(anchor, snapshot);
  const transformOrigin = focusPoint ? `${focusPoint.x}% ${focusPoint.y}%` : "50% 50%";

  return (
    <div className="pixel-city" aria-label={`Interactive pixel-art map of ${snapshot.repository.name}`}>
      <div className="city-artboard" style={{ "--city-zoom": zoom, "--focus-origin": transformOrigin } as CSSProperties}>
        <Image
          alt="Pixel-art software development island with code, research, testing, data, review, tools, command, and merge-harbor districts"
          className="city-artwork"
          fill
          priority
          sizes="100vw"
          src={cityArtwork}
        />
        <div className="city-vignette" aria-hidden="true" />

        {snapshot.buildings.map((building, index) => {
          const point = pointForBuilding(building, index);
          const active = building.id === selectedBuildingId || (anchor?.target.type === "building" && anchor.target.buildingId === building.id);
          return (
            <button
              aria-label={`Inspect ${building.path}`}
              className={`building-hotspot ${active ? "is-active" : ""}`}
              key={building.id}
              onClick={() => onSelectBuilding(building)}
              style={{ left: `${point.x}%`, top: `${point.y}%`, "--building-color": building.color } as CSSProperties}
              title={building.path}
              type="button"
            >
              <span>{building.name}</span>
            </button>
          );
        })}

        {snapshot.landmarks.map((landmark) => {
          const point = landmarkPoints[landmark.kind];
          const active = anchor?.target.type === "landmark" && anchor.target.landmarkId === landmark.id;
          return <div aria-hidden="true" className={`landmark-focus ${active ? "is-active" : ""}`} key={landmark.id} style={{ left: `${point.x}%`, top: `${point.y}%` }} />;
        })}
      </div>

      <div className="map-controls glass-panel" aria-label="Map zoom controls">
        <button disabled={zoom >= 1.35} onClick={() => setZoom((value) => Math.min(1.35, value + 0.12))} type="button">Zoom in</button>
        <button disabled={zoom <= 0.9} onClick={() => setZoom((value) => Math.max(0.9, value - 0.12))} type="button">Zoom out</button>
        <button onClick={() => setZoom(1)} type="button">Reset</button>
      </div>
    </div>
  );
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function pointForBuilding(building: Building, index: number): MapPoint {
  const sector = building.path.includes("/") ? building.path.split("/")[0] ?? "root" : "root";
  const zone = districtZones[sector] ?? districtZones.root!;
  const seed = hash(`${building.id}-${index}`);
  return {
    x: zone.center.x + ((seed & 255) / 255 - 0.5) * zone.spreadX,
    y: zone.center.y + (((seed >>> 8) & 255) / 255 - 0.5) * zone.spreadY,
  };
}

function resolveAnchorPoint(anchor: Anchor | undefined, snapshot: CitySnapshot): MapPoint | undefined {
  if (!anchor) return undefined;
  const target = anchor.target;
  if (target.type === "building") {
    const index = snapshot.buildings.findIndex((building) => building.id === target.buildingId);
    const building = snapshot.buildings[index];
    return building ? pointForBuilding(building, index) : undefined;
  }
  if (target.type === "landmark") {
    const landmark = snapshot.landmarks.find((candidate) => candidate.id === target.landmarkId);
    return landmark ? landmarkPoints[landmark.kind] : undefined;
  }
  return undefined;
}

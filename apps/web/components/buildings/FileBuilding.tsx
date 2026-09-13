import type { Building } from "@tourist/protocol";
import { getBuildingArchetype } from "./registry";

export function FileBuilding({ building, active, onSelect }: {
  building: Building; active: boolean; onSelect: (building: Building) => void;
}) {
  const { design, Component } = getBuildingArchetype(building);
  return (
    <button type="button" className={`file-building ${active ? "is-active" : ""}`}
      aria-label={`Inspect ${building.path}`} aria-pressed={active}
      data-archetype={design.id} data-state={building.state}
      title={`${building.path} · ${design.label} · ${building.state}`}
      onClick={() => onSelect(building)}>
      <Component design={design} building={building} />
      <span className="building-name">{building.name}</span>
      {building.state !== "idle" && <span className="building-state">{building.state}</span>}
    </button>
  );
}

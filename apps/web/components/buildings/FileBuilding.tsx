import type { Building } from "@tourist/protocol";
import { getBuildingArchetype } from "./registry";

export function FileBuilding({ building, active, onSelect }: {
  building: Building; active: boolean; onSelect: (building: Building) => void;
}) {
  const { design, Component } = getBuildingArchetype(building);
  return (
    <button type="button" className={`file-building ${active ? "is-active" : ""}`}
      aria-label={building.fileCount > 1 ? `Inspect ${building.name}, ${building.fileCount} files` : `Inspect ${building.path}`} aria-pressed={active}
      data-archetype={design.id} data-state={building.state} data-settlement={building.settlement}
      title={`${building.fileCount > 1 ? building.name : building.path} · ${design.label} · ${building.state}`}
      onClick={() => onSelect(building)}>
      <Component design={design} building={building} />
      {building.fileCount > 1 && <span className="settlement-count">{building.settlement} · {building.fileCount}</span>}
      <span className="building-name">{building.name}</span>
      {building.state !== "idle" && <span className="building-state">{building.state}</span>}
    </button>
  );
}

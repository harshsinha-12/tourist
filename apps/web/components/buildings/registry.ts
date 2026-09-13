import availableSprites from "../../lib/available-sprites.json";
import catalog from "../../lib/building-catalog.json";
import { BuildingModel } from "./BuildingModel";
import { resolveArchetype, type PickBuilding } from "./resolver";
import { SpriteBuilding } from "./SpriteBuilding";
import type { BuildingArchetype, BuildingDesign } from "./types";

const spriteIds = new Set(availableSprites);
const fallbackPalette = { wall: "#ece0c9", side: "#677a85", roof: "#91b8ca", light: "#ffe8a3" };

function designFor(entry: (typeof catalog)[number]): BuildingDesign {
  const sprite = spriteIds.has(entry.id) ? `/assets/buildings/${entry.id}.webp` : undefined;
  return {
    id: entry.id,
    label: entry.title,
    badge: entry.name,
    category: entry.category,
    example: entry.example,
    palette: fallbackPalette,
    roof: "terrace",
    floors: 2,
    width: 36,
    ...(sprite ? { sprite } : {}),
  };
}

// Artwork is authored once per type; every repository file gets its own instance.
// Sprites attach as source PNGs land; types still waiting use the SVG stand-in.
export const buildingArchetypes: readonly BuildingArchetype[] = catalog.map((entry) => {
  const design = designFor(entry);
  return {
    design,
    Component: "sprite" in design && design.sprite ? SpriteBuilding : BuildingModel,
    extensions: entry.extensions,
    languages: entry.languages,
  };
});
export const genericArchetype = buildingArchetypes.find((entry) => entry.design.id === "generic")!;

export function getBuildingArchetype(building: PickBuilding): BuildingArchetype {
  return resolveArchetype(building, buildingArchetypes, genericArchetype);
}

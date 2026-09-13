import type { ComponentType } from "react";
import type { Building } from "@tourist/protocol";

export interface BuildingDesign {
  id: string;
  sprite?: string | undefined;
  category?: string | undefined;
  example?: string | undefined;
  label: string;
  badge: string;
  palette: { wall: string; side: string; roof: string; light: string };
  roof: "terrace" | "spire" | "dome" | "sawtooth" | "gable";
  floors: number;
  width: number;
}

export interface BuildingDesignProps { design: BuildingDesign; building?: Building | undefined; }
export interface BuildingArchetype {
  design: BuildingDesign;
  Component: ComponentType<BuildingDesignProps>;
  extensions: readonly string[];
  languages: readonly string[];
}

import type { BuildingDesign } from "../types";

export const genericDesign = {
  "id": "generic",
  "label": "General building",
  "badge": "FILE",
  "palette": {
    "wall": "#a6b7bd",
    "side": "#5c7280",
    "roof": "#ced6d5",
    "light": "#fff1ac"
  },
  "roof": "gable",
  "floors": 1,
  "width": 34
} satisfies BuildingDesign;

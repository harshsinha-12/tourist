import type { CSSProperties } from "react";

export type CustomLandmarkAsset = "airbase" | "skill-harbor" | "navy-review-yard" | "builder-worker" | "town-hall";

const sources: Record<CustomLandmarkAsset, string> = {
  airbase: "/assets/landmarks/airbase.webp",
  "skill-harbor": "/assets/landmarks/skill-harbor.webp",
  "navy-review-yard": "/assets/landmarks/navy-review-yard.webp",
  "builder-worker": "/assets/landmarks/builder-worker.webp",
  "town-hall": "/assets/landmarks/town-hall.webp",
};

export function LandmarkSprite({ asset, className = "", style }: { asset: CustomLandmarkAsset; className?: string; style?: CSSProperties }) {
  return <img className={`landmark-art ${className}`} src={sources[asset]} alt="" draggable={false} style={style} />;
}

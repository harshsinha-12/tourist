import type { CSSProperties } from "react";
import assets from "../lib/environment-assets.json";

export type EnvironmentAsset = keyof typeof assets;

export function EnvironmentSprite({ asset, className = "", style }: {
  asset: EnvironmentAsset;
  className?: string;
  style?: CSSProperties;
}) {
  const entry = assets[asset];
  return <img className={`environment-sprite ${className}`} src={entry.src} alt="" draggable={false} style={style} />;
}

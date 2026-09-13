"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BuildingModel } from "./BuildingModel";
import type { BuildingDesignProps } from "./types";

export function SpriteBuilding({ design, building }: BuildingDesignProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [design.sprite]);
  if (!design.sprite || failed) {
    return <BuildingModel design={design} {...(building ? { building } : {})} />;
  }
  return <Image
    className="building-sprite"
    src={design.sprite}
    width={640} height={640} alt="" draggable={false} unoptimized
    onError={() => setFailed(true)}
  />;
}

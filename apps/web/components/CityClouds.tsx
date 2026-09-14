import { CLOUD_ROUTES, projectedLoopPath, wanderLoop } from "../lib/clouds";
import type { createCityScene } from "../lib/city-scene";
import type { CSSProperties } from "react";

export function CityClouds({ scene }: { scene: ReturnType<typeof createCityScene> }) {
  return <div className="city-clouds" aria-hidden="true">
    {CLOUD_ROUTES.map((route, index) => {
      const path = projectedLoopPath(wanderLoop(scene.maxX, scene.maxZ, route.margin, route.seed), scene.project);
      return <div
        key={index}
        className={`city-cloud ${route.reverse ? "is-reverse" : ""}`}
        style={{
          offsetPath: `path("${path}")`,
          animationDuration: route.duration,
          animationDelay: route.delay,
        } as CSSProperties}
      >
        <img
          src="/assets/environment/cloud.webp"
          alt=""
          draggable={false}
          style={{ width: route.width, opacity: route.opacity, animationDuration: route.bob }}
        />
      </div>;
    })}
  </div>;
}

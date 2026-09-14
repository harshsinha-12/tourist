"use client";

import { useEffect, useMemo, useState } from "react";
import { advanceCars, carPose, carSpriteSrc, carTransform, createTrafficGraph, spawnCars, spriteFacing, type Car } from "../lib/traffic";
import type { createCityScene } from "../lib/city-scene";
import type { createCityMap } from "../lib/city-map";

export function CityTraffic({ map, scene }: {
  map: ReturnType<typeof createCityMap>;
  scene: ReturnType<typeof createCityScene>;
}) {
  const graph = useMemo(() => createTrafficGraph(map.streets, map.junctions), [map]);
  const count = Math.min(14, Math.max(6, Math.round(graph.nodes.size / 4)));
  const [cars, setCars] = useState<Car[]>(() => spawnCars(graph, count));

  useEffect(() => {
    setCars(spawnCars(graph, count));
  }, [graph, count]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setCars((current) => advanceCars(graph, current, dt));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [graph]);

  if (cars.length === 0) return null;
  return <div className="city-traffic" aria-hidden="true">
    {cars.map((car) => {
      const pose = carPose(graph, car);
      const point = scene.project(pose.x, pose.z);
      const facing = spriteFacing(pose.dx, pose.dz);
      return <img
        key={car.id}
        className="city-car"
        src={carSpriteSrc(car.asset, facing)}
        alt=""
        draggable={false}
        style={{
          left: point.x,
          top: point.y,
          zIndex: Math.round((pose.x + pose.z) * 10) + 100,
          transform: carTransform(facing),
        }}
      />;
    })}
  </div>;
}

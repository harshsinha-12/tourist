"use client";

import { useEffect, useMemo, useState } from "react";
import {
  advanceShips,
  createShippingLane,
  shipPose,
  shipSpriteSrc,
  shipTransform,
  spawnShips,
  spriteFacing,
  type Ship,
} from "../lib/shipping";
import { seededRandom } from "../lib/traffic";
import type { createCityScene } from "../lib/city-scene";
import type { GroundPoint } from "../lib/city-map";

const CARGO_SPECS = [{ asset: "cargo-ship" as const, speed: 1.15 }];
const BOAT_SPECS = [
  { asset: "speedboat" as const, speed: 2.4 },
  { asset: "speedboat" as const, speed: 2.85 },
];

export function CityShips({ scene, harbor, navy }: {
  scene: ReturnType<typeof createCityScene>;
  harbor?: GroundPoint | undefined;
  navy?: GroundPoint | undefined;
}) {
  const docks = useMemo(() => ({ harbor, navy }), [harbor, navy]);
  const cargoLane = useMemo(
    () => createShippingLane(scene.maxX, scene.maxZ, docks, 4.1, 1.85),
    [scene.maxX, scene.maxZ, docks],
  );
  const boatLane = useMemo(
    () => createShippingLane(scene.maxX, scene.maxZ, docks, 2.6, 1.25),
    [scene.maxX, scene.maxZ, docks],
  );
  const [cargo, setCargo] = useState<Ship[]>(() => spawnShips(cargoLane, CARGO_SPECS, seededRandom(2)));
  const [boats, setBoats] = useState<Ship[]>(() => spawnShips(boatLane, BOAT_SPECS, seededRandom(3)));

  useEffect(() => {
    setCargo(spawnShips(cargoLane, CARGO_SPECS, seededRandom(2)));
  }, [cargoLane]);
  useEffect(() => {
    setBoats(spawnShips(boatLane, BOAT_SPECS, seededRandom(3)));
  }, [boatLane]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setCargo((current) => advanceShips(cargoLane, current, dt));
      setBoats((current) => advanceShips(boatLane, current, dt));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cargoLane, boatLane]);

  const vessels = [
    ...cargo.map((ship) => ({ ship, lane: cargoLane })),
    ...boats.map((ship) => ({ ship, lane: boatLane })),
  ];
  if (vessels.length === 0) return null;
  return <div className="city-ships" aria-hidden="true">
    {vessels.map(({ ship, lane }) => {
      const pose = shipPose(lane, ship);
      const point = scene.project(pose.x, pose.z);
      const facing = spriteFacing(pose.dx, pose.dz);
      return <img
        key={`${ship.asset}-${ship.id}`}
        className={`city-ship ${ship.asset}`}
        src={shipSpriteSrc(ship.asset, facing)}
        alt=""
        draggable={false}
        style={{
          left: point.x,
          top: point.y,
          zIndex: Math.round((pose.x + pose.z) * 10) + 40,
          transform: shipTransform(facing),
        }}
      />;
    })}
  </div>;
}

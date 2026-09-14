import { describe, expect, it } from "vitest";
import { generateCitySnapshot } from "@tourist/world-generator";
import { advanceShips, createShippingLane, shipPose, shipSpriteSrc, spawnShips, type Ship } from "./shipping";

function city() {
  return generateCitySnapshot({
    id: "ships", repository: { name: "ships", revision: "test" },
    files: Array.from({ length: 16 }, (_, index) => ({
      path: `src/file-${index}.ts`, language: "TypeScript", kind: "source" as const,
      linesOfCode: 20, changeFrequency: 0, state: "idle" as const,
    })),
  });
}

describe("coastal shipping", () => {
  it("keeps ships on a closed water loop and lets them stop at docks", () => {
    const snapshot = city();
    const harbor = snapshot.landmarks.find((item) => item.kind === "merge-harbor")!.position;
    const navy = snapshot.landmarks.find((item) => item.kind === "review-center")!.position;
    const lane = createShippingLane(snapshot.worldSize.width, snapshot.worldSize.depth, { harbor, navy }, 3.4, 1.5);
    expect(lane.graph.nodes.size).toBeGreaterThan(6);
    expect(lane.berths.size).toBe(2);
    expect([...lane.graph.nodes.values()].every((node) => node.neighbors.length > 0)).toBe(true);

    let random = 0;
    const next = () => (random = (random * 9301 + 49297) % 233280) / 233280;
    let ships = spawnShips(lane, [
      { asset: "cargo-ship", speed: 1.2 },
      { asset: "speedboat", speed: 2.5 },
    ], next);
    expect(ships).toHaveLength(2);

    for (let step = 0; step < 80; step++) {
      ships = advanceShips(lane, ships, 0.25, next);
      for (const ship of ships) {
        expect(lane.graph.nodes.has(ship.from)).toBe(true);
        expect(lane.graph.nodes.has(ship.to)).toBe(true);
        expect(ship.progress).toBeGreaterThanOrEqual(0);
        expect(ship.progress).toBeLessThan(1);
      }
    }

    const previous = ships.map((ship) => shipPose(lane, ship));
    ships = advanceShips(lane, ships, 0.05, next);
    ships.forEach((ship, index) => {
      if (ship.dwell > 0) return;
      const pose = shipPose(lane, ship);
      expect(Math.hypot(pose.x - previous[index]!.x, pose.z - previous[index]!.z)).toBeLessThan(0.4);
    });
  });

  it("pulls a cargo ship into a harbor berth and holds it there", () => {
    const snapshot = city();
    const harbor = snapshot.landmarks.find((item) => item.kind === "merge-harbor")!.position;
    const navy = snapshot.landmarks.find((item) => item.kind === "review-center")!.position;
    const lane = createShippingLane(snapshot.worldSize.width, snapshot.worldSize.depth, { harbor, navy }, 3.4, 1.5);
    const approach = [...lane.graph.nodes.values()].find((node) => node.neighbors.some((id) => lane.berths.has(id)));
    expect(approach).toBeTruthy();
    const inland = approach!.neighbors.find((id) => lane.berths.has(id))!;
    const seaward = approach!.neighbors.find((id) => id !== inland)!;
    let ships: Ship[] = [{
      id: 0, asset: "cargo-ship", from: seaward, to: approach!.id, progress: 0.5, speed: 8, dwell: 0,
    }];
    for (let step = 0; step < 60 && ships[0]!.dwell === 0; step++) {
      ships = advanceShips(lane, ships, 0.25, () => 0);
    }
    expect(ships[0]!.dwell).toBeGreaterThan(0);
    expect(lane.berths.has(ships[0]!.from)).toBe(true);
    const parked = shipPose(lane, ships[0]!);
    ships = advanceShips(lane, ships, 0.2, () => 0);
    const still = shipPose(lane, ships[0]!);
    expect(Math.hypot(still.x - parked.x, still.z - parked.z)).toBeLessThan(0.001);
  });

  it("uses rear sprites for ships sailing away from the camera", () => {
    expect(shipSpriteSrc("cargo-ship", "sw")).toBe("/assets/environment/cargo-ship.webp");
    expect(shipSpriteSrc("cargo-ship", "ne")).toBe("/assets/environment/cargo-ship-rear.webp");
    expect(shipSpriteSrc("speedboat", "nw")).toBe("/assets/environment/speedboat-rear.webp");
  });
});

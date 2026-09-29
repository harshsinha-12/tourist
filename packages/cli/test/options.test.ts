import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parseRunOptions } from "../src/options.js";

test("CLI accepts a validated opt-in swarm assignment", () => {
  const root = mkdtempSync(join(tmpdir(), "tourist-cli-parts-"));
  try {
    const path = join(root, "parts.json");
    writeFileSync(path, JSON.stringify([{ goal: "one", files: ["a.js"] }, { goal: "two", files: ["b.js"], testHints: ["b test"] }]));
    const options = parseRunOptions(["--repo", root, "--task", "Update both", "--swarm-parts", path]);
    expect(options.swarmParts).toHaveLength(2);
    expect(options.swarmParts?.[1]?.testHints).toEqual(["b test"]);
    expect(() => parseRunOptions(["--repo", root, "--task", "Update both", "--swarm-parts", path], "ask")).toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { expect, test } from "vitest";
import { runSoloTask } from "../src/agents/solo.js";

test.skipIf(process.env.RUN_LIVE_AGENT !== "1")("OpenAI solo coding agent completes a local fixture", async () => {
  loadEnvFile(resolve("../../.env.local"));
  const checkout = await mkdtemp(join(tmpdir(), "tourist-live-"));
  try {
    execFileSync("git", ["init", "-q", checkout]);
    await writeFile(join(checkout, "math.js"), "export function add(a, b) { return a - b; }\n");
    await writeFile(join(checkout, "math.test.js"), "import { test } from 'node:test'; import { strict as assert } from 'node:assert'; import { add } from './math.js'; test('adds two numbers', () => assert.equal(add(2, 3), 5));\n");
    await writeFile(join(checkout, "package.json"), '{"type":"module"}\n');
    execFileSync("git", ["-C", checkout, "add", "."]);
    execFileSync("git", ["-C", checkout, "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "initial"]);
    const run = await runSoloTask({ checkout, owner: "fixture", repo: "math", task: "Fix the bug in add so the included Node test passes. Read math.js first, edit it, and run tests.", model: { modelId: "gpt-6-luna" } });
    expect(run.commit).toMatch(/^[0-9a-f]+$/);
    expect(run.tools.some((entry) => entry.name === "read_file")).toBe(true);
    expect(run.tools.some((entry) => entry.name === "run_tests")).toBe(true);
    expect(await readFile(join(checkout, "math.js"), "utf8")).toContain("a + b");
  } finally { await rm(checkout, { recursive: true, force: true }); }
}, 180_000);

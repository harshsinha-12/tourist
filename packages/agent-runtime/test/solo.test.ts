import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV3 } from "ai/test";
import { expect, test } from "vitest";
import { runTask } from "../src/agents/runtime.js";

test("solo agent edits through the registry and leaves a tested local commit", async () => {
  const checkout = await mkdtemp(join(tmpdir(), "tourist-solo-"));
  try {
    execFileSync("git", ["init", "-q", checkout]);
    await writeFile(join(checkout, "math.js"), "export const add = (a, b) => a - b;\n");
    await writeFile(join(checkout, "math.test.js"), "import { test } from 'node:test'; import { strict as assert } from 'node:assert'; import { add } from './math.js'; test('adds', () => assert.equal(add(2, 3), 5));\n");
    await writeFile(join(checkout, "package.json"), '{"type":"module"}\n');
    execFileSync("git", ["-C", checkout, "add", "."]);
    execFileSync("git", ["-C", checkout, "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "initial"]);
    const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };
    const model = new MockLanguageModelV3({ doGenerate: [
      { content: [{ type: "tool-call", toolCallId: "call-1", toolName: "write_file", input: JSON.stringify({ path: "math.js", content: "export const add = (a, b) => a + b;\n" }) }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] },
      { content: [{ type: "text", text: "Fixed addition and ran tests." }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] },
    ] });
    const run = await runTask({ checkout, owner: "fixture", repo: "math", task: "Make add return a plus b", languageModel: model, model: { apiKey: "test-secret-must-not-appear" } });
    expect(run.topology).toBe("solo_coder");
    expect(run.agents).toEqual(["coder"]);
    expect(run.tools.some((entry) => entry.name === "write_file")).toBe(true);
    expect(run.tools.some((entry) => entry.name === "run_tests" && entry.result.exitCode === 0)).toBe(true);
    expect(run.githubCalls[0]?.name).toBe("create_pull_request");
    expect(JSON.stringify(run)).not.toContain("test-secret-must-not-appear");
    expect(run.commit).toMatch(/^[0-9a-f]+$/);
    expect(await readFile(join(checkout, "math.js"), "utf8")).toContain("a + b");
    expect(execFileSync("git", ["-C", checkout, "branch", "--show-current"], { encoding: "utf8" }).trim()).toBe(run.branch);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

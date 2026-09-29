import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV3 } from "ai/test";
import { expect, test } from "vitest";
import { chooseTopology } from "../src/agents/roles.js";
import { runTeamTask } from "../src/agents/team.js";

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };
const reply = (text: string) => ({ content: [{ type: "text" as const, text }], finishReason: { unified: "stop" as const, raw: "stop" }, usage, warnings: [] });
const call = (name: string, input: object, n: number) => ({ content: [{ type: "tool-call" as const, toolCallId: `call-${n}`, toolName: name, input: JSON.stringify(input) }], finishReason: { unified: "tool-calls" as const, raw: "tool_calls" }, usage, warnings: [] });

test("supervisor chooses a small task without specialist handoffs", () => {
  expect(chooseTopology("Rename a variable")).toBe("solo_coder");
  expect(chooseTopology("Fix the addition bug and add regression coverage")).toBe("coder_tester_reviewer");
  expect(chooseTopology("Change one file", [{ files: ["one.js"] }])).not.toBe("swarm");
  expect(chooseTopology("Change two files", [{ files: ["one.js"] }, { files: ["two.js"] }])).toBe("swarm");
});

test("coder, tester, and reviewer share task memory in order", async () => {
  const checkout = await mkdtemp(join(tmpdir(), "tourist-team-"));
  try {
    execFileSync("git", ["init", "-q", checkout]);
    await writeFile(join(checkout, "math.js"), "export const add = (a, b) => a - b;\n");
    await writeFile(join(checkout, "math.test.js"), "import { test } from 'node:test'; import { strict as assert } from 'node:assert'; import { add } from './math.js'; test('adds', () => assert.equal(add(2, 3), 5));\n");
    await writeFile(join(checkout, "package.json"), '{"type":"module"}\n');
    execFileSync("git", ["-C", checkout, "add", "."]);
    execFileSync("git", ["-C", checkout, "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "initial"]);
    const model = new MockLanguageModelV3({ doGenerate: [
      call("write_file", { path: "math.js", content: "export const add = (a, b) => a + b;\n" }, 1), reply("Fixed add in math.js."),
      call("run_tests", {}, 2), reply("Tests pass."),
      call("git_diff", {}, 3), reply("ACCEPT: correct fix and covered by test."),
    ] });
    const run = await runTeamTask({ checkout, owner: "fixture", repo: "math", task: "Fix the addition bug", languageModel: model });
    expect(run.agents).toEqual(["coder", "tester", "reviewer"]);
    expect(run.taskMemory.filesTouched).toContain("math.js");
    expect(run.taskMemory.decisions).toHaveLength(3);
    expect(run.tools.map((entry) => entry.name)).toContain("git_diff");
    expect(run.commit).toMatch(/^[0-9a-f]+$/);
    expect(run.githubCalls[0]?.name).toBe("create_pull_request");
    const prompts = model.doGenerateCalls.map((request) => JSON.stringify(request.prompt));
    expect(prompts.some((prompt) => prompt.includes("Fixed add in math.js."))).toBe(true);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test("reviewer can return work to the coder once", async () => {
  const checkout = await mkdtemp(join(tmpdir(), "tourist-review-"));
  try {
    execFileSync("git", ["init", "-q", checkout]);
    await writeFile(join(checkout, "math.js"), "export const add = (a, b) => a - b;\n");
    await writeFile(join(checkout, "math.test.js"), "import { test } from 'node:test'; import { strict as assert } from 'node:assert'; import { add } from './math.js'; test('adds', () => assert.equal(add(2, 3), 5));\n");
    await writeFile(join(checkout, "package.json"), '{"type":"module"}\n');
    execFileSync("git", ["-C", checkout, "add", "."]);
    execFileSync("git", ["-C", checkout, "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "initial"]);
    const model = new MockLanguageModelV3({ doGenerate: [
      call("write_file", { path: "math.js", content: "export const add = (a, b) => a + b; // TODO\n" }, 1), reply("Fixed add."),
      reply("Tests pass."), reply("CHANGES_REQUIRED: remove TODO comment."),
      call("write_file", { path: "math.js", content: "export const add = (a, b) => a + b;\n" }, 2), reply("Removed TODO."),
      reply("Tests pass."), reply("ACCEPT: focused fix."),
    ] });
    const run = await runTeamTask({ checkout, owner: "fixture", repo: "math", task: "Fix the addition bug", languageModel: model });
    expect(run.agents).toEqual(["coder", "tester", "reviewer", "coder", "tester", "reviewer"]);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV3 } from "ai/test";
import { expect, test } from "vitest";
import { runTask } from "../src/agents/runtime.js";
import { swarmPartsSchema } from "../src/agents/swarm.js";

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };
function model(path: string, content: string) {
  return new MockLanguageModelV3({ doGenerate: [
    { content: [{ type: "tool-call", toolCallId: `write-${path}`, toolName: "write_file", input: JSON.stringify({ path, content }) }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] },
    { content: [{ type: "text", text: `Updated ${path}` }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] },
  ] });
}

test("two coders run in isolated worktrees and integrate into one tested branch", async () => {
  const checkout = await mkdtemp(join(tmpdir(), "tourist-swarm-test-"));
  try {
    execFileSync("git", ["init", "-q", checkout]);
    await writeFile(join(checkout, "a.js"), "export const a = 0;\n");
    await writeFile(join(checkout, "b.js"), "export const b = 0;\n");
    await writeFile(join(checkout, "both.test.js"), "import { test } from 'node:test'; import { strict as assert } from 'node:assert'; import { a } from './a.js'; import { b } from './b.js'; test('both', () => { assert.equal(a, 1); assert.equal(b, 2); });\n");
    await writeFile(join(checkout, "package.json"), '{"type":"module"}\n');
    execFileSync("git", ["-C", checkout, "add", "."]);
    execFileSync("git", ["-C", checkout, "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "initial"]);
    const events: string[] = [];
    const run = await runTask({
      checkout, task: "Update both modules", owner: "fixture", repo: "both",
      languageModel: model("a.js", "export const a = 1;\n"),
      partLanguageModels: [model("a.js", "export const a = 1;\n"), model("b.js", "export const b = 2;\n")],
      swarmParts: [{ goal: "Update a", files: ["a.js"] }, { goal: "Update b", files: ["b.js"] }],
      onEvent: (event) => { events.push(`${event.type}:${event.agent ?? ""}`); },
    });
    expect(run.topology).toBe("swarm");
    expect(run.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(run.tools.filter((tool) => tool.name === "git_merge_part")).toHaveLength(2);
    expect(run.tools.some((tool) => tool.name === "run_tests" && tool.result.exitCode === 0)).toBe(true);
    expect(events).toContain("agent.spawned:integration");
    expect(events).toContain("test.passed:tester");
    expect(await readFile(join(checkout, "a.js"), "utf8")).toContain("= 1");
    expect(await readFile(join(checkout, "b.js"), "utf8")).toContain("= 2");
    expect(execFileSync("git", ["-C", checkout, "worktree", "list"], { encoding: "utf8" }).trim().split("\n")).toHaveLength(1);
    expect(execFileSync("git", ["-C", checkout, "branch", "--list", "tourist/*"], { encoding: "utf8" }).trim().split("\n")).toHaveLength(1);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test("swarm decomposition rejects overlapping and unsafe assignments", () => {
  expect(() => swarmPartsSchema.parse([{ goal: "a", files: ["a.js"] }, { goal: "b", files: ["a.js"] }])).toThrow();
  expect(() => swarmPartsSchema.parse([{ goal: "a", files: ["../a.js"] }, { goal: "b", files: ["b.js"] }])).toThrow();
});

test("an integrated test failure returns only the owning part for one correction", async () => {
  const checkout = await mkdtemp(join(tmpdir(), "tourist-swarm-repair-"));
  try {
    execFileSync("git", ["init", "-q", checkout]);
    await writeFile(join(checkout, "a.js"), "export const a = 0;\n");
    await writeFile(join(checkout, "b.js"), "export const b = 0;\n");
    await writeFile(join(checkout, "both.test.js"), "import { test } from 'node:test'; import { strict as assert } from 'node:assert'; import { a } from './a.js'; import { b } from './b.js'; test('b result', () => { assert.equal(a, 1); assert.equal(b, 2); });\n");
    await writeFile(join(checkout, "package.json"), '{"type":"module"}\n');
    execFileSync("git", ["-C", checkout, "add", "."]);
    execFileSync("git", ["-C", checkout, "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "initial"]);
    const bModel = new MockLanguageModelV3({ doGenerate: [
      { content: [{ type: "tool-call", toolCallId: "first", toolName: "write_file", input: JSON.stringify({ path: "b.js", content: "export const b = 1;\n" }) }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] },
      { content: [{ type: "text", text: "Changed b" }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] },
      { content: [{ type: "tool-call", toolCallId: "repair", toolName: "write_file", input: JSON.stringify({ path: "b.js", content: "export const b = 2;\n" }) }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] },
      { content: [{ type: "text", text: "Corrected b" }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] },
    ] });
    const run = await runTask({
      checkout, task: "Update both values", owner: "fixture", repo: "both", languageModel: model("a.js", "export const a = 1;\n"),
      partLanguageModels: [model("a.js", "export const a = 1;\n"), bModel],
      swarmParts: [{ goal: "Update a", files: ["a.js"] }, { goal: "Update b", files: ["b.js"], testHints: ["b result"] }],
    });
    expect(run.topology).toBe("swarm");
    expect(run.taskMemory.decisions.some((decision) => decision.includes("returned to coder:2"))).toBe(true);
    expect(run.events.some((event) => event.type === "test.failed")).toBe(true);
    expect(run.events.some((event) => event.type === "test.passed")).toBe(true);
    expect(await readFile(join(checkout, "b.js"), "utf8")).toContain("= 2");
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test("a merge conflict returns the conflicting part to its coder once", async () => {
  const checkout = await mkdtemp(join(tmpdir(), "tourist-swarm-conflict-"));
  try {
    execFileSync("git", ["init", "-q", checkout]);
    await writeFile(join(checkout, "a.js"), "export const a = 0;\n");
    await writeFile(join(checkout, "b.js"), "export const b = 0;\n");
    await writeFile(join(checkout, "both.test.js"), "import { test } from 'node:test'; import { strict as assert } from 'node:assert'; import { a } from './a.js'; import { b } from './b.js'; test('both', () => { assert.equal(a, 1); assert.equal(b, 2); });\n");
    await writeFile(join(checkout, "package.json"), '{"type":"module"}\n');
    execFileSync("git", ["-C", checkout, "add", "."]);
    execFileSync("git", ["-C", checkout, "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "initial"]);
    const bModel = new MockLanguageModelV3({ doGenerate: [
      { content: [{ type: "tool-call", toolCallId: "first", toolName: "write_file", input: JSON.stringify({ path: "b.js", content: "export const b = 2;\n" }) }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] },
      { content: [{ type: "text", text: "Changed b" }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] },
      { content: [{ type: "tool-call", toolCallId: "repair", toolName: "write_file", input: JSON.stringify({ path: "b.js", content: "export const b = 2;\n" }) }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] },
      { content: [{ type: "text", text: "Resolved b" }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] },
    ] });
    const run = await runTask({
      checkout, task: "Update both values", owner: "fixture", repo: "both", languageModel: model("a.js", "export const a = 1;\n"),
      partLanguageModels: [model("a.js", "export const a = 1;\n"), bModel],
      swarmParts: [{ goal: "Update a", files: ["a.js"] }, { goal: "Update b", files: ["b.js"] }],
      onEvent: async (event) => {
        if (event.type !== "agent.spawned" || event.agent !== "integration") return;
        await writeFile(join(checkout, "b.js"), "export const b = 3;\n");
        execFileSync("git", ["-C", checkout, "add", "b.js"]);
        execFileSync("git", ["-C", checkout, "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "fixture competing edit"]);
      },
    });
    expect(run.topology).toBe("swarm");
    expect(run.tools.some((tool) => tool.name === "git_merge_abort" && tool.result.exitCode === 0)).toBe(true);
    expect(run.taskMemory.decisions.some((decision) => decision.includes("conflict returned to coder:2"))).toBe(true);
    expect(await readFile(join(checkout, "b.js"), "utf8")).toContain("= 2");
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

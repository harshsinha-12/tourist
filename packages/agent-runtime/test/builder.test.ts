import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createToolRegistry } from "../src/tools/registry.js";
import { execFileSync } from "node:child_process";
import { MockLanguageModelV3 } from "ai/test";
import { runTask } from "../src/agents/runtime.js";

test("a manifest is tested before its run-scoped tool is registered", async () => {
  const checkout = await mkdtemp(join(tmpdir(), "tourist-builder-"));
  try {
    await writeFile(join(checkout, "sample.txt"), "one\ntwo\n");
    const registry = createToolRegistry(checkout);
    const manifest = { id: "local_count_lines", description: "Count lines in a local file", operation: "count_lines", fixtures: [{ path: "sample.txt", expected: 3 }] };
    await expect(registry.invoke("build_tool", manifest)).rejects.toThrow("Tool fixture failed");
    expect(registry.list().some((tool) => tool.id === "local_count_lines")).toBe(false);
    await registry.invoke("build_tool", { ...manifest, fixtures: [{ path: "sample.txt", expected: 2 }] });
    expect(await registry.invoke("local_count_lines", { path: "sample.txt" })).toEqual({ path: "sample.txt", lines: 2 });
    expect(createToolRegistry(checkout).list().some((tool) => tool.id === "local_count_lines")).toBe(false);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test("a coder can call a newly built tool on its next model phase", async () => {
  const checkout = await mkdtemp(join(tmpdir(), "tourist-builder-run-"));
  try {
    execFileSync("git", ["init", "-q", checkout]);
    await writeFile(join(checkout, "sample.txt"), "one\ntwo\n");
    await writeFile(join(checkout, "package.json"), '{"type":"module"}\n');
    execFileSync("git", ["-C", checkout, "add", "."]);
    execFileSync("git", ["-C", checkout, "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "initial"]);
    const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };
    const call = (toolName: string, input: object, id: number) => ({ content: [{ type: "tool-call" as const, toolCallId: `call-${id}`, toolName, input: JSON.stringify(input) }], finishReason: { unified: "tool-calls" as const, raw: "tool_calls" }, usage, warnings: [] });
    const reply = (text: string) => ({ content: [{ type: "text" as const, text }], finishReason: { unified: "stop" as const, raw: "stop" }, usage, warnings: [] });
    const model = new MockLanguageModelV3({ doGenerate: [
      call("build_tool", { id: "local_count_lines", description: "Count lines in a local file", operation: "count_lines", fixtures: [{ path: "sample.txt", expected: 2 }] }, 1),
      reply("Tool registered."),
      call("local_count_lines", { path: "sample.txt" }, 2),
      call("write_file", { path: "sample.txt", content: "one\ntwo\nthree\n" }, 3),
      reply("Used the tool and updated the file."),
    ] });
    const run = await runTask({ checkout, task: "Add a third sample line", owner: "fixture", repo: "sample", languageModel: model });
    expect(run.tools.map((entry) => entry.name)).toContain("local_count_lines");
    expect(run.tools.find((entry) => entry.name === "local_count_lines")?.result.lines).toBe(2);
    expect(run.taskMemory.decisions.some((decision) => decision.includes("local_count_lines"))).toBe(true);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

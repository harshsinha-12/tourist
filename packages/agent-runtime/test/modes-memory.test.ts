import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV3 } from "ai/test";
import { expect, test } from "vitest";
import { runAgentRequest } from "../src/agents/modes.js";
import { MemoryStore } from "../src/memory/store.js";

test("plan and ask expose read-only tools and leave checkout clean", async () => {
  const checkout = await mkdtemp(join(tmpdir(), "tourist-modes-"));
  try {
    execFileSync("git", ["init", "-q", checkout]);
    await writeFile(join(checkout, "README.md"), "Fixture repository\n");
    execFileSync("git", ["-C", checkout, "add", "."]);
    execFileSync("git", ["-C", checkout, "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "initial"]);
    const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };
    for (const mode of ["plan", "ask"] as const) {
      const model = new MockLanguageModelV3({ doGenerate: async ({ tools }) => {
        expect(tools?.map((tool) => tool.name)).toEqual(["read_file", "search", "git_status", "git_diff"]);
        return { content: [{ type: "text", text: "Inspect README.md" }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] };
      } });
      const run = await runAgentRequest({ checkout, owner: "fixture", repo: "repo", task: "Explain fixture", mode, languageModel: model });
      expect("answer" in run && run.answer).toContain("README.md");
      expect(execFileSync("git", ["-C", checkout, "status", "--porcelain"], { encoding: "utf8" })).toBe("");
    }
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test("memory retrieval stays scoped and bounded", async () => {
  const root = await mkdtemp(join(tmpdir(), "tourist-memory-"));
  try {
    const store = new MemoryStore(join(root, "notes.json"));
    const user = await store.add("user", "a/repo", "Prefer small testable changes");
    await store.add("codebase", "a/repo", "The API uses zod validation");
    await store.add("codebase", "b/repo", "Secret architecture note");
    const found = await store.retrieve("a/repo", "How does API validation work?", 2);
    expect(found).toHaveLength(2);
    expect(found.some((note) => note.text.includes("zod"))).toBe(true);
    expect(found.some((note) => note.text.includes("Secret"))).toBe(false);
    expect(await store.remove("b/repo", user.id)).toBe(true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

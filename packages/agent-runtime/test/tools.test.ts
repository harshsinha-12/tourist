import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { rm } from "node:fs/promises";
import { createToolRegistry } from "../src/tools/registry.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "tourist-agent-"));
  directories.push(directory);
  execFileSync("git", ["init", "-q", directory]);
  await writeFile(join(directory, "math.js"), "export function add(a, b) { return a - b; }\n");
  await writeFile(join(directory, "math.test.js"), "import { test } from 'node:test';\nimport { strict as assert } from 'node:assert';\nimport { add } from './math.js';\ntest('adds', () => assert.equal(add(2, 3), 5));\n");
  await writeFile(join(directory, "package.json"), '{"type":"module"}\n');
  execFileSync("git", ["-C", directory, "add", "."]);
  execFileSync("git", ["-C", directory, "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "commit", "-qm", "initial"]);
  return directory;
}

test("stage 1 tool chain edits, tests, commits, and records a PR locally", async () => {
  const checkout = await fixture();
  const githubCalls: Array<{ name: string; input: unknown }> = [];
  const registry = createToolRegistry(checkout, githubCalls);
  expect(registry.list().find((tool) => tool.id === "write_file")?.inputSchema).toHaveProperty("type", "object");
  expect((await registry.invoke("read_file", { path: "math.js" }) as { content: string }).content).toContain("a - b");
  expect((await registry.invoke("run_tests", {}) as { exitCode: number }).exitCode).not.toBe(0);
  expect((await registry.invoke("git_branch", { name: "tourist/task-fix-add" }) as { exitCode: number }).exitCode).toBe(0);
  await registry.invoke("write_file", { path: "math.js", content: "export function add(a, b) { return a + b; }\n" });
  expect((await registry.invoke("search", { query: "a + b" }) as { matches: string }).matches).toContain("math.js");
  expect((await registry.invoke("run_tests", {}) as { exitCode: number }).exitCode).toBe(0);
  expect((await registry.invoke("git_diff", {}) as { stdout: string }).stdout).toContain("+ b");
  expect((await registry.invoke("git_commit", { message: "Fix addition" }) as { exitCode: number }).exitCode).toBe(0);
  await registry.invoke("create_pull_request", { owner: "fixture", repo: "math", head: "tourist/task-fix-add", base: "main", title: "Fix addition", body: "Local fixture fix" });
  expect(githubCalls).toHaveLength(1);
  expect(githubCalls[0]?.name).toBe("create_pull_request");
  expect(execFileSync("git", ["-C", checkout, "log", "-1", "--format=%s"], { encoding: "utf8" }).trim()).toBe("Fix addition");
});

test("tools reject checkout escapes and arbitrary commands", async () => {
  const checkout = await fixture();
  const registry = createToolRegistry(checkout);
  await expect(registry.invoke("read_file", { path: "../secret" })).rejects.toThrow();
  await expect(registry.invoke("write_file", { path: "../secret", content: "oops" })).rejects.toThrow();
  await expect(registry.invoke("shell", { program: "npm", args: ["publish"] })).rejects.toThrow();
  await expect(registry.invoke("git_commit", { message: "No task branch" })).rejects.toThrow();
  expect(await readFile(join(checkout, "math.js"), "utf8")).toContain("a - b");
});

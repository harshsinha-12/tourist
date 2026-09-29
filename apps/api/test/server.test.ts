import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { createApiServer } from "../src/server.js";
import { RunStore } from "../src/store.js";
import type { CloudExecutor } from "../src/daytona-executor.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

test("cloud API records a read-only run and exposes activity without the model key", async () => {
  const root = await mkdtemp(join(tmpdir(), "tourist-api-"));
  const executor: CloudExecutor = { async execute(input, _key, onEvent) {
    await onEvent?.({ type: "tool", at: new Date().toISOString(), trace: { name: "read_file", input: { path: "README.md" } } });
    return { run: { mode: input.mode, answer: "README.md explains the repo", usage: { inputTokens: 2, outputTokens: 3 } }, patch: "" };
  } };
  const server = await createApiServer({ store: new RunStore(root), executor, token: "test-token" });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await rm(root, { recursive: true, force: true }); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  const base = `http://127.0.0.1:${address.port}`;
  const unauthorized = await fetch(`${base}/v1/runs`);
  expect(unauthorized.status).toBe(401);
  const submitted = await fetch(`${base}/v1/runs`, { method: "POST", headers: { authorization: "Bearer test-token", "x-model-api-key": "secret-key", "content-type": "application/json" }, body: JSON.stringify({ repo: "owner/repo", task: "Explain README", modelId: "gpt-6-sol", mode: "ask" }) });
  expect(submitted.status).toBe(202);
  const { id } = await submitted.json() as { id: string };
  let run: Record<string, unknown> = {};
  for (let i = 0; i < 20; i++) {
    run = await (await fetch(`${base}/v1/runs/${id}`, { headers: { authorization: "Bearer test-token" } })).json() as Record<string, unknown>;
    if (run.status === "succeeded") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(run.status).toBe("succeeded");
  expect(JSON.stringify(run)).not.toContain("secret-key");
  expect(run.reward_v1).toMatchObject({ completed: true, testsPassed: null, diffProduced: false });
  const events = await (await fetch(`${base}/v1/runs/${id}/events`, { headers: { authorization: "Bearer test-token" } })).json() as { events: unknown[] };
  expect(events.events).toHaveLength(2);
});

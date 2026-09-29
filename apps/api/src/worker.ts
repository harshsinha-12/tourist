import { execFile } from "node:child_process";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { runAgentRequest } from "../../../packages/agent-runtime/src/agents/modes.js";
import { parseSubmission } from "./contracts.js";

const execFileAsync = promisify(execFile);

export async function runWorker(taskPath: string, resultPath: string): Promise<void> {
  const input = parseSubmission(JSON.parse(await readFile(taskPath, "utf8")));
  const [owner, repo] = input.repo.split("/") as [string, string];
  const checkout = process.env.TOURIST_CHECKOUT ?? "/workspace/repo";
  const eventPath = process.env.TOURIST_EVENTS_FILE;
  const run = await runAgentRequest({
    checkout, owner, repo, task: input.task, mode: input.mode, ...(input.memoryPack ? { memoryPack: input.memoryPack } : {}),
    ...(input.swarmParts ? { swarmParts: input.swarmParts } : {}),
    ...(eventPath ? { onTool: async (trace: unknown) => { await appendFile(eventPath, `${JSON.stringify({ type: "tool", at: new Date().toISOString(), trace })}\n`); } } : {}),
    ...(eventPath ? { onEvent: async (event: unknown) => { await appendFile(eventPath, `${JSON.stringify({ type: "agent_event", at: new Date().toISOString(), event })}\n`); } } : {}),
    model: { modelId: input.modelId, ...(input.reasoningLevel ? { reasoningLevel: input.reasoningLevel } : {}) },
  });
  const patch = input.mode === "ask" || input.mode === "plan" ? "" : (await execFileAsync("git", ["-C", checkout, "format-patch", "-1", "--stdout"], { maxBuffer: 5_000_000 })).stdout;
  await writeFile(resultPath, `${JSON.stringify({ run, patch })}\n`, { mode: 0o600 });
}

if (require.main === module) {
  const [taskPath, resultPath] = process.argv.slice(2);
  if (!taskPath || !resultPath) process.exitCode = 2;
  else runWorker(taskPath, resultPath).catch(() => { process.exitCode = 1; });
}

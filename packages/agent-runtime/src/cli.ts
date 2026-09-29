import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { runTask } from "./agents/runtime.js";
import { getModelConfig, type ModelId } from "./models/config.js";

const [checkout, owner, repo, modelArg, ...taskParts] = process.argv.slice(2);
if (!checkout || !owner || !repo || !modelArg || taskParts.length === 0) {
  console.error("Usage: pnpm --filter @tourist/agent-runtime fixture <checkout> <owner> <repo> <model-id> <task...> (load the key into the environment first)");
  process.exitCode = 2;
} else {
  try {
    const localEnv = resolve(import.meta.dirname, "../../../.env.local");
    if (existsSync(localEnv)) loadEnvFile(localEnv);
    getModelConfig(modelArg);
    const result = await runTask({ checkout, owner, repo, model: { modelId: modelArg as ModelId }, task: taskParts.join(" ") });
    const outputPath = resolve(checkout, ".git", "tourist-last-run.json");
    await writeFile(outputPath, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ id: result.id, topology: result.topology, branch: result.branch, commit: result.commit, modelId: result.modelId, outputPath }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Agent run failed");
    process.exitCode = 1;
  }
}

import { randomUUID } from "node:crypto";
import { generateText, stepCountIs, type LanguageModel } from "ai";
import { AGENT_ROLES, type AgentRole, type TaskMemory } from "./roles.js";
import { aiTools, invokeTraced, requireSuccess, type SoloTask, type ToolTrace } from "./solo.js";
import { DEFAULT_MODEL, type ModelId, type ProviderId } from "../models/config.js";
import { resolveModel } from "../models/router.js";
import { createToolRegistry } from "../tools/registry.js";
import { checkoutRoot } from "../tools/utils.js";

export interface TeamRun {
  id: string;
  topology: "coder_tester_reviewer";
  modelId: ModelId;
  provider: ProviderId;
  branch: string;
  commit: string;
  agents: AgentRole[];
  taskMemory: TaskMemory;
  tools: ToolTrace[];
  githubCalls: Array<{ name: string; input: unknown }>;
  usage: { inputTokens: number; outputTokens: number };
}

export async function runTeamTask(task: SoloTask): Promise<TeamRun> {
  if (!task.task.trim()) throw new Error("Task text is required");
  const checkout = await checkoutRoot(task.checkout);
  const githubCalls: TeamRun["githubCalls"] = [];
  const registry = createToolRegistry(checkout, githubCalls);
  const traces: ToolTrace[] = [];
  const invoke = (name: string, input: Record<string, unknown>) => invokeTraced(registry, traces, name, input, task.onTool);
  const status = await invoke("git_status", {});
  requireSuccess(status, "git status");
  if (status.stdout.split("\n").slice(1).some((line) => line.trim())) throw new Error("The checkout must be clean before an agent run");
  const base = task.baseBranch ?? status.stdout.match(/^## ([^\s.]+)/)?.[1] ?? "main";
  const chosen = task.languageModel
    ? { model: task.languageModel, modelId: task.model?.modelId ?? DEFAULT_MODEL, provider: (task.model?.modelId ?? DEFAULT_MODEL).startsWith("claude-") ? "anthropic" as const : (task.model?.modelId ?? DEFAULT_MODEL).startsWith("gemini-") ? "google" as const : "openai" as const, providerOptions: {} }
    : resolveModel(task.model);
  const id = randomUUID();
  const branch = `tourist/task-${id.slice(0, 12)}`;
  requireSuccess(await invoke("git_branch", { name: branch }), "branch creation");

  const memory: TaskMemory = { goal: task.task, decisions: [], filesTouched: [], openQuestions: [], memoryPack: (task.memoryPack ?? []).slice(0, 8) };
  const agents: AgentRole[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  const runAgent = async (role: Exclude<AgentRole, "supervisor">, instruction = "") => {
    agents.push(role);
    const definition = AGENT_ROLES[role];
    const result = await generateText({
      model: chosen.model as LanguageModel,
      providerOptions: chosen.providerOptions,
      system: `${definition.instructions}\nOnly shared task memory is provided, not another agent's transcript.\n${instruction}`,
      prompt: JSON.stringify(memory),
      tools: aiTools(registry, traces, definition.tools, task.onTool),
      stopWhen: stepCountIs(15),
      maxOutputTokens: 1_500,
    });
    memory.decisions.push(`${role}: ${result.text.slice(0, 500)}`);
    usage.inputTokens += result.totalUsage.inputTokens ?? 0;
    usage.outputTokens += result.totalUsage.outputTokens ?? 0;
    return result.text;
  };

  await runAgent("coder");
  const changed = await invoke("git_status", {});
  requireSuccess(changed, "git status");
  memory.filesTouched = changed.stdout.split("\n").slice(1).map((line) => line.slice(3).trim()).filter(Boolean);
  if (memory.filesTouched.length === 0) throw new Error("Coder finished without a code change");
  await runAgent("tester");
  let review = await runAgent("reviewer");
  if (review.trim().startsWith("CHANGES_REQUIRED")) {
    await runAgent("coder", `Address this review exactly once: ${review.slice(0, 500)}`);
    await runAgent("tester");
    review = await runAgent("reviewer");
  }
  if (!review.trim().startsWith("ACCEPT")) throw new Error(`Review did not accept the change: ${review.slice(0, 300)}`);
  const tests = await invoke("run_tests", {});
  requireSuccess(tests, "final tests");
  const committed = await invoke("git_commit", { message: `Tourist: ${task.task.trim().slice(0, 100)}` });
  requireSuccess(committed, "local commit");
  const commit = String(committed.stdout).match(/\[[^\]]+ ([0-9a-f]+)\]/)?.[1] ?? "";
  await invoke("create_pull_request", { owner: task.owner, repo: task.repo, head: branch, base, title: task.task.trim().slice(0, 100), body: memory.decisions.join("\n") });
  return { id, topology: "coder_tester_reviewer", modelId: chosen.modelId, provider: chosen.provider, branch, commit, agents, taskMemory: memory, tools: traces, githubCalls, usage };
}

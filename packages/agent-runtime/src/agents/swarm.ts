import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateText, stepCountIs, type LanguageModel } from "ai";
import { z } from "zod";
import { AGENT_ROLES, type TaskMemory } from "./roles.js";
import { aiTools, invokeTraced, requireSuccess, type SoloTask, type ToolTrace } from "./solo.js";
import { DEFAULT_MODEL } from "../models/config.js";
import { resolveModel } from "../models/router.js";
import { createToolRegistry } from "../tools/registry.js";
import { checkoutRoot } from "../tools/utils.js";

const partSchema = z.object({
  goal: z.string().trim().min(1).max(1_000),
  files: z.array(z.string().min(1).regex(/^(?!\/)(?!.*(?:^|\/)\.\.\/)(?!.*(?:^|\/)\.git(?:\/|$))(?!.*(?:^|\/)\.env)(?!.*\.pem$)[\w./-]+$/)).min(1).max(20),
  testHints: z.array(z.string().min(2).max(100)).max(8).optional(),
}).strict();
export const swarmPartsSchema = z.array(partSchema).min(2).max(4).superRefine((parts, context) => {
  const seen = new Set<string>();
  for (const [index, part] of parts.entries()) for (const file of part.files) {
    const normalized = file.replace(/^\.\//, "");
    if (seen.has(normalized)) context.addIssue({ code: "custom", message: `File assigned twice: ${normalized}`, path: [index, "files"] });
    seen.add(normalized);
  }
});

export interface SwarmRun {
  id: string;
  topology: "swarm";
  modelId: string;
  provider: string;
  branch: string;
  commit: string;
  agents: string[];
  taskMemory: TaskMemory;
  tools: ToolTrace[];
  githubCalls: Array<{ name: string; input: unknown }>;
  usage: { inputTokens: number; outputTokens: number };
}

export async function runSwarmTask(task: SoloTask): Promise<SwarmRun> {
  const parts = swarmPartsSchema.parse(task.swarmParts);
  const checkout = await checkoutRoot(task.checkout);
  const githubCalls: SwarmRun["githubCalls"] = [];
  const rootRegistry = createToolRegistry(checkout, githubCalls);
  const traces: ToolTrace[] = [];
  const invokeRoot = (name: string, input: Record<string, unknown>) => invokeTraced(rootRegistry, traces, name, input, task.onTool);
  const status = await invokeRoot("git_status", {});
  requireSuccess(status, "git status");
  if (status.stdout.split("\n").slice(1).some((line) => line.trim())) throw new Error("The checkout must be clean before an agent run");
  const base = task.baseBranch ?? status.stdout.match(/^## ([^\s.]+)/)?.[1] ?? "main";
  const chosen = task.languageModel
    ? { model: task.languageModel, modelId: task.model?.modelId ?? DEFAULT_MODEL, provider: "openai", providerOptions: {} }
    : resolveModel(task.model);
  const id = randomUUID();
  const branch = `tourist/task-${id.slice(0, 12)}`;
  const memory: TaskMemory = { goal: task.task, decisions: ["supervisor: opt-in disjoint decomposition"], filesTouched: [], openQuestions: [], memoryPack: (task.memoryPack ?? []).slice(0, 8), decomposition: parts };
  const agents = ["supervisor", ...parts.map((_, index) => `coder:${index + 1}`), "integration", "tester"];
  const usage = { inputTokens: 0, outputTokens: 0 };
  const temporary = await mkdtemp(join(tmpdir(), "tourist-swarm-"));
  const worktrees = parts.map((_, index) => join(temporary, `part-${index + 1}`));
  const partBranches = parts.map((_, index) => `${branch}-part-${index + 1}`);
  let completed = false;
  const emit = async (type: "agent.spawned" | "file.changed" | "test.passed" | "test.failed", agent?: string, path?: string) => task.onEvent?.({ type, at: new Date().toISOString(), ...(agent ? { agent } : {}), ...(path ? { path } : {}) });
  try {
    await emit("agent.spawned", "supervisor");
    for (let index = 0; index < parts.length; index++) requireSuccess(await invokeRoot("git_worktree_add", { path: worktrees[index], branch: partBranches[index] }), "worktree creation");
    const responses = await Promise.all(parts.map(async (part, index) => {
      const agent = `coder:${index + 1}`;
      await emit("agent.spawned", agent);
      const registry = createToolRegistry(worktrees[index]!, githubCalls, part.files);
      const response = await generateText({
        model: task.partLanguageModels?.[index] ?? chosen.model as LanguageModel,
        providerOptions: chosen.providerOptions,
        system: `${AGENT_ROLES.coder.instructions}\nYour assigned files are ${JSON.stringify(part.files)}. Write only these files. Shared task memory is your only handoff.`,
        prompt: JSON.stringify({ ...memory, assignedPart: part }),
        tools: aiTools(registry, traces, AGENT_ROLES.coder.tools, task.onTool),
        stopWhen: stepCountIs(15), maxOutputTokens: 1_500,
      });
      const invoke = (name: string, input: Record<string, unknown>) => invokeTraced(registry, traces, name, input, task.onTool);
      const changed = await invoke("git_status", {});
      requireSuccess(changed, "part status");
      if (!changed.stdout.split("\n").slice(1).some((line) => line.trim())) throw new Error(`${agent} made no code change`);
      requireSuccess(await invoke("git_commit", { message: `Tourist part ${index + 1}: ${part.goal.slice(0, 90)}` }), "part commit");
      const files = await invoke("git_show_files", {});
      requireSuccess(files, "part file list");
      const changedFiles = files.stdout.split("\n").map((file) => file.trim()).filter(Boolean);
      if (changedFiles.some((file) => !part.files.includes(file))) throw new Error(`${agent} changed a file outside its assignment`);
      for (const file of changedFiles) await emit("file.changed", agent, file);
      return { text: response.text, files: changedFiles, inputTokens: response.totalUsage.inputTokens ?? 0, outputTokens: response.totalUsage.outputTokens ?? 0 };
    }));
    for (const [index, response] of responses.entries()) {
      memory.decisions.push(`coder:${index + 1}: ${response.text.slice(0, 500)}`);
      memory.filesTouched.push(...response.files);
      usage.inputTokens += response.inputTokens;
      usage.outputTokens += response.outputTokens;
    }
    requireSuccess(await invokeRoot("git_branch", { name: branch }), "integration branch");
    await emit("agent.spawned", "integration");
    const correctPart = async (owner: number, reason: string) => {
      const agent = `coder:${owner + 1}`;
      await emit("agent.spawned", agent);
      const correctionRegistry = createToolRegistry(checkout, githubCalls, parts[owner]!.files);
      const correction = await generateText({
        model: task.partLanguageModels?.[owner] ?? chosen.model as LanguageModel,
        providerOptions: chosen.providerOptions,
        system: `${AGENT_ROLES.coder.instructions}\nCorrect only your assigned files: ${JSON.stringify(parts[owner]!.files)}. This is the single owner correction, not another swarm.`,
        prompt: JSON.stringify({ ...memory, feedback: reason.slice(0, 1_000) }),
        tools: aiTools(correctionRegistry, traces, AGENT_ROLES.coder.tools, task.onTool),
        stopWhen: stepCountIs(10), maxOutputTokens: 1_500,
      });
      memory.decisions.push(`${agent} correction: ${correction.text.slice(0, 500)}`);
      usage.inputTokens += correction.totalUsage.inputTokens ?? 0;
      usage.outputTokens += correction.totalUsage.outputTokens ?? 0;
      const changed = await invokeRoot("git_status", {});
      requireSuccess(changed, "correction status");
      if (!changed.stdout.split("\n").slice(1).some((line) => line.trim())) throw new Error(`${agent} did not correct its part`);
      requireSuccess(await invokeRoot("git_commit", { message: `Tourist correction ${owner + 1}: ${parts[owner]!.goal.slice(0, 80)}` }), "correction commit");
      const files = await invokeRoot("git_show_files", {});
      requireSuccess(files, "correction files");
      for (const file of files.stdout.split("\n").map((name) => name.trim()).filter(Boolean)) if (!parts[owner]!.files.includes(file)) throw new Error(`${agent} corrected an unassigned file`);
    };
    for (const [index, partBranch] of partBranches.entries()) {
      const merge = await invokeRoot("git_merge_part", { branch: partBranch });
      if ((merge as { exitCode: number }).exitCode !== 0) {
        requireSuccess(await invokeRoot("git_merge_abort", {}), "merge abort");
        memory.decisions.push(`integration: conflict returned to coder:${index + 1}`);
        await correctPart(index, `Your part conflicted during integration: ${String((merge as { stderr?: string; stdout?: string }).stderr ?? "")} ${String((merge as { stdout?: string }).stdout ?? "")}`);
      } else memory.decisions.push(`integration: merged coder:${index + 1}`);
    }
    await emit("agent.spawned", "tester");
    let tests = await invokeRoot("run_tests", {});
    if ((tests as { exitCode: number }).exitCode !== 0) {
      await emit("test.failed", "tester");
      const failure = `${String((tests as { stdout?: string }).stdout ?? "")}\n${String((tests as { stderr?: string }).stderr ?? "")}`;
      const matches = parts.map((part, index) => ({ index, matched: [...part.files, ...(part.testHints ?? [])].some((hint) => failure.includes(hint)) })).filter((match) => match.matched);
      if (matches.length !== 1) throw new Error(`Integrated tests failed; owner is ${matches.length ? "ambiguous" : "unknown"}. Assign testHints to the responsible part.`);
      const owner = matches[0]!.index;
      memory.decisions.push(`tester: failed; returned to coder:${owner + 1} once`);
      await correctPart(owner, failure);
      tests = await invokeRoot("run_tests", {});
    }
    if ((tests as { exitCode: number }).exitCode !== 0) { await emit("test.failed", "tester"); requireSuccess(tests, "integrated tests"); }
    await emit("test.passed", "tester");
    const head = await invokeRoot("git_head", {});
    requireSuccess(head, "integration head");
    await invokeRoot("create_pull_request", { owner: task.owner, repo: task.repo, head: branch, base, title: task.task.trim().slice(0, 100), body: memory.decisions.join("\n") });
    completed = true;
    return { id, topology: "swarm", modelId: chosen.modelId, provider: chosen.provider, branch, commit: head.stdout.trim(), agents, taskMemory: memory, tools: traces, githubCalls, usage };
  } finally {
    for (const path of worktrees) await invokeRoot("git_worktree_remove", { path }).catch(() => undefined);
    if (completed) for (const partBranch of partBranches) await invokeRoot("git_delete_part_branch", { branch: partBranch }).catch(() => undefined);
    await rm(temporary, { recursive: true, force: true });
  }
}

import { randomUUID } from "node:crypto";
import { generateText, stepCountIs, tool, type LanguageModel, type ToolSet } from "ai";
import { z } from "zod";
import { CODER_INSTRUCTIONS, CODER_TOOL_IDS } from "./coder.js";
import { DEFAULT_MODEL, type ModelId, type ProviderId } from "../models/config.js";
import { resolveModel, type ModelSelection } from "../models/router.js";
import { createToolRegistry, type ToolRegistry } from "../tools/registry.js";
import { checkoutRoot } from "../tools/utils.js";

export interface ToolTrace {
  name: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  at: string;
}

export interface SoloRun {
  id: string;
  topology: "solo_coder";
  agents: ["coder"];
  modelId: ModelId;
  provider: ProviderId;
  branch: string;
  summary: string;
  commit: string;
  usage: { inputTokens: number; outputTokens: number };
  tools: ToolTrace[];
  githubCalls: Array<{ name: string; input: unknown }>;
}

export interface SoloTask {
  checkout: string;
  task: string;
  owner: string;
  repo: string;
  model?: ModelSelection;
  /** For offline contract tests; live runs use resolveModel. */
  languageModel?: LanguageModel;
  memoryPack?: string[];
  onTool?: (trace: ToolTrace) => void | Promise<void>;
  baseBranch?: string;
}

export function summarize(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) return { value: String(value) };
  const object = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(object).map(([key, entry]) => {
    if (["content", "stdout", "stderr", "matches", "query", "body"].includes(key)) return [key, typeof entry === "string" ? `<${entry.length} chars>` : "<redacted>"];
    return [key, entry];
  }));
}

export function aiTools(registry: ToolRegistry, traces: ToolTrace[], ids: readonly string[] = CODER_TOOL_IDS, onTool?: SoloTask["onTool"]): ToolSet {
  return Object.fromEntries(ids.map((id) => {
    const definition = registry.get(id);
    return [id, tool({
      description: definition.description,
      inputSchema: definition.inputSchema as z.ZodType,
      execute: async (input: unknown) => {
        let result: unknown;
        try { result = await registry.invoke(id, input); }
        catch (error) { result = { error: error instanceof Error ? error.message : "Tool failed" }; }
        const trace = { name: id, input: summarize(input), result: summarize(result), at: new Date().toISOString() };
        traces.push(trace);
        await onTool?.(trace);
        return result;
      },
    })];
  }));
}

export function requireSuccess(result: unknown, action: string): asserts result is { exitCode: number; stdout: string; stderr: string } {
  const output = result as { exitCode?: number; stderr?: string };
  if (output.exitCode !== 0) throw new Error(`${action} failed: ${output.stderr ?? "unknown error"}`);
}

export async function invokeTraced(registry: ToolRegistry, traces: ToolTrace[], name: string, input: Record<string, unknown>, onTool?: SoloTask["onTool"]): Promise<unknown> {
  const result = await registry.invoke(name, input);
  const trace = { name, input: summarize(input), result: summarize(result), at: new Date().toISOString() };
  traces.push(trace);
  await onTool?.(trace);
  return result;
}

export async function runSoloTask(task: SoloTask): Promise<SoloRun> {
  if (!task.task.trim()) throw new Error("Task text is required");
  const checkout = await checkoutRoot(task.checkout);
  const githubCalls: SoloRun["githubCalls"] = [];
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
  const response = await generateText({
    model: chosen.model,
    providerOptions: chosen.providerOptions,
    system: CODER_INSTRUCTIONS,
    prompt: `${task.task}\n\nRelevant scoped memory:\n${JSON.stringify((task.memoryPack ?? []).slice(0, 8))}`,
    tools: aiTools(registry, traces, CODER_TOOL_IDS, task.onTool),
    stopWhen: stepCountIs(20),
    maxOutputTokens: 2_000,
  });

  const diff = await invoke("git_diff", {});
  requireSuccess(diff, "git diff");
  const changed = await invoke("git_status", {});
  requireSuccess(changed, "git status");
  if (!changed.stdout.split("\n").slice(1).some((line) => line.trim())) throw new Error("Agent finished without a code change");
  const tests = await invoke("run_tests", {});
  requireSuccess(tests, "final tests");
  const commitResult = await invoke("git_commit", { message: `Tourist: ${task.task.trim().slice(0, 100)}` });
  requireSuccess(commitResult, "local commit");
  const commit = String(commitResult.stdout).match(/\[[^\]]+ ([0-9a-f]+)\]/)?.[1] ?? "";
  await invoke("create_pull_request", { owner: task.owner, repo: task.repo, head: branch, base, title: task.task.trim().slice(0, 100), body: response.text });
  return {
    id, topology: "solo_coder", agents: ["coder"], modelId: chosen.modelId, provider: chosen.provider, branch,
    summary: response.text, commit, usage: { inputTokens: response.totalUsage.inputTokens ?? 0, outputTokens: response.totalUsage.outputTokens ?? 0 },
    tools: traces, githubCalls,
  };
}

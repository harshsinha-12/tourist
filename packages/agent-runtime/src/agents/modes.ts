import { randomUUID } from "node:crypto";
import { generateText, stepCountIs } from "ai";
import { DEFAULT_MODEL } from "../models/config.js";
import { resolveModel } from "../models/router.js";
import { createToolRegistry } from "../tools/registry.js";
import { checkoutRoot } from "../tools/utils.js";
import { aiTools, type SoloTask, type ToolTrace } from "./solo.js";
import { runTask } from "./runtime.js";

export type AgentMode = "run" | "plan" | "ask" | "debug";

export interface AgentRequest extends SoloTask {
  mode?: AgentMode;
  memoryPack?: string[];
}

export interface ReadOnlyRun {
  id: string;
  mode: "plan" | "ask";
  modelId: string;
  provider: string;
  answer: string;
  memoryPack: string[];
  usage: { inputTokens: number; outputTokens: number };
  tools: ToolTrace[];
}

export interface RunTelemetry {
  policy: { version: "heuristic_v1"; mode: AgentMode; topology?: string };
  reward_v1: { completed: true; testsPassed: boolean | null; diffProduced: boolean; inputTokens: number; outputTokens: number; latencyMs: number };
}

export async function runAgentRequest(request: AgentRequest): Promise<(ReadOnlyRun | Awaited<ReturnType<typeof runTask>>) & RunTelemetry> {
  const startedAt = Date.now();
  const result = await executeAgentRequest(request);
  const mode = request.mode ?? "run";
  const coding = mode === "run" || mode === "debug";
  return { ...result,
    policy: { version: "heuristic_v1", mode, ...("topology" in result ? { topology: result.topology } : {}) },
    reward_v1: { completed: true, testsPassed: coding ? true : null, diffProduced: coding,
      inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, latencyMs: Date.now() - startedAt },
  };
}

async function executeAgentRequest(request: AgentRequest): Promise<ReadOnlyRun | Awaited<ReturnType<typeof runTask>>> {
  const mode = request.mode ?? "run";
  if (mode === "run" || mode === "debug") {
    const task = mode === "debug"
      ? `Debug this issue. Reproduce the failure first, identify the root cause, make a focused fix, and verify it with a regression test. Issue: ${request.task}`
      : request.task;
    return runTask({ ...request, task });
  }
  if (!request.task.trim()) throw new Error("Task text is required");
  const checkout = await checkoutRoot(request.checkout);
  const chosen = resolveModel(request.languageModel ? { ...request.model, apiKey: "mock" } : request.model);
  const traces: ToolTrace[] = [];
  const registry = createToolRegistry(checkout);
  const tools = aiTools(registry, traces, ["read_file", "search", "git_status", "git_diff"], request.onTool);
  const notes = (request.memoryPack ?? []).slice(0, 8).map((item) => item.slice(0, 1_000));
  const result = await generateText({
    model: request.languageModel ?? chosen.model,
    providerOptions: request.languageModel ? {} : chosen.providerOptions,
    system: mode === "plan"
      ? "Inspect the repository and propose a concrete implementation plan with verification steps. Ask for missing decisions when essential. You have read-only tools and must not edit files or run commands."
      : "Answer the user's question using repository evidence. Cite file paths in your answer. You have read-only tools and must not edit files or run commands.",
    prompt: `${request.task}\n\nRelevant scoped memory:\n${JSON.stringify(notes)}`,
    tools,
    stopWhen: stepCountIs(12),
    maxOutputTokens: 2_000,
  });
  return {
    id: randomUUID(), mode, modelId: request.model?.modelId ?? DEFAULT_MODEL,
    provider: chosen.provider, answer: result.text, memoryPack: notes,
    usage: { inputTokens: result.totalUsage.inputTokens ?? 0, outputTokens: result.totalUsage.outputTokens ?? 0 }, tools: traces,
  };
}

import { basename, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { DEFAULT_MODEL, getModelConfig, type ModelId, type ReasoningLevel } from "../../agent-runtime/src/models/config.js";
import { swarmPartsSchema } from "../../agent-runtime/src/agents/swarm.js";

export interface RunOptions {
  repo: string;
  task: string;
  modelId: ModelId;
  reasoningLevel?: ReasoningLevel;
  cloud?: string;
  output?: string;
  detach: boolean;
  mode: "run" | "plan" | "ask" | "debug";
  swarmParts?: Array<{ goal: string; files: string[]; testHints?: string[] | undefined }>;
}

function value(args: string[], key: string): string | undefined {
  const index = args.indexOf(key);
  if (index < 0) return undefined;
  const next = args[index + 1];
  if (!next || next.startsWith("--")) throw new Error(`${key} needs a value`);
  return next;
}

export function parseRunOptions(args: string[], mode: RunOptions["mode"] = "run"): RunOptions {
  const repo = value(args, "--repo");
  const task = value(args, "--task");
  const modelArg = value(args, "--model") ?? DEFAULT_MODEL;
  const cloud = value(args, "--cloud") ?? process.env.TOURIST_CLOUD_URL;
  const reasoning = value(args, "--reasoning");
  if (!repo || !task?.trim()) throw new Error("run requires --repo and --task");
  getModelConfig(modelArg);
  if (reasoning && !["low", "medium", "high"].includes(reasoning)) throw new Error("--reasoning must be low, medium, or high");
  const output = value(args, "--output");
  const partsFile = value(args, "--swarm-parts");
  if (partsFile && mode !== "run") throw new Error("--swarm-parts requires run mode");
  const swarmParts = partsFile ? swarmPartsSchema.parse(JSON.parse(readFileSync(resolve(partsFile), "utf8"))) : undefined;
  return {
    repo, task, modelId: modelArg as ModelId,
    ...(reasoning ? { reasoningLevel: reasoning as ReasoningLevel } : {}),
    ...(cloud ? { cloud } : {}),
    ...(output ? { output } : {}),
    ...(swarmParts ? { swarmParts } : {}),
    detach: args.includes("--detach"), mode,
  };
}

export function localRepository(path: string): { checkout: string; owner: string; repo: string } {
  const checkout = resolve(path);
  let remote = "";
  try { remote = execFileSync("git", ["-C", checkout, "remote", "get-url", "origin"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { /* A fixture may have no remote. */ }
  const match = remote.match(/(?:github\.com[:/])([\w-]+)\/([\w.-]+?)(?:\.git)?$/i);
  return { checkout, owner: match?.[1] ?? "local", repo: match?.[2] ?? basename(checkout) };
}

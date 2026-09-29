import { basename } from "node:path";
import type { ToolTrace } from "../../agent-runtime/src/agents/solo.js";
import type { RunOptions } from "./options.js";

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, value: string) => color ? `\u001b[${code}m${value}\u001b[0m` : value;
const cyan = (value: string) => paint("38;2;76;183;210", value);
const mint = (value: string) => paint("38;2;113;240;194", value);
const amber = (value: string) => paint("38;2;255;210;95", value);
const muted = (value: string) => paint("38;2;185;206;218", value);
const bold = (value: string) => paint("1", value);

export function renderHeader(repo: string, model: string, mode: RunOptions["mode"], cloud?: string, reasoning?: string): string {
  const width = Math.max(36, Math.min(process.stdout.columns ?? 76, 76));
  const rule = cyan("━".repeat(width));
  return `\n${rule}\n  ${bold(cyan("TOURIST"))}  ${muted("/ coding agents")}\n${rule}\n  ${mint(cloud ? "☁ Cloud" : "⌂ Local")}   ${amber(mode.toUpperCase())}   ${muted(model)}${reasoning ? muted(` · ${reasoning} reasoning`) : ""}\n  ${muted(cloud ? repo : basename(repo))}\n\n  ${muted("Type a task, or start typing a command for suggestions.")}\n  ${muted("Type models to choose a model and see pricing.")}\n`;
}

export function renderPrompt(mode: RunOptions["mode"]): string {
  return `${cyan("tourist")} ${amber(mode)} ${mint("❯")} `;
}

export function renderInteractiveHelp(): string {
  return `\n${bold(cyan("Modes"))}\n  ${amber("/run")}         Edit code, test, and commit on a new branch\n  ${amber("/plan")}        Inspect and outline work without editing\n  ${amber("/ask")}         Answer from repository files without editing\n  ${amber("/debug")}       Reproduce an issue, fix it, and test it\n\n${bold(cyan("Workspace"))}\n  models       Open model picker with prices\n  /model       Open model picker · /model ID selects directly\n  /repo PATH   Choose a local checkout or cloud owner/repo\n  /cloud URL   Run in Tourist Cloud · /local returns to laptop\n  /memory      List scoped notes\n  /multi-task FILE   Run tasks from a JSON file\n  /status ID   Check a cloud run\n  /exit        Leave Tourist\n\n${muted("Type / for all commands, or a few letters for suggestions.")}\n${muted("Tab completes a suggestion. Enter on ordinary text sends a task.")}\n\n`;
}

export function renderTool(trace: ToolTrace): string {
  const path = typeof trace.input.path === "string" ? ` ${trace.input.path}` : "";
  const program = typeof trace.input.program === "string" ? ` ${trace.input.program}` : "";
  const failed = typeof trace.result.error === "string" || (typeof trace.result.exitCode === "number" && trace.result.exitCode !== 0);
  return `  ${failed ? amber("!") : mint("›")} ${muted(trace.name)}${path}${program}\n`;
}

export function renderResult(result: unknown): string {
  if (!result || typeof result !== "object") return `${String(result)}\n`;
  const run = result as { answer?: string; summary?: string; taskMemory?: { decisions?: string[] }; result?: { answer?: string; summary?: string; taskMemory?: { decisions?: string[] } }; status?: string; id?: string; branch?: string; commit?: string; usage?: { inputTokens?: number; outputTokens?: number } };
  const body = run.answer ?? run.summary ?? run.result?.answer ?? run.result?.summary ?? run.taskMemory?.decisions?.at(-1) ?? run.result?.taskMemory?.decisions?.at(-1);
  const lines = ["", `${mint("●")} ${bold(run.status === "failed" ? "Run failed" : "Tourist finished")}`];
  if (body) lines.push("", body);
  else if (run.status === "failed") lines.push("", JSON.stringify(result, null, 2));
  if (run.branch) lines.push("", `${muted("Branch")}  ${run.branch}`);
  if (run.commit) lines.push(`${muted("Commit")}  ${run.commit}`);
  if (run.id) lines.push(`${muted("Run ID")}  ${run.id}`);
  if (run.usage) lines.push(`${muted("Tokens")}  ${run.usage.inputTokens ?? 0} in · ${run.usage.outputTokens ?? 0} out`);
  return `${lines.join("\n")}\n\n`;
}

export function renderError(message: string): string {
  const hint = message.includes("checkout must be clean") ? `\n${muted("Use /ask or /plan to inspect current changes. Coding runs need a clean checkout.")}` : "";
  return `\n${amber("! Tourist could not continue")}: ${message}${hint}\n\n`;
}

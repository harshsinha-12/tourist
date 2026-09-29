import { execFile } from "node:child_process";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { runAgentRequest } from "../../agent-runtime/src/agents/modes.js";
import { MemoryStore } from "../../agent-runtime/src/memory/store.js";
import { DEFAULT_MODEL, MODELS, getModelConfig, type ReasoningLevel } from "../../agent-runtime/src/models/config.js";
import { MODEL_PRICING } from "../../agent-runtime/src/models/pricing.js";
import { cloudRequest, waitForCloudRun } from "./cloud.js";
import { localRepository, parseRunOptions, type RunOptions } from "./options.js";
import { renderError, renderHeader, renderInteractiveHelp, renderResult, renderTool } from "./terminal.js";
import type { ToolTrace } from "../../agent-runtime/src/agents/solo.js";
import { readRibbonCommand } from "./ribbon.js";
import { selectModel } from "./model-picker.js";

const execFileAsync = promisify(execFile);
const help = `Tourist coding agents\n\nUsage:\n  tourist                    Interactive terminal\n  tourist models\n  tourist run|plan|ask|debug --repo <path|owner/repo> --task <text> [--model <id>] [--cloud <url>]\n  tourist multi-task --repo <path|owner/repo> --tasks <json-file> [--cloud <url>]\n  tourist status <run-id> --cloud <url>\n  tourist memory list|add|remove --repo <path> [--scope user|codebase] [--text <note>] [--id <id>]\n\nInteractive commands: /plan, /ask, /debug, /run, /multi-task, /status, /memory, /model, /repo, /cloud, /local, /help, /exit.\nOptions: --reasoning low|medium|high, --detach (cloud), --output <file>.\nKeys: OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY. Cloud mode also needs TOURIST_CLOUD_TOKEN.\nPlan and ask are read-only. Debug reproduces, fixes, and tests. Multi-task runs independent tasks in separate worktrees or cloud sandboxes.\n`;

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function memoryStore(): MemoryStore {
  return new MemoryStore(process.env.TOURIST_MEMORY_FILE ?? join(homedir(), ".tourist", "memory.json"));
}

async function execute(options: RunOptions, checkoutOverride?: string, sessionNotes: string[] = [], baseBranch?: string, onTool?: (trace: ToolTrace) => void): Promise<unknown> {
  getModelConfig(options.modelId);
  const repoId = options.cloud ? options.repo : (() => { const repo = localRepository(options.repo); return `${repo.owner}/${repo.repo}`; })();
  const notes = await memoryStore().retrieve(repoId, options.task);
  if (options.cloud) {
    if (!/^[\w-]+\/[\w.-]+$/.test(options.repo)) throw new Error("Cloud runs require a public owner/repo name");
    const created = await cloudRequest(options.cloud, "POST", "v1/runs", {
      repo: options.repo, task: options.task, modelId: options.modelId, mode: options.mode,
      memoryPack: [...notes.map((note) => `[${note.id}] ${note.text}`), ...sessionNotes].slice(0, 8),
      ...(options.reasoningLevel ? { reasoningLevel: options.reasoningLevel } : {}),
    }, options.modelId) as { id: string };
    if (options.detach) return created;
    return waitForCloudRun(options.cloud, created.id);
  }
  if (options.detach) throw new Error("--detach is only available with --cloud");
  const repo = localRepository(options.repo);
  return runAgentRequest({ ...repo, checkout: checkoutOverride ?? repo.checkout, task: options.task, mode: options.mode,
    ...(baseBranch ? { baseBranch } : {}),
    ...(onTool ? { onTool } : {}),
    memoryPack: [...notes.map((note) => `[${note.id}] ${note.text}`), ...sessionNotes].slice(0, 8),
    model: { modelId: options.modelId, ...(options.reasoningLevel ? { reasoningLevel: options.reasoningLevel } : {}) } });
}

function printModels(): void {
  for (const [id, model] of Object.entries(MODELS)) {
    const rate = MODEL_PRICING[id as keyof typeof MODEL_PRICING];
    process.stdout.write(`${id}\t${model.provider}\t$${rate.input}/$${rate.output} per 1M input/output tokens\n`);
  }
  if (process.stdout.isTTY) process.stdout.write("\nTo select a model, run tourist and type /model.\n");
}

async function interactive(): Promise<void> {
  let mode: RunOptions["mode"] = "run";
  let repo = process.cwd();
  let cloud = process.env.TOURIST_CLOUD_URL;
  let modelId: RunOptions["modelId"] = DEFAULT_MODEL;
  let reasoningLevel: ReasoningLevel | undefined;
  const sessionNotes: string[] = [];
  const history: string[] = [];
  const showHeader = () => process.stdout.write(renderHeader(repo, modelId, mode, cloud, reasoningLevel));
  showHeader();
  while (true) {
      const entered = await readRibbonCommand(mode, history);
      if (entered) history.push(entered);
      const line = entered.startsWith("tourist ") ? entered.slice(8).trim() : entered;
      if (!line) continue;
      if (line === "/exit" || line === "/quit") break;
      if (line === "/help" || line === "help") { process.stdout.write(renderInteractiveHelp()); continue; }
      if (line === "models" || line === "/models" || line === "/model") {
        const choice = await selectModel({ modelId, ...(reasoningLevel ? { reasoningLevel } : {}) });
        if (choice) { modelId = choice.modelId; reasoningLevel = choice.reasoningLevel; showHeader(); }
        continue;
      }
      if (line === "/repo") { process.stdout.write(`Repository: ${repo}\n`); continue; }
      if (line === "/cloud") { process.stdout.write(`Execution: ${cloud ?? "local laptop"}\n`); continue; }
      if (line.startsWith("/model ")) {
        try { const config = getModelConfig(line.slice(7).trim()); modelId = line.slice(7).trim() as RunOptions["modelId"]; if (!config.options.reasoningLevels?.includes(reasoningLevel as ReasoningLevel)) reasoningLevel = undefined; showHeader(); }
        catch (error) { process.stderr.write(renderError(error instanceof Error ? error.message : String(error))); }
        continue;
      }
      if (line.startsWith("/repo ")) { repo = line.slice(6).trim(); showHeader(); continue; }
      if (line.startsWith("/cloud ")) { cloud = line.slice(7).trim(); showHeader(); continue; }
      if (line === "/local") { cloud = undefined; showHeader(); continue; }
      if (line.startsWith("/status ")) {
        if (!cloud) { process.stderr.write("Set /cloud <url> first\n"); continue; }
        try { process.stdout.write(renderResult(await cloudRequest(cloud, "GET", `v1/runs/${encodeURIComponent(line.slice(8).trim())}`))); }
        catch (error) { process.stderr.write(renderError(error instanceof Error ? error.message : String(error))); }
        continue;
      }
      if (line.startsWith("/multi-task ")) {
        try { for (const result of await runMultiple(["--repo", repo, "--tasks", line.slice(12).trim(), "--model", modelId, ...(reasoningLevel ? ["--reasoning", reasoningLevel] : []), ...(cloud ? ["--cloud", cloud] : [])])) process.stdout.write(renderResult(result)); }
        catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); }
        continue;
      }
      if (line === "/memory") {
        try { process.stdout.write(`${JSON.stringify(await memoryCommand(["list", "--repo", repo]), null, 2)}\n`); }
        catch (error) { process.stderr.write(renderError(error instanceof Error ? error.message : String(error))); }
        continue;
      }
      const slash = line.match(/^\/?(run|plan|ask|debug)(?:\s+(.*))?$/s);
      if (line.startsWith("/") && !slash) { process.stderr.write(`Unknown command: ${line.split(" ")[0]}. Type /help.\n`); continue; }
      const task = slash ? slash[2]?.trim() : line;
      if (slash) { mode = slash[1] as RunOptions["mode"]; showHeader(); }
      if (!task) continue;
      try {
        const options = parseRunOptions(["--repo", repo, "--task", task, "--model", modelId, ...(reasoningLevel ? ["--reasoning", reasoningLevel] : []), ...(cloud ? ["--cloud", cloud] : [])], mode);
        process.stdout.write(`\n  Working on ${mode}…\n`);
        const result = await execute(options, undefined, sessionNotes, undefined, (trace) => { process.stdout.write(renderTool(trace)); });
        process.stdout.write(renderResult(result));
        const summary = result && typeof result === "object" && "answer" in result ? String(result.answer) : result && typeof result === "object" && "summary" in result ? String(result.summary) : "";
        sessionNotes.push(`Previous ${mode} request: ${task.slice(0, 200)}. Result: ${summary.slice(0, 500)}`);
        if (sessionNotes.length > 4) sessionNotes.shift();
      } catch (error) { process.stderr.write(renderError(error instanceof Error ? error.message : String(error))); }
  }
}

async function runMultiple(args: string[]): Promise<unknown[]> {
  const tasksFile = option(args, "--tasks");
  if (!tasksFile) throw new Error("multi-task requires --tasks <json-file>");
  const tasks = JSON.parse(await readFile(resolve(tasksFile), "utf8")) as unknown;
  if (!Array.isArray(tasks) || tasks.length < 2 || tasks.length > 8 || tasks.some((task) => typeof task !== "string" || !task.trim())) {
    throw new Error("Tasks file must be a JSON array of 2–8 nonempty strings");
  }
  const baseArgs = args.filter((_, index) => args[index - 1] !== "--tasks" && args[index] !== "--tasks");
  const first = parseRunOptions([...baseArgs, "--task", tasks[0] as string]);
  if (first.cloud) return Promise.all(tasks.map((task) => execute({ ...first, task: task as string })));
  const checkout = localRepository(first.repo).checkout;
  const baseBranch = (await execFileAsync("git", ["-C", checkout, "branch", "--show-current"])).stdout.trim() || "main";
  const results: unknown[] = [];
  for (const task of tasks) {
    const root = await mkdtemp(join(tmpdir(), "tourist-worktree-"));
    const path = join(root, "repo");
    try {
      await execFileAsync("git", ["-C", checkout, "worktree", "add", "--detach", path, "HEAD"]);
      results.push(await execute({ ...first, task: task as string }, path, [], baseBranch));
    } finally {
      await execFileAsync("git", ["-C", checkout, "worktree", "remove", "--force", path]).catch(() => {});
      await rm(root, { recursive: true, force: true });
    }
  }
  return results;
}

async function memoryCommand(args: string[]): Promise<unknown> {
  const action = args[0];
  const repoArg = option(args, "--repo");
  if (!repoArg) throw new Error("memory requires --repo <path>");
  const repo = localRepository(repoArg);
  const repoId = `${repo.owner}/${repo.repo}`;
  const store = memoryStore();
  if (action === "list") return store.list(repoId);
  if (action === "add") {
    const scope = option(args, "--scope") ?? "codebase";
    const note = option(args, "--text");
    if ((scope !== "codebase" && scope !== "user") || !note) throw new Error("memory add requires --text and --scope user|codebase");
    return store.add(scope, repoId, note);
  }
  if (action === "remove") {
    const id = option(args, "--id");
    if (!id) throw new Error("memory remove requires --id");
    return { removed: await store.remove(repoId, id) };
  }
  throw new Error(`Unknown memory command: ${action}`);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const localEnv = join(process.cwd(), ".env.local");
  if (existsSync(localEnv)) loadEnvFile(localEnv);
  const command = args[0];
  if (!command) { if (process.stdin.isTTY) await interactive(); else process.stdout.write(help); return; }
  if (command === "help" || command === "--help") { process.stdout.write(help); return; }
  if (command === "models") {
    printModels();
    return;
  }
  if (command === "status") {
    const id = args[1];
    const cloud = option(args, "--cloud") ?? process.env.TOURIST_CLOUD_URL;
    if (!id || !cloud) throw new Error("status requires a run ID and --cloud <url>");
    process.stdout.write(`${JSON.stringify(await cloudRequest(cloud, "GET", `v1/runs/${encodeURIComponent(id)}`), null, 2)}\n`);
    return;
  }
  if (command === "memory") {
    process.stdout.write(`${JSON.stringify(await memoryCommand(args.slice(1)), null, 2)}\n`);
    return;
  }
  if (command === "multi-task") {
    process.stdout.write(`${JSON.stringify(await runMultiple(args.slice(1)), null, 2)}\n`);
    return;
  }
  if (!["run", "plan", "ask", "debug"].includes(command)) throw new Error(`Unknown command: ${command}`);
  const options = parseRunOptions(args.slice(1), command as RunOptions["mode"]);
  const result = await execute(options);
  if (options.output) await writeFile(resolve(options.output), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (typeof result === "object" && result !== null && "status" in result && result.status === "failed") process.exitCode = 1;
}

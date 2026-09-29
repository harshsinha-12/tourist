import { Daytona } from "@daytona/sdk";
import { readFile } from "node:fs/promises";
import type { Submission } from "./contracts.js";
import { providerKeyEnv } from "./contracts.js";

export interface ExecutionResult { run: unknown; patch: string }
export interface CloudEvent { type: "stage" | "tool" | "agent_event"; at: string; stage?: string; trace?: unknown; event?: { type: string; agent?: string; path?: string; tool?: string } }
export interface CloudExecutor { execute(input: Submission, modelKey: string, onEvent?: (event: CloudEvent) => Promise<void>): Promise<ExecutionResult> }

export class DaytonaExecutor implements CloudExecutor {
  constructor(private readonly workerBundlePath: string) {}

  async execute(input: Submission, modelKey: string, onEvent?: (event: CloudEvent) => Promise<void>): Promise<ExecutionResult> {
    if (!process.env.DAYTONA_API_KEY) throw new Error("Cloud sandbox is not configured");
    const client = new Daytona();
    const sandbox = await client.create({ language: "typescript" }, { timeout: 120 });
    try {
      await onEvent?.({ type: "stage", at: new Date().toISOString(), stage: "Cloning repository" });
      await sandbox.git.clone(`https://github.com/${input.repo}.git`, "/workspace/repo", undefined, undefined, undefined, undefined, false, 1);
      await sandbox.fs.uploadFile(await readFile(this.workerBundlePath), "/workspace/worker.cjs");
      await sandbox.fs.uploadFile(Buffer.from(JSON.stringify(input)), "/workspace/task.json");
      await sandbox.fs.uploadFile(Buffer.from(""), "/workspace/events.jsonl");
      await onEvent?.({ type: "stage", at: new Date().toISOString(), stage: "Running agent" });
      let finished = false;
      let seen = 0;
      const poll = async () => {
        while (!finished) {
          await new Promise((resolve) => setTimeout(resolve, 1_000));
          const bytes = await sandbox.fs.downloadFile("/workspace/events.jsonl").catch(() => Buffer.from(""));
          const lines = bytes.toString("utf8").split("\n").filter(Boolean);
          for (const line of lines.slice(seen)) {
            try { await onEvent?.(JSON.parse(line) as CloudEvent); } catch { /* malformed or incomplete event */ }
          }
          seen = lines.length;
        }
      };
      const polling = poll();
      const result = await sandbox.process.executeCommand(
        "node /workspace/worker.cjs /workspace/task.json /workspace/result.json",
        "/workspace",
        { [providerKeyEnv(input.modelId)]: modelKey, TOURIST_EVENTS_FILE: "/workspace/events.jsonl" },
        900,
      ).finally(() => { finished = true; });
      await polling;
      const finalEvents = (await sandbox.fs.downloadFile("/workspace/events.jsonl")).toString("utf8").split("\n").filter(Boolean);
      for (const line of finalEvents.slice(seen)) {
        try { await onEvent?.(JSON.parse(line) as CloudEvent); } catch { /* malformed event */ }
      }
      if (result.exitCode !== 0) throw new Error(`Sandbox worker failed (exit ${result.exitCode})`);
      const bytes = await sandbox.fs.downloadFile("/workspace/result.json");
      if (bytes.length > 5_000_000) throw new Error("Sandbox result exceeded size limit");
      const output = JSON.parse(bytes.toString("utf8")) as ExecutionResult;
      if (typeof output.patch !== "string" || !output.run) throw new Error("Invalid sandbox result");
      return output;
    } finally {
      await sandbox.delete(60, true);
    }
  }
}

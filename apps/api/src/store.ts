import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Submission } from "./contracts.js";
import type { CloudEvent } from "./daytona-executor.js";

export interface RunRecord {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  repo: string;
  modelId: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  result?: unknown;
  patch?: string;
  error?: string;
  events: CloudEvent[];
  policy: { version: "heuristic_v1"; mode: string; topology?: string };
  reward_v1?: { completed: boolean; testsPassed: boolean | null; diffProduced: boolean; inputTokens: number; outputTokens: number; latencyMs: number };
}

export class RunStore {
  constructor(private readonly directory: string) {}

  async init(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    for (const name of await readdir(this.directory)) {
      if (!name.endsWith(".json")) continue;
      const run = await this.get(name.slice(0, -5));
      if (run && ["queued", "running"].includes(run.status)) await this.update(run.id, { status: "failed", error: "Cloud worker restarted before this run completed" });
    }
  }

  async create(input: Submission): Promise<RunRecord> {
    const now = new Date().toISOString();
    const run: RunRecord = { id: randomUUID(), status: "queued", repo: input.repo, modelId: input.modelId, mode: input.mode, createdAt: now, updatedAt: now, events: [{ type: "stage", at: now, stage: "Queued" }], policy: { version: "heuristic_v1", mode: input.mode } };
    await this.save(run);
    return run;
  }

  async get(id: string): Promise<RunRecord | undefined> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
    try { return JSON.parse(await readFile(join(this.directory, `${id}.json`), "utf8")) as RunRecord; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  }

  async update(id: string, change: Partial<RunRecord>): Promise<RunRecord> {
    const current = await this.get(id);
    if (!current) throw new Error("Unknown run");
    const run = { ...current, ...change, id, updatedAt: new Date().toISOString() };
    await this.save(run);
    return run;
  }

  async appendEvent(id: string, event: CloudEvent): Promise<void> {
    const current = await this.get(id);
    if (!current) return;
    await this.update(id, { events: [...current.events.slice(-499), event] });
  }

  private async save(run: RunRecord): Promise<void> {
    const path = join(this.directory, `${run.id}.json`);
    const pending = `${path}.${randomUUID()}.tmp`;
    await writeFile(pending, `${JSON.stringify(run)}\n`, { mode: 0o600 });
    await rename(pending, path);
  }
}

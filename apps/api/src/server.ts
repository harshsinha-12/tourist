import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { parseSubmission, type Submission } from "./contracts.js";
import type { CloudExecutor } from "./daytona-executor.js";
import { RunStore } from "./store.js";
import { MemoryStore } from "../../../packages/agent-runtime/src/memory/store.js";

function send(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(`${JSON.stringify(value)}\n`);
}

function authorized(req: IncomingMessage, token: string): boolean {
  const received = req.headers.authorization;
  if (!received?.startsWith("Bearer ")) return false;
  const expectedHash = createHash("sha256").update(token).digest();
  const actualHash = createHash("sha256").update(received.slice(7)).digest();
  return timingSafeEqual(expectedHash, actualHash);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 64_000) throw new Error("Request body too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function safeFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "Cloud sandbox is not configured" || /^Sandbox worker failed \(exit \d+\)$/.test(message) || message === "Sandbox result exceeded size limit" || message === "Invalid sandbox result") return message;
  return "Cloud run failed; inspect the sandbox provider and worker logs";
}

class RunQueue {
  private active = false;
  private readonly pending: Array<{ id: string; input: Submission; modelKey: string }> = [];
  constructor(private readonly store: RunStore, private readonly executor: CloudExecutor, private readonly memory?: MemoryStore) {}
  canAccept(): boolean { return this.pending.length < 10; }
  enqueue(id: string, input: Submission, modelKey: string): void {
    this.pending.push({ id, input, modelKey });
    void this.pump();
  }
  private async pump(): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      while (this.pending.length) {
        const next = this.pending.shift();
        if (!next) break;
        const startedAt = Date.now();
        try {
          await this.store.update(next.id, { status: "running" });
          const result = await this.executor.execute(next.input, next.modelKey, (event) => this.store.appendEvent(next.id, event));
          const run = result.run as { topology?: string; usage?: { inputTokens?: number; outputTokens?: number } };
          await this.store.update(next.id, { status: "succeeded", result: result.run, patch: result.patch,
            policy: { version: "heuristic_v1", mode: next.input.mode, ...(run.topology ? { topology: run.topology } : {}) },
            reward_v1: { completed: true, testsPassed: next.input.mode === "plan" || next.input.mode === "ask" ? null : true,
              diffProduced: Boolean(result.patch), inputTokens: run.usage?.inputTokens ?? 0, outputTokens: run.usage?.outputTokens ?? 0, latencyMs: Date.now() - startedAt },
          });
          if (this.memory && result.patch) await this.memory.add("episodic", next.input.repo, `Completed ${next.input.task.slice(0, 300)}`).catch(() => undefined);
        } catch (error) {
          await this.store.update(next.id, { status: "failed", error: safeFailure(error), reward_v1: { completed: false, testsPassed: false, diffProduced: false, inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - startedAt } });
        }
      }
    } finally { this.active = false; }
  }
}

export async function createApiServer(options: { store: RunStore; executor: CloudExecutor; token: string; memory?: MemoryStore }): Promise<Server> {
  if (!options.token) throw new Error("TOURIST_API_TOKEN is required");
  await options.store.init();
  const queue = new RunQueue(options.store, options.executor, options.memory);
  return createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (req.method === "GET" && pathname === "/health/live") { send(res, 200, { status: "ok" }); return; }
      if (!authorized(req, options.token)) { send(res, 401, { error: "Unauthorized" }); return; }
      if (req.method === "POST" && pathname === "/v1/runs") {
        if (!queue.canAccept()) { send(res, 429, { error: "Run queue is full" }); return; }
        const input = parseSubmission(await readBody(req));
        const persisted = await options.memory?.retrieve(input.repo, input.task);
        const memoryPack = [...(input.memoryPack ?? []), ...(persisted ?? []).map((note) => `[${note.id}] ${note.text}`)].slice(0, 8);
        const enriched = { ...input, memoryPack };
        const modelKey = req.headers["x-model-api-key"];
        if (typeof modelKey !== "string" || !modelKey.trim()) { send(res, 400, { error: "A model API key is required" }); return; }
        const run = await options.store.create(enriched);
        queue.enqueue(run.id, enriched, modelKey);
        send(res, 202, { id: run.id, status: "queued" });
        return;
      }
      const patchMatch = pathname.match(/^\/v1\/runs\/([0-9a-f-]{36})\/patch$/);
      const eventsMatch = pathname.match(/^\/v1\/runs\/([0-9a-f-]{36})\/events$/);
      if (req.method === "GET" && eventsMatch) {
        const run = await options.store.get(eventsMatch[1] ?? "");
        if (!run) { send(res, 404, { error: "Run not found" }); return; }
        send(res, 200, { id: run.id, status: run.status, events: run.events });
        return;
      }
      if (req.method === "GET" && patchMatch) {
        const run = await options.store.get(patchMatch[1] ?? "");
        if (!run || run.status !== "succeeded" || !run.patch) { send(res, 404, { error: "Patch not found" }); return; }
        res.writeHead(200, { "content-type": "text/x-patch; charset=utf-8", "cache-control": "no-store" });
        res.end(run.patch);
        return;
      }
      const match = pathname.match(/^\/v1\/runs\/([0-9a-f-]{36})$/);
      if (req.method === "GET" && match) {
        const run = await options.store.get(match[1] ?? "");
        if (!run) { send(res, 404, { error: "Run not found" }); return; }
        const { patch: _patch, ...metadata } = run;
        send(res, 200, metadata);
        return;
      }
      send(res, 404, { error: "Not found" });
    } catch (error) {
      if (error instanceof ZodError) { send(res, 400, { error: "Invalid run request", details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }); return; }
      if (error instanceof Error && (/^Unsupported model:/.test(error.message) || /^Reasoning level not supported/.test(error.message))) { send(res, 400, { error: error.message }); return; }
      if (error instanceof SyntaxError) { send(res, 400, { error: "Invalid JSON" }); return; }
      if (error instanceof Error && error.message === "Request body too large") { send(res, 413, { error: error.message }); return; }
      send(res, 500, { error: "Internal server error" });
    }
  });
}

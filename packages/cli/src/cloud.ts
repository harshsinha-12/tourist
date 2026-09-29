import { getModelConfig, type ModelId } from "../../agent-runtime/src/models/config.js";

export interface CloudRunRecord {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result?: unknown;
  error?: string;
  events?: Array<{ type: "stage" | "tool"; stage?: string; trace?: { name?: string; input?: { path?: string; program?: string } } }>;
}

function credential(modelId: ModelId): string {
  const provider = getModelConfig(modelId).provider;
  const names = provider === "openai" ? ["OPENAI_API_KEY"] : provider === "anthropic" ? ["ANTHROPIC_API_KEY"] : ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"];
  const key = names.map((name) => process.env[name]).find(Boolean);
  if (!key) throw new Error(`Set ${names.join(" or ")} in the environment`);
  return key;
}

function endpoint(base: string, path: string): string {
  const url = new URL(base);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Cloud URL must use HTTP(S)");
  if (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Remote cloud URL must use HTTPS");
  return new URL(path, `${url.href.replace(/\/$/, "")}/`).href;
}

export async function cloudRequest(base: string, method: "GET" | "POST", path: string, body?: object, modelId?: ModelId): Promise<unknown> {
  const token = process.env.TOURIST_CLOUD_TOKEN;
  if (!token) throw new Error("Set TOURIST_CLOUD_TOKEN in the environment");
  const response = await fetch(endpoint(base, path), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(modelId ? { "x-model-api-key": credential(modelId) } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Cloud request failed (${response.status}): ${String((data as { error?: string }).error ?? "unknown error")}`);
  return data;
}

export async function waitForCloudRun(base: string, id: string, timeoutMs = 600_000): Promise<CloudRunRecord> {
  const deadline = Date.now() + timeoutMs;
  let seen = 0;
  while (Date.now() < deadline) {
    const run = await cloudRequest(base, "GET", `v1/runs/${encodeURIComponent(id)}`) as CloudRunRecord;
    for (const event of (run.events ?? []).slice(seen)) {
      const label = event.type === "stage" ? event.stage : `${event.trace?.name ?? "tool"}${event.trace?.input?.path ? ` ${event.trace.input.path}` : ""}${event.trace?.input?.program ? ` ${event.trace.input.program}` : ""}`;
      process.stdout.write(`  ${label ?? "Working"}\n`);
    }
    seen = run.events?.length ?? 0;
    if (run.status === "succeeded" || run.status === "failed") return run;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Run ${id} is still active; use tourist status ${id} --cloud <url>`);
}

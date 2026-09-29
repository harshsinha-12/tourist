import { resolve } from "node:path";
import { DaytonaExecutor } from "./daytona-executor.js";
import { createApiServer } from "./server.js";
import { RunStore } from "./store.js";
import { MemoryStore } from "../../../packages/agent-runtime/src/memory/store.js";

const port = Number(process.env.PORT ?? 8787);
const store = new RunStore(resolve(process.env.TOURIST_RUNS_DIR ?? "./data/runs"));
const worker = resolve(process.env.TOURIST_WORKER_BUNDLE ?? "./dist/worker.cjs");

createApiServer({ store, executor: new DaytonaExecutor(worker), token: process.env.TOURIST_API_TOKEN ?? "", memory: new MemoryStore(resolve(process.env.TOURIST_MEMORY_FILE ?? "./data/memory.json")) })
  .then((server) => server.listen(port, "0.0.0.0", () => { console.log(`Tourist API listening on ${port}`); }))
  .catch((error: unknown) => { console.error(error instanceof Error ? error.message : "API startup failed"); process.exitCode = 1; });

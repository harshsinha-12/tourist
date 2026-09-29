# Tourist Cloud API

The API accepts a public GitHub repository and a task, then executes the shared agent runtime in a disposable Daytona sandbox. It stores run status and redacted activity events on a persistent volume. This is a single-tenant prototype protected by one API token. It does not push branches or open live GitHub pull requests yet; coding runs return a patch. Swarm runs return the complete diff from the original checkout commit through the integrated HEAD.

Build with `pnpm --filter @tourist/api build`, then run with `TOURIST_API_TOKEN`, `DAYTONA_API_KEY`, and `node apps/api/dist/server.cjs`. Set `TOURIST_RUNS_DIR` and `TOURIST_MEMORY_FILE` to durable paths. In Docker, `/data` is the persistent directory. Place the API behind HTTPS. The CLI uses `TOURIST_CLOUD_TOKEN` for its bearer token and sends the model provider key with each request; the key is held in the in-memory queue and passed to the sandbox, never written to a run record.

Endpoints:

- `POST /v1/runs`: `{repo,task,modelId,mode,reasoningLevel?,memoryPack?}`; bearer token and `x-model-api-key` required.
- `GET /v1/runs/:id`: status, result, policy and reward telemetry.
- `GET /v1/runs/:id/events`: status and tool/stage activity for the terminal viewer.
- `GET /v1/runs/:id/patch`: the completed code patch, when available.
- `GET /health/live`: process liveness.

`mode` is `run`, `plan`, `ask`, or `debug`. Plan and ask are read-only. Multiple independent tasks can be submitted from the CLI. The in-process queue is bounded and serial for now; restarting the API marks unfinished runs failed. Persistent distributed scheduling, private repository authorization, live PR delivery, and trained reinforcement policies are not implemented yet.

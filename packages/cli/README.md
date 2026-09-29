# Tourist CLI

Tourist's terminal interface uses the same agent runtime as Tourist Cloud. From the Tourist repository root, install this local checkout with:

```sh
pnpm --filter tourist-agent-cli build
npm install -g ./packages/cli
tourist
```

`npm install -g tourist-agent-cli` will work after the package is published to npm. The CLI requires Node 22.12 or newer.

Set `OPENAI_API_KEY` for the default model. `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` are supported when their models are selected. The CLI loads `.env.local` from the current directory if present, so the key already added to this checkout works when you launch Tourist from the repository root. Keep keys out of Git.

```sh
tourist                         # interactive terminal
tourist plan --repo . --task "Plan a caching change"
tourist ask --repo . --task "Where is cache invalidation?"
tourist debug --repo . --task "The cache goes stale after an update"
tourist run --repo . --task "Add a cache test"
tourist run --repo . --task "Update two independent modules" --swarm-parts parts.json
tourist multi-task --repo . --tasks tasks.json
tourist memory add --repo . --scope codebase --text "Use pnpm for tests"
tourist memory list --repo .
```

`tasks.json` is an array of 2–8 task strings. Local multi-task runs each task in a separate temporary git worktree; the result branches remain in the repository. It does not merge the branches. Coding commands require a clean checkout and make a local branch and commit. Plan and ask have read-only tools. The interactive terminal supports `/plan`, `/ask`, `/debug`, `/run`, `/multi-task <file>`, `/status <id>`, `/memory`, `/model`, `/repo`, `/cloud`, `/local`, `/help`, and `/exit`. Type `/` to open the full command ribbon, or start typing a command name, such as `p` for Plan, to see matching suggestions and an inline completion. Use ↑/↓ and Tab to choose. Enter on ordinary text still submits a task. Type `models`, `/models`, or `/model` at the interactive prompt to open the model picker; use ↑/↓ to choose, type to filter, ←/→ to set supported reasoning levels, Enter to select, or Esc to cancel. `/model <id>` selects directly. The one-shot `tourist models` prints a list for scripts. The terminal colors mirror Tourist's city palette and respect `NO_COLOR`.

Cloud runs require `TOURIST_CLOUD_URL` and `TOURIST_CLOUD_TOKEN` plus a provider key. Use a public `owner/repo` name. The cloud API runs the same agent in a disposable sandbox. `tourist status <id> --cloud <url>` checks a run; `--detach` returns its ID immediately. Cloud execution requires a deployed Tourist API and `DAYTONA_API_KEY` there. The web run viewer also needs `TOURIST_WEB_VIEW_TOKEN` set on the web server. Its viewer token is entered in the page and is never placed in a public environment variable.

Scoped notes are stored in `~/.tourist/memory.json` locally, or `TOURIST_MEMORY_FILE` if set. Tourist Cloud keeps its own memory store under `/data` and combines it with notes sent by the CLI. Retrieval currently uses bounded keyword matching. Cloud runs log a versioned heuristic decision and `reward_v1` signals; automatic policy learning and promotion are future work.

## Parallel swarm run

`parts.json` is a JSON array of two to four objects with `goal`, disjoint `files`, and optional `testHints` for assigning an integrated test failure to its owner. The swarm uses one worktree per coder, merges into one local task branch, and runs tests. The same assignments can be sent to Tourist Cloud as `swarmParts`. See the runtime README for an example manifest.

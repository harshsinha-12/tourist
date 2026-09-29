# Tourist agent runtime

The runtime has a provider-neutral model router, a typed local tool registry, and three task paths:

- `solo_coder`: one coding agent.
- `coder_tester_reviewer`: sequential specialists with shared task memory and one review return to the coder.
- `swarm`: opt-in disjoint file assignments in parallel Git worktrees, followed by one integration branch and tests.

`runTask` selects among them. A swarm requires two to four explicit file assignments; a single file task remains solo or sequential. A failed integrated test returns once to the owner identified by a file name or `testHints` in the failure output. If ownership is ambiguous, the run stops for review. Stage 6 persistent memory and Stage 8 live GitHub delivery are not implemented. The GitHub tools record intended calls only.

## Models and keys

Select a model ID from `src/models/config.ts`. `src/models/router.ts` routes it to the provider. A task may pass `apiKey` and a supported `reasoningLevel` directly to `runTask`, or the runtime reads a provider key from:

| Provider | Environment variable |
| --- | --- |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Gemini | `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` |

The provider key is never passed to a tool or included in the run record. `src/models/pricing.ts` contains a standard paid-tier USD-per-million-text-token dictionary checked on 2026-09-29. Rates are estimates; provider bills include any applicable context, cache storage, tool, or regional fees. Check the linked official pricing pages before relying on them for billing.

Provider adapters use the [AI SDK Core tool loop](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) and its [OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai), [Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic), and [Google](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai) packages. To add a provider, add its model factory to `router.ts`, add model metadata to `config.ts`, and add rates to `pricing.ts`. Agents and tools do not change.

Pricing sources: [OpenAI models](https://developers.openai.com/api/docs/models/compare), [Claude models](https://platform.claude.com/docs/en/models/overview), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Local fixture use

Use a disposable Git checkout with Node tests. The runtime requires a clean checkout, creates `tourist/task-*`, edits only through registered tools, runs `node --test`, commits locally, and records an intended pull request. No push or GitHub API request occurs.

```sh
pnpm --filter @tourist/agent-runtime typecheck
pnpm --filter @tourist/agent-runtime test

# From the repository root. The CLI also reads the root .env.local if present:
pnpm --filter @tourist/agent-runtime fixture /path/to/disposable-checkout owner repo gpt-6-sol "Describe the task"
```

`runTask` and `runSoloTask` can also be imported from `@tourist/agent-runtime`. The CLI writes a redacted tool trajectory to `.git/tourist-last-run.json` in the checkout, leaving the worktree clean. The local test process is **not an OS sandbox**; use disposable, trusted fixtures until an isolated sandbox provider is wired.

For opt-in parallel work, put disjoint assignments in a JSON file and run `tourist run --repo /path/to/checkout --task "Update both modules" --swarm-parts parts.json`. The same `swarmParts` field is accepted by the cloud API. Example:

```json
[
  { "goal": "Update the parser", "files": ["src/parser.ts"], "testHints": ["parser"] },
  { "goal": "Update the renderer", "files": ["src/renderer.ts"], "testHints": ["renderer"] }
]
```

The assignment is validated with Zod and each coder can write only its assigned files. The run record includes topology, shared task memory, a redacted tool trace, and events. Tool event rules live in `src/config/tool-events.ts`. The run-scoped `build_tool` capability accepts a Zod-validated manifest for a constrained read-only line-count tool; it runs manifest fixtures before registration and exposes successful tools in the next model phase. Generated JavaScript or shell tools are not enabled.

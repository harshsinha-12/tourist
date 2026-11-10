# Self-Improving Cloud Coding Agent

## 1. Vision

Build a persistent cloud software-engineering environment where users connect a GitHub repository, describe work in natural language, and autonomous coding agents:

* understand the repository
* remember the user and codebase across sessions
* decompose complex engineering work
* spawn specialized agents when useful
* operate inside isolated cloud sandboxes
* write, run, test, debug and review code
* create missing tools when required
* learn which strategies work
* push branches and raise GitHub pull requests
* let users add their repository link through the interface, bring their OpenAI API key, and then run an AI agent that handles the rest of the work for them. The landing page will clearly explain the full experience, while the repository is presented as an interactive, city-like 3D world: the main project folder is represented as “Sectors,” each sector corresponds to a major repository folder, and every file is visualized as a uniquely shaped building arranged according to the project’s actual structure

The long-term product is not merely a coding assistant.

It is a persistent, self-improving cloud engineering organization. The repository is presented as a persistent, game-like software world with isometric pixel-art-inspired visuals, where agents visibly move between sectors, construct and modify buildings representing code, create tools in workshops, run tests in dedicated facilities, and ship completed work through animated GitHub ports. 

---

# 2. Core Product Loop

```text
User connects GitHub repo
          ↓
Repository indexed
          ↓
User gives engineering task
          ↓
Supervisor understands task
          ↓
Load for this run:
  rule files, then pins
  active user dream and active codebase dream
  recent episode headers
  Global playbooks only after Gate B
          ↓
Agent may read_memory when a fact is not in that pack
          ↓
Decide agent topology
          ↓
Provision cloud sandbox(s)
          ↓
Agent(s) inspect repo
          ↓
Use existing tools
          ↓
Missing capability?
     ↙           ↘
   No             Yes
   ↓               ↓
Continue       Tool Builder
                   ↓
             Build + test tool
                   ↓
               Tool Registry
          ↓
Code / Test / Debug
          ↓
Review Agent
          ↓
Integration tests
          ↓
Commit + Push
          ↓
Open GitHub PR
          ↓
Human / CI feedback
          ↓
Reward calculation
          ↓
Append one episode (immutable)
          ↓
Dream job writes the next memory version
          ↓
Memory eval activates that version, or keeps the previous one
          ↓
Policy update
          ↓
Future tasks improve
```

Everything emits structured events so the UI can visualize what is happening in real time.

---

# 3. Technology Stack

## Recommended V1 Stack

| Area                    | Technology                   |
| ----------------------- | ---------------------------- |
| Web application         | Next.js + TypeScript         |
| UI                      | React + Tailwind             |
| 3D world                | React Three Fiber + Three.js |
| Client state            | Zustand                      |
| Server-state/API        | TanStack Query               |
| Realtime                | WebSockets                   |
| Product API             | Fastify + TypeScript         |
| Agent runtime           | Python                       |
| Agent framework         | OpenAI Agents SDK            |
| Model API               | OpenAI Responses API         |
| Cloud sandboxes         | Daytona                      |
| Workflow jobs           | BullMQ initially             |
| Durable workflows later | Temporal                     |
| Primary database        | PostgreSQL                   |
| Managed Postgres        | Neon or Supabase             |
| Vector/search memory    | Qdrant                       |
| Hot state/cache         | Redis                        |
| Blob/artifact storage   | Cloudflare R2 or S3          |
| GitHub integration      | GitHub App + Octokit         |
| Code parsing            | Tree-sitter                  |
| Exact code search       | ripgrep                      |
| Code intelligence       | LSP servers                  |
| Observability           | OpenTelemetry + Sentry       |
| Product analytics       | PostHog                      |
| Frontend hosting        | Vercel                       |
| API/control plane       | Fly.io / Railway initially   |
| Sandbox compute         | Daytona                      |
| Production cloud later  | AWS/GCP                      |

---

# 4. Language Architecture

I would deliberately use **two languages**.

## TypeScript

Use TypeScript for:

* frontend
* control-plane API
* authentication
* GitHub integration
* WebSocket/event infrastructure
* project management
* billing
* agent status
* tool registry API
* UI events

This gives one language across almost the entire product surface.

## Python

The local Stage 1–3 agent runtime is TypeScript, alongside the existing workspace packages. Python remains an option for later:

* reinforcement learning experiments
* reward computation
* retrieval/reranking experiments
* memory extraction
* agent evaluation
* ML workflows

The provider-neutral runtime routes model calls to each provider's API while keeping tool execution in Tourist's own registry.

### Why not Rust?

Rust would make several internal operations faster, but those operations are not where most latency occurs.

A typical execution spends time on:

```text
Model request           500ms -> several seconds
Git operations          100ms -> seconds
npm install             seconds
Build                   seconds/minutes
Tests                   seconds/minutes
Sandbox lifecycle       milliseconds/seconds
Memory retrieval        tens/hundreds ms

Python orchestration    usually negligible
```

Use Rust later for specific bottlenecks if profiling identifies them.

---

# 5. Agent Runtime

The local Stage 1–3 runtime uses a provider-neutral TypeScript AI SDK tool loop. It routes OpenAI, Anthropic, and Gemini models through one agent and tool contract. The runtime remains behind our own interfaces so a later sandbox and persistent worker can replace the local fixture implementation.

The model adapter supports:

* agents
* function tools
* provider-specific reasoning settings
* bounded multi-step tool calls
* sequential specialist handoffs through shared task memory
* redacted local tool traces

Streaming, hosted sessions, MCP tools, guardrails, and sandbox agents remain future integrations.

The runtime should still sit behind our own abstraction:

```python
ModelProvider
AgentRuntime
MemoryProvider
SandboxProvider
ToolProvider
```

That keeps provider routing separate from agent roles, tools, memory, and sandbox work.

For V1:

```text
ModelProvider = OpenAI | Anthropic | Gemini
AgentRuntime = provider-neutral AI SDK tool loop
```

Later:

```text
OpenRouterProvider
LocalProvider
```

can be added without rewriting everything.

---

# 6. Bring Your Own Provider Key

For the first release:

```text
User
 ↓
Adds a key for the selected provider
 ↓
Backend validates key
 ↓
Key encrypted
 ↓
Task starts
 ↓
Agent runtime receives temporary secret
 ↓
Sandbox gets task-scoped key
 ↓
Agent operates
```

Never:

* send another user's key to a sandbox
* log API keys
* place keys in memory
* include keys in agent traces
* expose them to the browser after initial submission

Two modes should eventually exist.

### Session-only BYOK

Key exists only for the current session.

Maximum privacy, but agents cannot continue working after the session disappears.

### Persistent BYOK

Key is encrypted server-side using a KMS-managed envelope key.

This enables:

> Start task → close laptop → agent keeps working.

For the cloud-agent product, persistent encrypted BYOK will eventually be necessary.

---

# 7. Model Selection

Do not hardcode one model everywhere.

The orchestrator should assign models based on task complexity.

```text
Simple rename
    ↓
Fast/cheap OpenAI model

Small bug
    ↓
Fast coding model

Complex architecture
    ↓
Strong reasoning model

Review
    ↓
Strong reasoning model

Memory extraction
    ↓
Cheap/fast model

Routing
    ↓
Cheap/fast model
```

The system should query what models the supplied OpenAI key has access to and expose supported choices.

This also becomes an RL decision later:

```text
Given:
task type + repo + history

Which model gives the best:

quality / latency / cost ?
```

---

# 8. Cloud Agent Execution

## Recommended: Daytona

For V1 I would use Daytona rather than building the sandbox infrastructure ourselves.

Daytona currently provides isolated sandboxes with:

* dedicated filesystem
* kernel isolation
* networking
* CPU/RAM allocation
* snapshots
* volumes
* container environments
* VM environments
* process execution
* Git operations

Its documentation currently advertises container sandbox startup under 90 ms.

More importantly, Daytona already documents direct integration patterns with the OpenAI Agents SDK, including multi-turn conversations, handoffs, sandbox agents and memory across sessions.

That removes a massive amount of infrastructure work.

## Each agent gets

```text
Agent Sandbox
│
├── repository checkout
├── isolated branch/worktree
├── shell
├── package managers
├── language runtimes
├── git
├── GitHub CLI
├── ripgrep
├── Tree-sitter
├── LSP
├── browser if required
├── user-defined tools
├── agent-created tools
└── task-scoped secrets
```

---

# 9. Making the Coding Agent Fast

This should be treated as a first-class engineering goal.

## Warm sandbox templates

Maintain snapshots for common stacks:

```text
node-typescript
python
go
rust
java
fullstack-js
```

Each already contains common tooling.

Then:

```text
Cold sandbox
Node install
pnpm install
tools install
...
```

becomes:

```text
restore snapshot
clone repo
work
```

Daytona supports snapshots specifically for persistent sandbox state.

## Dependency caching

Cache:

```text
~/.npm
pnpm store
pip/uv cache
cargo registry
go modules
```

identified by lock-file hashes.

## Codebase index by commit SHA

Never re-index an unchanged repository.

```text
repo + commit SHA
        ↓
existing index?
   ↓           ↓
 YES           NO
 reuse        index
```

When five files change, update five files.

Do not re-embed 30,000 files.

## Parallel startup

These should happen simultaneously:

```text
Sandbox provisioning
        +
Memory retrieval
        +
Repo metadata loading
        +
Task planning
        +
Dependency-cache lookup
```

Not sequentially.

## Progressive context

Never dump the repository into the LLM.

Start:

```text
repo map
README
project config
important symbols
relevant memory
```

Then let tools retrieve files incrementally.

## Prefer deterministic search first

For code:

```text
Symbol lookup
    ↓
ripgrep
    ↓
LSP
    ↓
dependency graph
    ↓
semantic search
```

Vector search should complement code intelligence, not replace it.

---

# 10. Multi-Agent Architecture

**Prerequisite:** Single-Agent PR Loop Gate (Gate A in §36) must be green. Multi-agent is an amplifier, not a substitute for a reliable solo coding loop. Until Gate C, default topology remains `solo_coder` (optionally `coder_tester`).

Agents are specialists.

```text
                    Supervisor
                        │
             ┌──────────┼─────────┐
             │          │         │
             ▼          ▼         ▼
          Planner     Coder    Researcher
                         │
                  ┌──────┴──────┐
                  ▼             ▼
               Tester        Reviewer
                  │             │
                  └──────┬──────┘
                         ▼
                  Integration Agent
                         │
                         ▼
                       PR
```

Possible agents:

### Supervisor Agent

Decides:

* whether one or multiple agents are required
* decomposition
* resource allocation
* model choice
* when tasks are complete

### Coding Agent

Writes and modifies code.

### Research Agent

Handles:

* docs
* unfamiliar libraries
* APIs
* architectural research

### Testing Agent

Creates/runs:

* unit tests
* integration tests
* regression tests

### Review Agent

Checks:

* correctness
* security
* architecture
* unnecessary changes
* conventions

### Tool Builder Agent

Creates missing capabilities.

Agents communicate using **shared task memory**, not by continuously dumping complete conversation histories into each other's contexts.

---

# 11. Agent Topology Must Be Dynamic

Do not automatically spawn five agents.

For:

```text
Rename variable
```

use:

```text
Coder
```

For:

```text
Fix authentication race condition
```

use:

```text
Coder → Tester → Reviewer
```

For:

```text
Migrate monolith into multiple services
```

use:

```text
Planner
   ↓
Parallel Code Agents
   ↓
Integration Agent
   ↓
Testing
   ↓
Review
```

Eventually the learning system should determine which topology works best.

---

# 12. Memory Architecture

Memory is a derived, reviewable state over immutable history. It is not one vector database, and it is not a list of notes the agent appends during a run.

This follows the public Dreaming V3 design ([OpenAI, 4 June 2026](https://openai.com/index/chatgpt-memory-dreaming/), [Memory FAQ](https://help.openai.com/en/articles/8590148-memory-in-chatgpt)) and refuses the part of that design that fails in the open literature. Dreaming V3 replaced the 2024 saved-memory list with a background synthesis of past chats, optimized for three things: carry a fact forward after it is said once, follow preferences and constraints, and stay current as time passes ("going to Singapore in July" becomes "went to Singapore in July 2026"). The FAQ is explicit that this synthesis is broader than the summary the user can see, that saved memories stay a separate durable list, and that chat history remains the source you delete when you want something gone.

Rewriting that synthesis in place is the wrong commit boundary for Tourist. Anthropic's Dreams reads the existing store plus transcripts and writes a new store, leaving the input untouched, so a worse dream can be thrown away. Zhang's May 2026 result (arXiv 2605.12978) is why that matters: an LLM that continuously rewrites its own lessons, with no raw anchor, misgroups episodes, strips the conditions that made a lesson true, and drops below a no-memory baseline. Tourist therefore dreams the way OpenAI describes the product, and commits the way Anthropic commits the artifact.

Scopes stay. A coding agent that dreams across repositories will leak one customer's conventions into another's. Dreaming runs inside a user or inside one repository. Crossing that wall is still the global graduation pipeline below.

## What a memory has to do

Adapted from Dreaming V3's three evals, plus the constraint those evals do not have:

1. **Carry context forward.** A convention or decision stated on one task is available on the next task without being restated.
2. **Follow preferences and constraints.** "Small PRs", "pnpm", "do not add a new framework" change the diff, not just the prose.
3. **Stay current.** An in-progress migration, a failing test, or a trip-shaped fact is revised when the PR merges, the suite goes green, or the date passes. The original episode keeps the original tense.
4. **Stay in scope.** A user dream never contains another user's episodes. A codebase dream never contains another repository's private history. Global playbooks never contain secrets, raw diffs, or a single anecdote.

The dream is a lossy headline, the way Dreaming's summary is a lossy headline. Pedantic detail stays in the episode and is fetched on demand. A dream that tries to keep every number from every log is the failure mode, not the goal.

## Four layers

```text
Sources          immutable transcripts, diffs, test logs, rule files
Pins             explicit notes the dream is not allowed to rewrite
Episodes         one append-only record per finished run
Dreams           versioned synthesis, one active version per user and per repo
```

**Sources** are the source of truth. Object storage holds the transcript and the patch. Deleting a source is what eventually removes a derived claim. Turning memory off does not delete sources.

**Pins** are saved memories. The user asked to remember something, corrected the summary, or the agent saved a `code_rule` that must survive the next dream. A pin is short, addressed to one user or one repository, and editable. The current local store (`~/.tourist/memory.json`) is this layer: explicit notes, keyword retrieval, no synthesis. Dreaming does not edit a pin. A pin can name claims or topics the dream must hide ("don't mention this again" hides; it does not delete the episode).

**Episodes** are the anchor Zhang's result says you cannot throw away. One finished run appends one episode. The dream never rewrites it. A temporary run, an eval run, and a run with memory disabled append nothing and do not enqueue a dream. That is the same rule as a temporary chat: it may read memory if the caller asked it to, and it does not create any.

**Dreams** are the mutable product. Each pass writes a new version. The previous version stays. Only a version that passes the memory eval becomes the one injected into runs.

Precedence when they disagree, highest first:

```text
rule file in the checkout or the user taste file
correction pin
other pin
active dream claim
a retrieved episode snippet
```

A file the agent can open beats a paraphrase of that file. A correction beats a stale dream immediately, on the next run, without waiting for the dream job.

## User memory

One dream per user, plus that user's pins. It holds preferences, constraints, standing instructions, and current work that is not private to one repository.

```text
prefers small PRs
uses pnpm unless the repo already uses something else
do not introduce a new web framework
currently splitting the billing service (open work; re-date when it lands)
```

Instructions ("don't bring up the old ORM") are pins or hidden claims, not vibes in the prompt.

## Codebase memory

One dream per repository, plus that repository's pins. This is project-only memory: a run on repo A does not read repo B's dream or episodes. The dream holds architecture, conventions, fragile areas, open work, and decisions. It does not hold the symbol index. Search still hits the code index (§14).

```text
HTTP handlers validate with zod at the boundary
auth session migration landed on 2026-10-02; do not restart it
cache tests flake when the suite shares one Redis
```

Old chats and old diffs stay as episodes and transcripts. The dream keeps the sentence a later agent can use.

## What a dream version contains

```text
dream_id
scope                 # user | codebase
subject_id            # user id, or repo id
version               # monotonic
parent_version        # empty on a rebuild
mode                  # incremental | rebuild
status                # candidate | active | rejected | archived
cursor                # last episode id this version read
eval_id
summary               # the review page; partial on purpose
created_at
```

Each claim inside it:

```text
claim_id
kind                  # preference | constraint | instruction | fact | open_work | decision
text                  # one or two sentences
tense                 # current | upcoming | past
as_of
valid_until           # optional; the dream must revisit when it passes
evidence_ids[]        # episode ids and/or pin ids; required
status                # active | hidden | superseded
```

A claim with no evidence is rejected before the eval. The summary the user sees is a subset of active claims. Asking "what do you remember about billing?" searches claims and then episodes; it does not pretend the summary was complete.

## The dream job

A worker runs the dream. The agent loop does not. The job is queued when a dream-eligible run finishes, and on a schedule so the clock can re-date facts even when nobody has started a task. It uses a cheap model. Acceptance is not that model's opinion.

Two modes:

```text
Incremental   previous active dream + episodes after cursor + pins + now + repo events
Rebuild       episodes + pins + now + repo events, and not the previous dream's prose
```

Incremental is the default. It is how a single new run updates "migration in progress" after the pull request merges. Rebuild ignores prior dream prose and re-derives from the anchor. Run a rebuild on a schedule, after a prompt or scanner change, and whenever an incremental version has been active for a long stretch. If a rebuild scores within a small margin of the incremental candidate, keep the rebuild. That is the brake on an iterated summary drifting away from what happened.

The job must:

- change tense when time or a repo event supersedes a fact, and point at the episode that justifies the new tense
- drop claims that no longer help, not only add them; the summary has a token budget
- respect pins: a hidden topic stays out, a correction overwrites a contradicted claim
- refuse secrets, raw diffs, and private URLs (same scanners as global memory)
- leave every previous version on disk

It must not:

- write `scope=global, status=active`
- read another subject's episodes
- edit episodes, transcripts, or pins
- run for a temporary or eval run

## Activation

A candidate becomes the active dream only when the memory eval is not worse than the active version. The first dream for a subject may activate when the citation, scope, and scanner probes pass.

Probes, fixed fixtures plus samples drawn from real episodes:

```text
carry-forward    a fact stated in an older episode is used, not contradicted
preference       a pin or claim changes the action (package manager, PR size, framework)
freshness        a landed change is not described as still open
citation         every active claim is supported by its evidence ids
scope            no other repo's private facts, no other user's episodes
scanners         no secrets, raw source dumps, or private URLs
```

Failure leaves the previous version active and marks the candidate `rejected`, with the probe names attached. Rollback is selecting the previous active version. User controls on the summary (edit, hide, delete a shown claim) take effect as pins immediately; the next dream has to absorb them.

## What a run actually loads

Huge available memory, tiny active memory. Same rule as code context.

Injected up front, in this order, inside a token budget:

```text
rule files (AGENTS.md, CLAUDE.md, .cursor/rules/**, user taste file)
pins for this user and this repo
active dream summaries (user, then this repo)
headers of the last few episodes: task, outcome, one line
```

Not injected up front: the transcript archive, rejected dream versions, hidden claims, other repos, candidate global rows.

`read_memory` is the drill-down. It searches active claims, pins, and episodes for this subject and returns a bounded pack with ids. The agent calls it when the task needs a fact the summary is likely to have dropped. The supervisor may also call it once while assembling the pack. Research, coding, testing, review, and integration agents on that run see the same pack in shared task memory.

A personalization gate may omit the dream body when the task is a mechanical edit fully specified by the ticket and the rule files. Pins and rule files still load. The trajectory records `dream_id` and version, the claim ids, and the episode ids that were shown. Retrieval credit attaches to those ids, not to "memory" in the abstract.

## Episode and pin shapes

Episode, append-only:

```text
episode_id
user_id
repo_id
trajectory_id
task
outcome               # succeeded | failed | partial
tried                 # short
failed                # short, empty if nothing failed
landed                # a commit or PR exists
transcript_ref
dream_eligible        # false for temporary and eval runs
created_at
```

Pin:

```text
pin_id
scope                 # user | codebase
repo_id               # empty for user scope
kind                  # code_rule | preference | instruction | correction
text
hides[]               # claim ids or topics excluded from injection
status                # active | deleted
source                # user | agent | file
created_at
```

`write_memory` writes one pin. It does not write a dream claim. The supervisor may pin user scope. Research and coding agents may pin a codebase `code_rule` when the run learned a convention of that repo, or a user `code_rule` when the taste follows the person. `delete_memory` deletes one pin or hides one claim. It cannot clear a scope, rewrite an episode, or change a global row. Deleting the underlying episode is a retention action on the transcript, not an agent tool. Claims whose only evidence was deleted are quarantined until the next dream, which must drop them.

## Working memory

The current task's scratchpad: goal, files, hypotheses. It dies with the run. The episode is the only piece that survives, and only as a summary plus a pointer to the transcript.

## Procedural memory

A repo-local playbook ("for Prisma drift in this repo, diff the schema before rewriting SQL") is a codebase claim or a pin. A playbook that has already been generalized and evidenced on more than one repository may be proposed as a global candidate. There is no third store, and a dream cannot activate it.

## Shared task memory

The only channel between agents on one run: goal, decisions, files touched, open questions, the memory pack, and the code-rule pack. It is not a dream input except through the episode written at the end.

## Review, correction, deletion

The product shows the active summary, with an "updated" time, and says it is not everything memory can use. From that surface a person can:

- correct a line, which writes a correction pin and wins on the next run
- hide a topic, which stops injection and does not delete the episode
- delete a pin, which stops that pin immediately
- delete an episode's transcript, which quarantines claims that cited only it
- turn dreaming off and keep pins, or turn memory off entirely

Turning dreaming off does not delete episodes. Turning memory off stops injection and stops new dreams. Sources remain until they are deleted themselves. Propagation is allowed to be asynchronous; a pin or a hide is the path that is synchronous.

## Global Memory

Knowledge reusable across repositories/users.

```text
common debugging strategies
framework behaviour
successful repair patterns
tool-use patterns
general engineering knowledge
anti-patterns that repeatedly fail
```

Global Memory is **not** a dream, and it is **not** a dump of successful run notes. A dream may propose a candidate when a claim is already abstract. Only the graduation pipeline below, and in §21, can activate it. User and codebase dreams never read the global store in order to write themselves.

**Default posture: reject.** Candidates start denied. Promotion is earned.

### What may become Global Memory

```text
strategy          e.g. flaky React timer isolation before rewriting assertions
tool_pattern      e.g. when analysing Prisma drift, prefer schema-diff-tool
debug_playbook    e.g. shadow-DB migrate failure checklist
anti_pattern      e.g. full agent swarm for ≤50 LOC bugfixes wastes cost
```

### What must never become Global Memory

```text
user preferences          → user pins or the user dream
repo-specific architecture → codebase pins or the codebase dream
raw diffs / customer code  → transcripts only, never a dream or a global row
secrets, PII, private URLs → never
single-run anecdotes       → the episode; no promotion until evidence accumulates
```

### Global record shape

Pins, episodes, and dream claims have their own shapes above. A global row carries:

```text
memory_id
scope                # global
type                 # strategy | tool_pattern | debug_playbook | anti_pattern
content              # short, actionable text
content_hash         # hash of normalized content (dedupe)
abstraction_score    # 0..1 how repo-agnostic the text is
embedding_ref
confidence           # 0..1
evidence_trajectory_ids[]
supporting_repo_ids[]
reuse_count
success_attribution  # retrieved and run beat baseline
failure_attribution  # retrieved and run underperformed
status               # candidate | active | archived | rejected
reject_reasons[]     # if rejected / not promoted
created_at
updated_at
promoted_at
policy_version_at_write
```

### Sanitization logic (deterministic gates + LLM assist)

Extraction may use a cheap model. **Acceptance is rule-based.** The model proposes; the sanitizer decides.

```text
INPUT:
  raw_candidate_text
  source_trajectory_ids[]
  source_repo_ids[]

STEP 1 — Hard reject scanners (no LLM override)
  if matches secret patterns (API keys, tokens, private keys) → REJECT
  if matches PII patterns (emails, phone, auth cookies) → REJECT or mandatory redact;
      if redaction destroys meaning → REJECT
  if contains private hostnames / internal URLs → REJECT
  if contains raw source dumps (> N lines of code) → REJECT
  if contains customer proprietary identifiers that cannot be generalized → REJECT

STEP 2 — Scope classifier (LLM ok, but output enum only)
  classify content → one of:
    user_preference
    repo_specific_fact
    episodic_anecdote
    global_strategy
    garbage / too_vague
  route:
    user_preference     → user pin or user dream (never global)
    repo_specific_fact  → codebase pin or codebase dream (never global)
    episodic_anecdote   → stay an episode (no promote yet)
    garbage             → REJECT
    global_strategy     → continue

STEP 3 — Generalization rewrite (LLM ok)
  rewrite content to remove:
    - absolute file paths
    - repo / org names
    - ticket ids, PR numbers
    - environment-specific values
  require output form:
    WHEN <situation>
    DO <actionable steps>
    AVOID <anti-pattern>   # optional
  compute abstraction_score:
    + presence of WHEN/DO structure
    + absence of proper nouns / paths
    + cross-language generality where claimed
  if abstraction_score < 0.7 → REJECT for global (the episode stays; a codebase dream may still say it)

STEP 4 — Dedup + contradiction
  embed sanitized content
  if cosine_sim ≥ 0.92 with existing active/candidate global → MERGE evidence, do not create duplicate
  if contradicts higher-confidence active memory → mark conflict; do not auto-promote

STEP 5 — Emit candidate
  status = candidate
  store sanitizer report: { scanners, scope, abstraction_score, rewrite_diff }
```

Only `status=candidate` rows with a clean sanitizer report may enter the promotion evaluator.

### Promotion logic

Promotion is a scheduled job (and/or post-trajectory hook), not an inline agent side-effect.

```text
FOR each global candidate C:

  evidence = trajectories where
    C was derived from that run
    OR C.id ∈ derived_labels.useful_memories
    OR precursor episodic memory was useful and C is its generalization

  stats:
    n_traj   = |evidence|
    n_repos  = |unique repo_id in evidence|
    mean_R   = mean(reward.total for evidence with formula_version=current)
    success  = fraction(evidence with tests_ok AND (pr_merged OR user_accepted OR ci_ok))
    age_ok   = now - C.created_at ≥ min_age   # avoid promote-on-sight

  PROMOTE to active IFF ALL:
    C.sanitizer.passed
    C.type ∈ { strategy, tool_pattern, debug_playbook, anti_pattern }
    C.abstraction_score ≥ 0.7
    n_traj  ≥ 3
    n_repos ≥ 2
    mean_R  ≥ threshold_T          # e.g. aligned with reward_v1 “good run”
    success ≥ 0.66
    age_ok
    no open contradiction with higher-confidence active memory
    (optional early V1) audit_flag != blocked

  ON PROMOTE:
    status = active
    confidence = f(n_traj, n_repos, mean_R, success, abstraction_score)
    promoted_at = now
    index into Qdrant global collection

  ELSE:
    keep candidate OR reject with reject_reasons[]
```

### Retrieval rules (prevent pollution at read time)

Even active global memories can pollute if over-retrieved.

```text
ONLY retrieve memories where:
  status == active
  confidence ≥ min_retrieve_confidence

ALWAYS:
  bind each retrieved memory_id into trajectory.decisions.memory_pack
  enforce token budget for memory_pack (Context Engine)
  prefer higher confidence × relevance / token_cost

NEVER:
  inject all global memories
  retrieve archived / rejected / candidate into the agent prompt
  retrieve global memories that failed sanitizer re-check
```

### Demotion / decay logic

```text
WHEN memory M was in memory_pack AND run underperforms baseline for same task_features:
  failure_attribution++
  confidence ← confidence * 0.85   # or subtract fixed δ

WHEN memory M was in memory_pack AND run beats baseline:
  success_attribution++
  confidence ← min(1, confidence + ε)

IF confidence < archive_threshold OR failure_attribution ≥ 3 * success_attribution:
  status = archived
  remove from retrieval index (keep row for audit)

IF stronger contradictory memory is promoted:
  supersede M; link superseded_by; archive M
```

### Anti-pollution invariants

```text
1. Agents cannot write directly to Global Memory, and a dream cannot activate it.
2. Only the graduation service can set scope=global AND status=active.
3. Every active global memory has ≥ 2 repo evidence ids.
4. Every retrieval is attributable on a trajectory, including the dream version id.
5. Archived memories are never silently reactivated without re-running promotion.
6. Re-sanitize periodically; if scanners improve, re-scan actives and demote failures.
7. Episodes and transcripts are append-only. A dream writes a new version and leaves the previous one.
8. A dream version that fails the memory eval does not replace the active version.
9. Pins are not rewritten by the dream. Rule files beat pins. Pins beat dream claims.
10. A codebase dream for repo A is not readable from a run on repo B.
```

---

# 13. Memory Storage

I would use multiple systems.

## PostgreSQL - source of truth

Store:

```text
users
organizations
repositories
tasks
agents
runs
memory metadata
pins
episodes
dream versions and claims
dream cursors
tool metadata
PRs
feedback
rewards
permissions
billing
```

Recommended managed service:

**Neon PostgreSQL** initially.

## Qdrant - semantic/hybrid retrieval

Use for:

```text
code summaries
episode and dream-claim embeddings, for drill-down
global rows after Gate B
task trajectories
tool descriptions
documentation

The active dream summary is a document, not a vector hit. Inject that document. Use Qdrant when `read_memory` has to find an episode the summary dropped.
```

Qdrant supports dense + sparse hybrid retrieval and multi-stage reranking.

This matters for code because:

```text
semantic match
+
exact keyword/symbol match
```

usually beats pure embeddings.

## Redis - hot state

Use for:

```text
active agents
locks
rate limits
cached retrieval
active dream summary per user and per repo
temporary task state
presence
WebSocket state
BullMQ
```

## Object Storage

Cloudflare R2 or S3.

Store large immutable artifacts:

```text
terminal logs
agent transcripts
patches
test logs
screenshots
build output
tool packages
large traces
repository snapshots
```

Do not stuff this into Postgres.

---

# 14. Codebase Intelligence

A coding agent needs more than embeddings.

Repository indexing pipeline:

```text
Git repository
      ↓
File scanner
      ↓
Tree-sitter
      ↓
AST extraction
      ↓
Symbol graph
      ↓
Import/dependency graph
      ↓
LSP enrichment
      ↓
Summarization
      ↓
Embeddings
      ↓
Code index (chunks for search)

The codebase dream is not this index. It is a short synthesis of runs, decisions, and conventions for one repository (§12). Search hits stay in the index.
```

Store relationships like:

```text
File A
 ├─ imports B
 ├─ calls C()
 ├─ implements Interface D
 └─ tested by Test E
```

Initially these relationships can live in PostgreSQL.

I would **not add Neo4j on day one**.

A graph database sounds cool, but relational adjacency tables are enough until graph traversal becomes an actual bottleneck.

---

# 15. Self-Created Tools

**Prerequisite:** the Single-Agent PR Loop Gate in §36 must be green.

Do not invest in tool factories while the solo agent still fails basic “open a good PR” quality. Self-created tools amplify whatever quality (or chaos) already exists.

Agents can access two categories:

```text
TOOLS
├── Built-in tools
└── Agent-created tools
```

Built-ins include:

```text
shell
file read/write
git
GitHub
ripgrep
LSP
web/search
browser
test runner
package manager
```

If the agent detects a missing capability:

```text
Capability gap
     ↓
Tool Builder
     ↓
Generate tool specification
     ↓
Generate implementation
     ↓
Generate tests
     ↓
Sandbox execution
     ↓
Security validation
     ↓
Evaluate
     ↓
Register
```

---

# 16. Tool Registry

Tool metadata lives in PostgreSQL:

```text
tool_id
name
description
input schema
output schema
permissions
creator
scope
version
success rate
average latency
average cost
usage count
created_at
```

Actual tool code lives in:

```text
Git repository / object storage
```

Retrieval embeddings live in:

```text
Qdrant
```

Tools have lifecycle stages:

```text
Experimental
     ↓
Repository Trusted
     ↓
User Trusted
     ↓
Organization Trusted
     ↓
Global Trusted
```

Never promote a tool globally just because it worked once.

---

# 17. Tool Format

Initially make generated tools:

```text
CLI program
+
JSON manifest
+
JSON Schema
+
tests
```

Example:

```yaml
name: analyze_prisma_migration
version: 0.3.1

permissions:
  filesystem: read
  network: false

inputs:
  schema_path: string

outputs:
  migration_risks: array
```

Later, heavily reused tools can become MCP tools.

The OpenAI Agents SDK already supports MCP servers alongside ordinary function tools.

---

# 18. Learning / Reinforcement System

Prefer precise product language:

> **Structured policy learning over trajectories**
> (contextual bandits + retrieval credit assignment + memory graduation)

over vague claims that “the agent does reinforcement learning.”

## Non-negotiable principles

1. **Do not train foundation-model weights in V1.** Learning happens *around* the model.
2. **Do not do online PPO against the main LLM.**
3. **Every completed run must produce a trajectory + reward.** Incomplete learning records are treated as system bugs.
4. **Only discrete, versioned decisions are learned.** Free-form “policy updates” are forbidden.
5. **No policy promotion without an eval gate.** Logging alone is not learning.
6. **Dreams activate under a memory eval. Global Memory graduates under rules.** Neither is a vibe.

## What the system actually learns

```text
Which model class?
Which agent topology?
Which context budget?
Which tool pack?
Which memory pack?
Which stop policy?
Which test policy?
Which retrieved context was actually useful?   # retrieval credit
Which memories deserve promotion / demotion? # memory graduation
```

That is genuine reinforcement-driven adaptation without retraining GPT.

---

# 19. Decision Surface and Trajectory Schema

## Decision surface

The supervisor may only choose from a **fixed action space**. Each choice is logged with scores and a policy version.

| Decision key       | Example actions                                              |
| ------------------ | ------------------------------------------------------------ |
| `model`            | `fast`, `coding`, `reasoning`                                |
| `topology`         | `solo_coder`, `coder_tester`, `coder_tester_reviewer`, `full_pipeline` |
| `context_budget`   | `4k`, `8k`, `16k`                                            |
| `tool_pack`        | ordered list of tool / skill ids retrieved for the run       |
| `memory_pack`      | ordered list of memory ids retrieved for the run             |
| `stop_policy`      | `stop_on_green`, `max_3_retries`, `ask_human_on_second_fail` |
| `test_policy`      | `unit_only`, `unit_lint_type`, `full_ci`                     |

Adding a new decision key requires:

* schema change in `packages/protocol`
* default heuristic
* logging support
* eval coverage for that arm

## Task features (context for bandits)

```text
task_type              # bugfix | feature | refactor | test | docs | chore
languages[]
approx_loc_touched_estimate
repo_size_bucket       # S | M | L | XL
has_ci
has_flaky_history
prior_failures_on_area
user_preference_hints[]
```

## Trajectory schema (mandatory)

Every run writes one immutable trajectory row (Postgres) plus large artifacts (object storage).

```text
trajectory_id
task_id
repo_id
user_id
created_at
policy_version

task_features          # see above

decisions[]            # { key, action, score?, reason?, policy_version, decided_at }

events_summary[]       # compact structured events (tool calls, searches, edits)
artifact_refs[]        # transcript, patches, test logs, terminal logs in R2

outcome:
  build_ok
  tests_ok
  lint_ok
  typecheck_ok
  ci_ok                # nullable until webhook
  security_ok          # nullable
  pr_url
  pr_status            # open | merged | closed | draft
  merge_status         # pending | merged | not_merged
  revert_status        # none | reverted
  regressions_detected
  files_touched[]
  patch_size_stats

costs:
  tokens_in
  tokens_out
  latency_ms
  estimated_usd

human_feedback:        # nullable / delayed
  accepted
  rejected
  edited
  review_comment_count

derived_labels:        # filled at end / offline
  useful_files[]       # files that materially contributed to the fix
  useful_tools[]
  useful_memories[]
  wasted_retrievals[]  # retrieved but unused / harmful

reward:
  formula_version      # e.g. reward_v1
  total
  components{}         # breakdown for debugging
  finalized_at         # null until delayed signals settle
  pending_signals[]    # e.g. ci, merge, revert
```

### Completeness rule

A trajectory is **incomplete** (and should alert) if any of these are missing at end-of-run:

```text
task_features
decisions (at least model + topology + context_budget)
outcome.build_ok / tests_ok (or explicit skip reason)
costs.tokens_* / latency_ms
reward.formula_version + components
policy_version
```

Delayed fields (`ci_ok`, merge, revert, human_feedback) update the **same** trajectory asynchronously; they must not create a second conflicting record.

### Example

```text
Task: "Fix flaky React test"

decisions:
  model=coding
  topology=coder_tester
  context_budget=8k
  test_policy=unit_lint_type

Historical policy may later learn:

  coder_tester
  beats
  full_pipeline

because same success, ~45% lower cost, ~38% lower latency
on task_features matching bugfix + frontend + has_flaky_history
```

---

# 20. Reward Model

## Objective signals

```text
build success
test success
lint success
type-check success
CI success
security checks
PR merged / user accepted
user rejected
PR reverted
regressions introduced
tokens consumed
wall-clock latency
patch size / files touched unnecessarily
```

## Versioned formula: `reward_v1`

Ship the formula as **code**, not prose. Historical totals are never overwritten in place; if the formula changes, recompute offline into a new `formula_version`.

```text
R_v1 =
  +4.0  if tests_ok
  +2.0  if build_ok
  +1.0  if lint_ok AND typecheck_ok
  +3.0  if ci_ok
  +5.0  if pr_merged OR user_accepted
  -5.0  if user_rejected
  -8.0  if reverted
  -2.0  if regressions_detected
  -1.0  * log(1 + excess_latency_minutes)
  -0.5  * log(1 + excess_token_units)
  -1.0  * unnecessary_files_touched_penalty
```

Store:

```text
reward.total
reward.components = {
  tests_ok: 4.0,
  build_ok: 2.0,
  ...
}
```

so operators can answer “why did this run score high/low?”

## Delayed reward settlement

```text
t0  run ends          → provisional reward (missing CI/merge)
t1  CI webhook        → update ci_ok, recompute components
t2  merge / close     → update acceptance signals
t3  revert window     → optional negative update (e.g. 7–14 days)
t_final               → reward.finalized_at set; pending_signals empty
```

Bandit updates may use provisional reward for online exploration, but **policy promotion eval must prefer finalized trajectories** (or apply an explicit delay filter).

## Retrieval credit assignment

After a successful (or clearly failed) run, derive:

```text
useful_files      = files edited that tests / review depended on
                  ∪ files heavily read immediately before correct edit
useful_tools      = tools whose outputs changed the plan or patch
useful_memories   = memories cited or whose content appears in decisions
wasted_retrievals = retrieved items never read / contradicted / harmful
```

These labels train **retrieval and memory policies**, not only topology/model bandits.

---

# 21. Policy Learning, Gates, and Global Memory Graduation

## Learning stages (with hard gates)

| Stage | Mechanism | Allowed when | Promotion gate |
| ----- | --------- | ------------ | -------------- |
| 0 | Heuristics + full trajectory/reward logging | Always | Always on; no learning claim |
| 1 | Contextual bandits per decision key | ≥ N finalized trajectories overall | Per-arm minimum samples + confidence interval vs baseline |
| 2 | Offline preference pairs from trajectories | Labeled accept/reject or pairwise outcomes | Holdout preference accuracy / win rate vs heuristic |
| 3 | Retrieval policy from useful_* labels | Stable Stage 0–1 logging | Measurable retrieval lift on eval (precision@k / tokens to success) |
| 4 | Distill / fine-tune routers or retrievers | Clear Stage 1–3 gains | Offline + shadow beat baseline on eval suite |
| 5 | Advanced offline RL | Substantial real trajectory volume | Explicit research review; not default product path |

**Do not attempt Stage 5 until the product has substantial real-world trajectory data.**

## Policy versions

```text
policy_id
version            # monotonic
stage              # 0..5
decision_keys[]    # which arms this policy controls
artifact_ref       # model weights / bandit tables / config
created_from_eval_id
status             # shadow | canary | active | rolled_back | archived
```

Runtime always records `policy_version` on the trajectory.

## Promotion / rollback rules

A candidate policy may move `shadow → canary → active` only if:

```text
1. Eval suite run completes (see below)
2. Primary metric improves by ≥ δ OR cost/latency improves at non-worse success
3. No severe safety regressions (secret leaks, destructive git, permission violations)
4. Shadow traffic (optional) shows same direction as offline eval
5. Rollback plan exists (previous active version one click away)
```

If canary success drops below baseline by ε, **automatic rollback**.

## Eval harness (required before any “self-improving” claim)

Maintain a fixed suite:

```text
20–50 canned tasks
across 3–5 fixture repositories
metrics:
  - task success (CI-green PR or equivalent)
  - reward_v1 mean
  - tokens / task
  - latency / task
  - human preference sample (periodic)
```

Every policy change that affects decisions must:

```text
run offline eval
  → optionally shadow
  → only then canary/active
```

No eval harness → no RL marketing claims; only analytics.

## Global Memory graduation pipeline

The full sanitization, promotion, retrieval, demotion, and anti-pollution invariants live in **§12**. Dream activation is a separate gate from this pipeline: a user or codebase dream becomes active by winning the memory eval against the previous version, and that does not promote anything to global.

Operational summary:

```text
Append-only episodes
        ↓
Dream job (incremental or rebuild) — proposes the next version only
        ↓
Memory eval (carry-forward, preference, freshness, citation, scope, scanners)
        ↓
Active user dream or active codebase dream — previous version kept
        ↓
A claim that is already abstract may be copied out as a global candidate
        ↓
Deterministic sanitizer (scanners → scope → generalize → dedupe)
        ↓
global_candidates (status=candidate)
        ↓
Promotion job (multi-traj, multi-repo, reward, abstraction gates)
        ↓
Global Memory (status=active) — only graduation service can write this
        ↓
Budgeted retrieval + attribution on trajectory
        ↓
Confidence decay / archive on underperformance
```

**Agents never write Global Memory directly.**

### Coupling loop (memory ↔ RL)

```text
Policy decides memory_pack / tool_pack / context
        ↓
Execute run
        ↓
Outcome + reward_v1
        ↓
Append one episode when the run is dream-eligible
        ↓
Label useful claims, episodes, tools, and files
        ↓
Update:
  1) bandit arms for decision keys
  2) retrieval scores on the ids that were shown
  3) the next dream's keep/drop choices, and global confidence / promotion / demotion
```

This is the operational definition of self-improvement for Tourist:

```text
better decisions + better retrieval + stricter memory
— not silent weight updates on the frontier model.
```

---



# 22. GitHub Architecture

Use a **GitHub App**, not user PATs.

Permissions should be minimal.

Flow:

```text
GitHub App installed
      ↓
Repository selected
      ↓
Agent task starts
      ↓
Create task branch
      ↓
Agent modifies repository
      ↓
Commit
      ↓
Push
      ↓
Create PR
      ↓
CI starts
      ↓
CI webhook returns
      ↓
Failed?
  ↙        ↘
yes        no
 ↓          ↓
Agent      Review
fixes       ↓
 ↓         Ready
Push
```

Parallel agents should work on separate branches/worktrees.

An integration agent combines their outputs before creating the final PR.

---

# 23. Event Architecture

Every meaningful action becomes an event.

```json
{
  "event": "file.editing",
  "repo": "harsh/project",
  "task": "task_451",
  "agent": "coder_02",
  "path": "src/auth/session.ts"
}
```

Other events:

```text
task.created
agent.spawned
agent.walking
memory.retrieved
file.read
file.editing
file.changed
tool.called
tool.created
test.started
test.failed
test.passed
commit.created
branch.pushed
pr.created
review.started
agent.completed
```

This event model powers both observability and visualization.

The visualization layer consumes these events and translates them into world actions.

For example:

```text
agent.spawned
    → character appears at Command Center

file.read
    → agent visits building

file.editing
    → construction site activates

tool.created
    → Tool Workshop animation

test.started
    → Testing Facility activates

branch.pushed
    → cargo moves toward port

pr.created
    → ship departs harbor

pr.updated
    → additional cargo / construction activity

pr.merged
    → ship arrival / project completion animation

This creates a strict separation between:

Agent Runtime
    ↓
Structured Events
    ↓
World State
    ↓
Visual Animation

The frontend should never infer engineering activity from terminal text.

---

# 24. Queue / Workflow Infrastructure

For the first prototype:

```text
Redis + BullMQ
```

You already know this stack, it is fast to build, and is sufficient for:

```text
indexing
embedding
background tasks
tool evaluation
memory extraction
agent jobs
```

Once agents routinely run for tens of minutes/hours and must survive process crashes, approvals and deployment restarts, move the outer task lifecycle to **Temporal**.

OpenAI's Agents SDK documentation explicitly lists Temporal among its durable-execution integrations.

So eventually:

```text
Temporal Workflow

Task
 ↓
Provision sandbox
 ↓
Run agents
 ↓
Wait for human approval
 ↓
Resume
 ↓
Push PR
 ↓
Wait CI
 ↓
Fix
 ↓
Complete
```

---

# 25. Realtime Transport

Use:

```text
Agent Worker
    ↓
Event Bus
    ↓
API Gateway
    ↓
WebSocket
    ↓
Browser
```

Do not parse terminal text into animations.

The runtime produces structured events directly.

The terminal transcript is merely another consumer.

---

# 26. 3D Visualization

The city is a **first-class product surface**, not a late cosmetic layer.

Build the **City Foundation early** (world schema, art direction, repo→layout generator, report attachment points). That contract is what agent events, trajectories, and public reports plug into later.

**Still true:** a fully *live* agent-driven city needs real events from the coding loop (Gate A). Do not fake agent quality with animations. Do design the city so integration has a home.

## City as public report

A Tourist **Public Report** is not only markdown or logs. It is (or embeds) a **city artifact**:

```text
Task / run completes
      ↓
ReportComposer builds structured report
  - summary, outcomes, reward components
  - files touched, tests, PR link
  - trajectory highlights
      ↓
WorldGenerator creates or updates CitySnapshot
  - sectors/buildings for involved paths
  - landmarks for tests / PR port / failures
      ↓
PublicReport
  - shareable URL
  - city viewer (read-only or highlight mode)
  - report panels attached to buildings / districts / harbor
```

Attachment model:

```text
report.sections[] → anchor_id in city
  e.g. file diff     → building(path)
       test results  → Testing Facility
       PR / merge    → Harbor / Port
       failures      → warning district / building state
       agent steps   → character path highlights
```

When a public report is created, **the city for that report is generated (or snapshotted) as part of report creation** — not manually assembled afterward.

Private in-product city (live repo world) and public report city (immutable snapshot for a run) share the same world schema; visibility and mutability differ.

## Do not use Plotly

Plotly is primarily for:

```text
charts
graphs
financial visualizations
analytical dashboards
```

This product needs a persistent interactive world.

Use:

**React Three Fiber + Three.js**

React Three Fiber integrates the Three.js scene graph directly into React.

Three.js provides WebGL rendering and scene-graph primitives required for the city.

### Scene mapping

```text
Repository
      ↓
Island / City

Directory
      ↓
District

File
      ↓
Building

Package
      ↓
Large complex

Database
      ↓
Data center

External API
      ↓
Port / Gateway

Agent
      ↓
Character

Code edit
      ↓
Construction animation

New file
      ↓
New building

Delete file
      ↓
Demolition

Tests
      ↓
Testing facility / animation

PR
      ↓
Construction project

Merge
      ↓
Project completed
```

## Visual Art Direction

The repository world should use a stylized **isometric pixel-art / low-poly game aesthetic**, inspired by city-building and strategy games such as Clash of Clans, while remaining visually distinct and purpose-built for software development.

The goal is not to create a static visualization of a repository. The world should feel alive and continuously react to engineering activity.

Each repository is represented as a persistent island or city.

```text
Repository
    ↓
Island / City

Major folder
    ↓
Sector

Subdirectory
    ↓
District

File
    ↓
Building

Shared infrastructure
    ↓
Special-purpose structures

Agent
    ↓
Character / Worker

Different parts of the engineering system can have recognizable landmarks.

Main repository / orchestration
    → Command Center

Code-heavy sector
    → Construction District

Testing infrastructure
    → Testing Facility

Memory system
    → Archive / Data Center

Tool Registry
    → Tool Workshop

Research agents
    → Research Lab

Review agents
    → Review Center

Git / PR workflow
    → Harbor / Port

Database
    → Data Center

CI/CD
    → Industrial / Deployment Zone

Buildings should not all look identical. Their visual appearance can encode useful information such as:

programming language
file type
file size
directory
importance / centrality
recent activity
test coverage
change frequency
current agent activity

The visualization should remain understandable even when the repository contains thousands of files.

Later on, what we can also do is integrate another image generation or some kind of agent which will design the building as per the file itself. If we don't have that kind of mapping or something in the database or codebase for different kinds of buildings, maybe:
- TypeScript will have a different design of building
- Python will have a different design of building
- JS will have a different design of building
- and so on for everything else


---

### 2. Immediately after that, add a subsection for the living city

This is the bit about **agents, ships, ports, cranes, background movement, etc.**

```md
## Living World and Ambient Activity

The repository city should behave like a living environment rather than a static code map.

Agents are represented as characters moving through the world and interacting with the structures corresponding to the files, modules, tools, or services they are currently working with.

Different agent roles can have distinct visual identities.

Examples:

```text
Planner Agent
    → Architect / strategist character

Coding Agent
    → Engineer / builder

Research Agent
    → Researcher

Testing Agent
    → QA / testing specialist

Review Agent
    → Inspector

Tool Builder Agent
    → Mechanic / workshop engineer

Integration Agent
    → Harbor / logistics operator


The system should visualize agent activity through animations.

Agent starts editing file
    → walks toward corresponding building

File modification
    → crane / construction animation

New file
    → new building rises

Deleted file
    → building demolition

Tests running
    → activity at Testing Facility

Tests passing
    → success animation / lights

Tests failing
    → warning animation

Tool creation
    → agent enters Tool Workshop

Tool successfully registered
    → new equipment / structure appears

Pull request creation
    → cargo prepared at harbor

Branch push / PR update
    → ship departs from port

PR merged
    → ship arrives / construction completes

The environment should also contain ambient background activity that makes the world feel persistent and alive even when the user is not directly interacting with it.

Examples:

ships moving between repository ports
small service vehicles travelling between sectors
cranes operating around actively edited files
agents walking between buildings
boats arriving when remote Git activity occurs
lights switching on in active buildings
background traffic following dependency relationships
ports becoming active during GitHub synchronization
weather, water, vegetation, or subtle environmental animation

These animations should be driven by actual system state whenever possible rather than being purely decorative.

The visual world therefore acts as a realtime representation of the engineering system itself.

---

# 27. Rendering Performance

A repository can contain thousands of files.

Do not create thousands of heavyweight React components.

Use:

```text
InstancedMesh
LOD
object pooling
frustum culling
on-demand rendering
batched geometry
```

React Three Fiber specifically supports on-demand rendering so the scene does not need to continuously render at 60 FPS when nothing changes.

Only animate active parts of the city.

---

# 28. Frontend Architecture

```text
Next.js
│
├── Dashboard
├── Project selector
├── Task composer
├── 3D City
├── Agent Inspector
├── File Inspector
├── Memory Inspector
├── Tool Workshop
├── Terminal
├── Diff Viewer
├── PR Viewer
├── Cost/usage
└── Settings
```

Suggested libraries:

```text
React Three Fiber
Drei
Zustand
TanStack Query
Monaco Editor
Tailwind
Framer Motion
```

The 3D world itself should not contain every UI control.

Use React DOM overlays for:

```text
chat
diffs
terminal
tool details
settings
logs
```

and WebGL only for the world.

---

# 29. Persistence of the City

The city should be persistent.

```text
Repository commit
        ↓
World generator
        ↓
World state
        ↓
PostgreSQL / object snapshot
```

When a user returns tomorrow:

```text
same city
same buildings
previous PRs
past agents
learned tools
project history
```

Only changed portions need regeneration.

The persistent world should also retain higher-level engineering state.

Examples:

- previously completed PR projects
- agent-created tools
- important codebase landmarks
- repository growth over time
- historical activity zones
- currently active agents
- active branches and pull requests
- ports associated with remote Git activity

When the user returns to the application, the city should feel like the same software world they left behind rather than a newly generated visualization.

---

# 30. Hosting Architecture

## V1

```text
                     INTERNET

                        │
                        ▼
                  ┌───────────┐
                  │  Vercel   │
                  │ Next.js   │
                  └─────┬─────┘
                        │
                        ▼
                ┌───────────────┐
                │ API / Control │
                │ Fastify + TS  │
                │ Railway/Fly   │
                └───────┬───────┘
                        │
         ┌──────────────┼───────────────┐
         │              │               │
         ▼              ▼               ▼
      Redis         PostgreSQL        Qdrant
         │              │               │
         │              │               │
         └──────┬───────┴───────────────┘
                │
                ▼
        ┌─────────────────┐
        │ Python Agent    │
        │ Workers         │
        └────────┬────────┘
                 │
                 ▼
           ┌───────────┐
           │  Daytona  │
           │ Sandboxes │
           └─────┬─────┘
                 │
                 ▼
              GitHub
```

Object storage sits alongside Postgres for large artifacts.

---

# 31. Production Evolution

Do **not** start with Kubernetes.

Eventually:

```text
Vercel
   ↓
AWS ALB
   ↓
ECS / EKS
   ↓
Agent workers
   ↓
Sandbox infrastructure
```

But only after traffic justifies it.

You should initially spend engineering time on:

```text
agent quality
latency
memory
tool creation
repository intelligence
visual UX
```

not cluster management.

---

# 32. Suggested Repository Structure

```text
cloud-agent/
│
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
│
├── services/
│   ├── agent-runtime/       # Python
│   ├── memory/
│   ├── indexing/
│   ├── learning/
│   └── tool-builder/
│
├── packages/
│   ├── protocol/
│   ├── github/
│   ├── events/
│   ├── database/
│   ├── world-generator/
│   ├── tool-sdk/
│   └── shared/
│
├── infra/
│
├── docker/
│
└── docs/
```

Make the event schemas a shared package.

That way TypeScript and Python agree on:

```text
AgentEvent
Task
ToolCall
MemoryRecord
Reward
WorldEvent
```

Use JSON Schema / Pydantic-generated schemas for cross-language compatibility.

---

# 33. Security Model

This is extremely important because the agent executes arbitrary code.

Each task must have:

```text
isolated sandbox
filesystem isolation
network policy
CPU limits
RAM limits
timeout
secret isolation
GitHub permission scope
audit log
```

Agent-created tools should **never execute on control-plane infrastructure**.

Always:

```text
Tool code
   ↓
Sandbox
   ↓
Tests
   ↓
Static analysis
   ↓
Permission check
   ↓
Execution
```

Dangerous actions should support human approval.

For example:

```text
production deployment
database migration
secret modification
force push
dependency publication
cloud infrastructure changes
```

---

# 34. Observability

Track each task as a trace:

```text
Task
├── planning
├── memory retrieval
├── model calls
├── tool calls
├── file edits
├── tests
├── commits
└── PR
```

Record:

```text
latency
tokens
cost
tool failures
sandbox time
memory hits
test failures
agent handoffs
```

The OpenAI Agents SDK already provides built-in tracing for agent runs.

Use OpenTelemetry around the rest of the platform so model traces and infrastructure traces eventually correlate.

---

# 35. Performance Targets

Initial engineering targets should be something like:

```text
UI acknowledgement            <100 ms

Memory lookup                 <200 ms

Existing code index lookup    <100 ms

Warm sandbox creation         <1 sec

Task visibly starts           <2 sec

Agent events                  realtime streaming

Incremental repo indexing     changed files only
```

The actual coding duration depends on model inference, repo complexity and tests.

The user should **never stare at a spinner wondering what is happening**.

Even if a build takes 90 seconds, the city should immediately show:

```text
Agent spawned
↓
Agent entered auth district
↓
Reading session.ts
↓
Editing middleware
↓
Running tests
```

Perceived speed matters almost as much as absolute speed.

---

# 36. MVP Scope and Quality Gates

Do not build everything simultaneously.

**Hard rules:**

1. **City Foundation early** — design the world, schema, and report-attachment model first so later agent/memory/PR work integrates into a real surface (see §26).
2. **Gate A still required for live agent quality** — multi-agent swarms and Tool Builder stay blocked until the solo PR loop is reliable. Fancy city ≠ working agent.
3. **Public reports generate cities** — report creation produces/updates a `CitySnapshot` with anchored sections.

## Track 0 — City Foundation (start immediately / in parallel with MVP 1)

Purpose: integration contract + brand + reporting surface.

Build:

```text
world schema (Sector, District, Building, Landmark, AgentPawn, Anchor)
art direction + building archetypes by language/file kind
repo tree → layout generator (even from static fixture repos)
city viewer shell (R3F) with camera, LOD, instancing basics
report anchors API (section → building/landmark)
PublicReport draft model + share URL stub
CitySnapshot persist (Postgres metadata + object storage blob)
```

Driven initially by:

```text
fixture repositories
mock events
manual / scripted report fixtures
```

**Exit:** open a shareable report page that shows a generated city for a fixture repo, with at least summary + file/test/PR anchors.

This track **defines** `packages/world-generator` and city event consumers early so MVP 1 emits into a known shape.

## Gate A — Single-Agent PR Loop (required for live agents; parallel to Track 0)

Topology locked to:

```text
solo_coder
  or
coder_tester   # optional thin second step, still one coding agent
```

Forbidden until Gate A is green:

```text
full multi-agent topologies (planner swarms, parallel coders, integration agent)
self-created Tool Builder / registry product work
claiming “live autonomous city” as done without real agent events
Global Memory promotion to active
  (episodic + codebase memory logging may exist; global stays candidate-only or off)
```

**Explicitly allowed before Gate A:**

```text
City Foundation (Track 0)
public report + city snapshot from fixtures / mock runs
event schema + text inspector
```

### Gate A exit criteria (all required)

```text
1. Loop works end-to-end on real repos:
   GitHub connect → BYOK → Daytona → edit/test → commit → push → open PR

2. Eval suite (fixture repos, ≥ 20 tasks) with topology=solo_coder:
   success_rate ≥ target_S
   median latency within budget
   median tokens within budget

3. Learning integrity:
   100% of completed runs write a complete trajectory
   reward_v1 components present
   delayed CI/merge hooks update the same trajectory

4. Safety:
   no key leakage in logs/traces
   sandbox credentials task-scoped
   no destructive defaults on default branch

5. Operability:
   failures inspectable via events / inspector / city highlights when wired
   flaky infra does not masquerade as agent success

6. Report bridge (once Track 0 exists):
   a real agent run can mint a PublicReport whose CitySnapshot reflects that run
```

Until Gate A passes, agent roadmap language is:

> Prove: "Give it a repo and issue, get a useful PR."

City roadmap language (parallel) is:

> Prove: "A report creates a city you can share and navigate."

## MVP 1 - Cloud Coding Agent (Gate A)

Build:

```text
GitHub App + repository import
BYOK OpenAI key
user task
Daytona sandbox
single coding agent
file editing + shell + tests
Git commits + branch push
PR creation
events conforming to city/world schema
trajectory + reward_v1 writers
PublicReport from real run → CitySnapshot (uses Track 0)
```

## MVP 2 - Codebase Intelligence + Scoped Memory

After Gate A is green (or in parallel *without* starving Gate A or Track 0).

Add:

```text
repo indexing (Tree-sitter, hybrid search)
Context Engine (discover, don't dump)
pins (explicit notes and code rules)
append-only episodes
versioned user and codebase dreams, activated by the memory eval
old task retrieval through read_memory
richer city layout from index (symbols / importance → building prominence)
```

Global Memory extractor may invent **candidates**, but **promotion stays off** until §12 rules + Gate B; prefer Gate A remaining green.

## Gate B — Memory Safety

Before any active Global Memory retrieval in production, and before a dream version can replace the one a run loads:

```text
sanitizer scanners live on dreams and on global candidates
scope classifier routes correctly on a labeled test set
dream eval covers carry-forward, preference, freshness, citation, and scope
a failed dream eval keeps the previous version
promotion job enforces multi-traj + multi-repo gates
retrieval budget + attribution on trajectories, including dream version id
demotion path tested
```

## MVP 3 - Living City (bind real agent life onto Track 0)

Track 0 already has generation + reports. MVP 3 makes the in-product world **live**:

```text
agent characters driven by real events
construction / demolition animations
testing facility live states
harbor activity on push/PR/merge
diff overlays on buildings
ambient motion only where backed by state
```

**Rule:** if Gate A regresses, pause *living* city polish; keep report/snapshot path working.

## Gate C — Multi-Agent Readiness

Unlock planner / parallel coders / integration agent only when:

```text
Gate A still green on solo baseline
coder_tester already logged as a decision arm with trajectories
eval shows which task_features need more than solo
shared task memory + branch/worktree isolation exist
topology is a logged decision key (not hard-coded swarm)
```

## MVP 4 - Multi-Agent

Add only after Gate C:

```text
supervisor topology selection
planner / coder / researcher / tester / reviewer as needed
parallel sandboxes when topology requires
shared task memory
integration agent
multi-agent activity visible as multiple pawns in the city
```

Default for simple tasks remains `solo_coder`.

## Gate D — Tool Builder Readiness

Unlock self-created tools only when:

```text
Gate A green
built-in tools cover the common loop well
capability-gap detection has precision (not spam)
sandbox can test generated tools in isolation
permission model + registry versioning exist
dynamic tool discovery (no loading 500 schemas) exists
```

## MVP 5 - Tool Creation

Add only after Gate D:

```text
capability detection
tool builder
sandbox validation
tool registry
semantic tool discovery
tool reuse with reward attribution
Tool Workshop landmark updates when tools are created
```

## MVP 6 - Learning (starts during MVP 1; deepens later)

Trajectory + `reward_v1` begin in MVP 1; report city can show reward/outcome badges.

Later, after Gates A–B:

```text
useful_* credit assignment
eval harness as release gate
contextual bandits behind promotion gates
dream activation and global memory graduation (§12)
shadow → canary → active policy versions with rollback
```

Do **not** claim self-improvement until eval gates exist.

### Sequencing diagram

```text
Track 0 ── City Foundation + PublicReport→CitySnapshot
    │         (fixture/mock first, schema forever)
    │
    ├──────── MVP1 Gate A ── solo PR loop + trajectories
    │              │
    │              └─ real runs mint reports that generate cities
    │
    ├──────── MVP2 indexing + scoped memory
    │              └─ Gate B ─ active Global Memory
    │
    ├──────── MVP3 living city (bind live agents onto Track 0)
    │
    ├──────── Gate C ─ MVP4 multi-agent
    │
    ├──────── Gate D ─ MVP5 tool builder
    │
    └──────── MVP6 bandits / retrieval learning (eval-gated)
```

---

# 37. What I Would NOT Build Initially

Avoid:

```text
Kubernetes
custom Firecracker infrastructure
graph database
training your own LLM
online PPO
vague “RL” without schemas, rewards, or eval gates
unfiltered writes into Global Memory
10-agent swarms
custom vector database
custom container platform
complex blockchain-style tool reputation
```

All of these are interesting.

Almost none are necessary to establish product-market value.

---

# 38. V1 Stack I Would Personally Choose

If I were starting the repository today:

```text
Frontend
Next.js + TypeScript
React
React Three Fiber
Three.js
Tailwind
Zustand
TanStack Query

Control Plane
Node.js
TypeScript
Fastify
WebSocket
BullMQ

Agent Runtime
Python
OpenAI Agents SDK
OpenAI Responses API

Execution
Daytona

Database
Neon PostgreSQL

Memory Search
Qdrant Cloud

Realtime / Queue / Cache
Redis / Upstash Redis

Artifacts
Cloudflare R2

Git
GitHub App
Octokit

Code Intelligence
Tree-sitter
ripgrep
Language Servers

Observability
OpenTelemetry
Sentry
OpenAI tracing

Hosting
Vercel - web
Railway/Fly - API + workers
Daytona - code execution

Later
Temporal Cloud - durable agent workflows
AWS/GCP - scaled control plane
```

---

# 39. The Architectural Principle

Keep four things independent:

```text
Intelligence
    OpenAI models

Orchestration
    your agent runtime

Execution
    Daytona sandboxes

State
    your memory/database systems
```

That separation is crucial.

Otherwise you end up building:

> an OpenAI wrapper running in Daytona

instead of:

> a persistent engineering platform whose intelligence provider and execution provider can be replaced independently.

---

# 40. Final Product Mental Model

The best way to think about the system is:

```text
ChatGPT/Codex
        +
GitHub
        +
Cloud IDE
        +
Memory system
        +
Agent organization
        +
Tool ecosystem
        +
Learning system
        +
3D game-like visualization
```

The visual city is what users see.

The cloud agent runtime is what performs the work.

Memory gives the organization continuity.

Tools give it capabilities.

Structured policy learning (trajectories, rewards, gates, memory graduation) gives it adaptation.

GitHub gives it the ability to ship.

And the event architecture connects all of those pieces into one product.

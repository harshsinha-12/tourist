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
Retrieve:
  User Memory
  Codebase Memory
  Global Memory
  Relevant historical tasks
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
Memory + policy update
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

Use Python specifically for:

* LLM orchestration
* OpenAI Agents SDK
* reinforcement learning experiments
* reward computation
* retrieval/reranking experiments
* memory extraction
* agent evaluation
* ML workflows

OpenAI's current Agents SDK is Python-first and already supports agents, tools, handoffs, guardrails, sessions, tracing and isolated sandbox agents. The SDK uses the Responses API by default.

### Why not Rust?

Rust would make several internal operations faster, but those operations are not where most latency occurs.

A typical execution spends time on:

```text
OpenAI request          500ms -> several seconds
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

Use the OpenAI Agents SDK initially.

It already supports:

* agents
* agents as tools
* handoffs
* function tools
* MCP tools
* sessions
* guardrails
* streaming
* tracing
* sandbox agents

These map almost directly to our architecture.

The runtime should still sit behind our own abstraction:

```python
ModelProvider
AgentRuntime
MemoryProvider
SandboxProvider
ToolProvider
```

That prevents us from coupling the product permanently to OpenAI's SDK.

For V1:

```text
ModelProvider = OpenAI
AgentRuntime = OpenAI Agents SDK
```

Later:

```text
AnthropicProvider
GeminiProvider
OpenRouterProvider
LocalProvider
```

can be added without rewriting everything.

---

# 6. Bring Your Own OpenAI Key

For the first release:

```text
User
 ↓
Adds OpenAI API key
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

Memory is not one vector database.

Use distinct scopes.

## User Memory

Persistent across projects.

Examples:

```text
prefers TypeScript
uses pnpm
likes small PRs
prefers FastAPI
doesn't like excessive abstraction
```

## Codebase Memory

Scoped to a repository.

Stores:

```text
architecture
directory meanings
symbol summaries
important dependencies
coding conventions
historical bugs
architecture decisions
old PR discussions
old agent chats
previous fixes
known fragile areas
```

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

Global Memory is **not** a dump of successful run notes. It is a **graduated, sanitized, evidence-backed** store. Nothing enters Global Memory without passing the promotion pipeline defined below and in §21.

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
user preferences          → User Memory
repo-specific architecture → Codebase Memory
raw diffs / customer code  → never
secrets, PII, private URLs → never
single-run anecdotes       → stay Episodic until evidence accumulates
```

### Memory record shape (all scopes)

Every memory row should carry:

```text
memory_id
scope                # user | codebase | global | episodic | procedural
type                 # strategy | tool_pattern | debug_playbook | anti_pattern | convention | decision | ...
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
    user_preference     → User Memory path (never global)
    repo_specific_fact  → Codebase Memory path (never global)
    episodic_anecdote   → stay episodic (no promote yet)
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
  if abstraction_score < 0.7 → REJECT for global (may keep as codebase/episodic)

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
1. Agents cannot write directly to Global Memory.
2. Only the graduation service can set scope=global AND status=active.
3. Every active global memory has ≥ 2 repo evidence ids.
4. Every retrieval is attributable on a trajectory.
5. Archived memories are never silently reactivated without re-running promotion.
6. Re-sanitize periodically; if scanners improve, re-scan actives and demote failures.
```

## Episodic Memory

What happened.

```text
Task #351
attempt 1 failed
attempt 2 changed auth middleware
tests failed due to cache
third approach passed
user accepted PR
```

## Working Memory

Short-lived current-task context.

## Procedural / Tool Memory

How to perform capabilities.

```text
"When analysing Prisma migration drift, use schema-diff-tool."
```

## Shared Task Memory

Allows agents working on the same task to exchange discoveries.

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
old chats
decisions
memory records
task trajectories
tool descriptions
documentation
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
Codebase Memory
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
6. **Global Memory graduates under rules**, not vibes.

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

The full sanitization, promotion, retrieval, demotion, and anti-pollution invariants live in **§12 Global Memory**.

Operational summary:

```text
Episodic / procedural outcomes
        ↓
Candidate extractor (cheap model) — proposes only
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
Label useful_memories / useful_tools / useful_files
        ↓
Update:
  1) bandit arms for decision keys
  2) retrieval scores
  3) memory confidence, promotion, demotion
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

**Prerequisite:** Gate A (single-agent PR loop) must be green before the city is a delivery milestone. During MVP 1, ship a text event stream / run inspector first. The city visualizes real events; it must not block agent quality work (§36).

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

**Hard rule:** Self-created tools, multi-agent swarms, and the 3D city as a product surface must not divert engineering from a reliable single-agent PR loop. Those systems amplify quality; they do not create it.

## Gate A — Single-Agent PR Loop (must pass first)

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
3D city as a primary delivery milestone
  (event stream + simple UI inspector are allowed earlier)
Global Memory promotion to active
  (episodic + codebase memory logging may exist; global stays candidate-only or off)
```

### Gate A exit criteria (all required)

```text
1. Loop works end-to-end on real repos:
   GitHub connect → BYOK → Daytona → edit/test → commit → push → open PR

2. Eval suite (fixture repos, ≥ 20 tasks) with topology=solo_coder:
   success_rate ≥ target_S          # e.g. 60%+ CI-green or accepted PR equivalent early on
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
   failures are inspectable via event stream / run inspector
   flaky infra (sandbox/GitHub) does not masquerade as agent success
```

Until Gate A passes, roadmap language is:

> Prove: "Give it a repo and issue, get a useful PR."

Not:

> Build the city / swarm / tool factory.

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
streaming event log / run inspector
trajectory + reward_v1 writers
```

Nothing else is required for MVP 1.

## MVP 2 - Codebase Intelligence + Scoped Memory

Only after Gate A is green (or in parallel *without* blocking Gate A).

Add:

```text
repo indexing (Tree-sitter, hybrid search)
Context Engine (discover, don't dump)
user memory
codebase memory
episodic memory
old task retrieval
```

Global Memory extractor may invent **candidates**, but **promotion stays off** until sanitizer + multi-repo evidence rules from §12 are implemented and Gate A remains green.

## Gate B — Memory Safety

Before any active Global Memory retrieval in production:

```text
sanitizer scanners live
scope classifier routes correctly on a labeled test set
promotion job enforces multi-traj + multi-repo gates
retrieval budget + attribution on trajectories
demotion path tested
```

## MVP 3 - Visual World (after events exist; after Gate A)

The city **visualizes** the agent. It must not become the agent.

Allowed early (during MVP 1):

```text
WebSocket events
text activity stream
run inspector
```

Allowed as MVP 3 only after Gate A:

```text
repo → city generation
sectors / buildings
agent characters driven by real events
construction animations
diff / file overlays
```

**Parallelization rule:** world-generator work may start once the event schema is stable, but it cannot steal people/time from Gate A failures. If Gate A regresses, city work pauses.

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
```

Default for simple tasks remains `solo_coder`. Swarms are opt-in by policy, not by enthusiasm.

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
```

## MVP 6 - Learning (starts during MVP 1; deepens later)

Trajectory + `reward_v1` begin in MVP 1.

Later, after Gates A–B:

```text
useful_* credit assignment
eval harness as release gate
contextual bandits behind promotion gates
global memory graduation (§12)
shadow → canary → active policy versions with rollback
```

Do **not** claim self-improvement until eval gates exist.

### Sequencing diagram

```text
MVP1 Gate A ─── reliable solo PR loop + trajectories
      │
      ├──────── MVP2 indexing + user/codebase/episodic memory
      │              │
      │              └─ Gate B ─ active Global Memory
      │
      ├──────── MVP3 city (events already flowing; Gate A holds)
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

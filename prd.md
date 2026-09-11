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

It is a persistent, self-improving cloud engineering organization.

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
```

Only high-confidence sanitized information should graduate here.

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

I would **not start by training model weights**.

V1 learning happens outside the foundation model.

For every task record:

```text
state
task type
repository metadata
retrieved memories
selected agents
selected model
tool calls
actions
failures
tests
latency
tokens
cost
user feedback
PR status
merge status
revert status
```

This becomes a trajectory.

---

# 19. Reward Model

Objective reward signals:

```text
build success
test success
lint success
type-check success
CI success
security checks
PR merged
review comments
user accepted change
user rejected change
PR reverted
tokens consumed
wall-clock latency
patch size
```

Example conceptual reward:

```text
Reward =
    + tests_passed
    + build_success
    + PR_merged
    + user_acceptance
    - regressions
    - excessive_latency
    - unnecessary_tokens
    - reverted_change
```

---

# 20. Reinforcement Learning V1

Do not do PPO against the main LLM.

Start with learning policies around the model.

Learn:

```text
Which model?
Which tools?
Which memories?
How much context?
One agent or multiple?
Which agent topology?
Which tests?
When to stop?
When to ask human?
```

A contextual bandit can already optimize these decisions.

Example:

```text
Task:
"Fix flaky React test"

Historical policy learns:

Coder + Tester
beats
Planner + Coder + Tester + Reviewer

because:

same success
45% lower cost
38% lower latency
```

That is genuine reinforcement-based adaptation without retraining GPT.

---

# 21. RL Evolution

### Stage 1

Heuristics + reward collection.

### Stage 2

Contextual bandits.

### Stage 3

Offline preference learning from historical trajectories.

### Stage 4

Distillation / fine-tuning specialised models where beneficial.

### Stage 5

More advanced offline RL.

Do not attempt Stage 5 until the product has substantial real-world trajectory data.

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

# 36. MVP Scope

Do not build everything simultaneously.

## MVP 1 - Cloud Coding Agent

Build:

```text
GitHub login
repository import
user task
Daytona sandbox
OpenAI coding agent
file editing
tests
Git commits
PR creation
streaming logs
```

Nothing else.

Prove:

> "Give it a repo and issue, get a useful PR."

## MVP 2 - Memory

Add:

```text
user memory
codebase memory
old task history
repo indexing
hybrid retrieval
```

## MVP 3 - Visual World

Add:

```text
repo city
agent character
file activity
construction animations
real-time event stream
```

## MVP 4 - Multi-Agent

Add:

```text
planner
coder
tester
reviewer
parallel workers
shared task memory
```

## MVP 5 - Tool Creation

Add:

```text
capability detection
tool builder
sandbox validation
tool registry
tool reuse
```

## MVP 6 - Learning

Add:

```text
trajectory collection
reward scoring
model selection learning
tool selection learning
topology learning
memory retrieval learning
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

Reinforcement gives it adaptation.

GitHub gives it the ability to ship.

And the event architecture connects all of those pieces into one product.

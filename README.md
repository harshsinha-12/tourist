# Self-Improving Cloud Coding Agent - Tourist

![Pixel-Art Software Development Island City](./Pixel-Art%20Software%20Development%20Island%20City.png)

> A persistent, self-improving cloud engineering environment where AI agents understand your codebase, remember how you work, create new capabilities when needed, learn from experience, and ship software through GitHub.

> **Status:** Early development / experimental.

## City foundation prototype

The first Track 0 slice is runnable. It includes a versioned city/report protocol, a deterministic fixture-to-city generator, an interactive pixel-art island viewer grounded in the project artwork, building inspection, and report sections that navigate to file, test, and pull-request anchors.

```bash
corepack pnpm install
corepack pnpm dev
```

Open `http://localhost:3000` for the fixture city or `http://localhost:3000/reports/tourist-city-foundation` for its public-report route.

Quality checks:

```bash
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
```

---

## Overview

Most coding agents today are powerful, but still largely session-oriented.

They can inspect repositories, write code, run commands, and fix bugs, but they often:

* rediscover the same codebase repeatedly
* forget previous architectural decisions and failed approaches
* operate with a mostly fixed set of tools
* consume unnecessary context and tokens
* have limited long-term understanding of the developer
* provide poor visibility into autonomous work
* fail to systematically improve from previous successful or unsuccessful tasks

**Tourist** explores a different model:

> **What if a coding agent behaved more like a persistent, self-improving cloud engineering organization?**

Users connect a GitHub repository, bring their own OpenAI API key, describe what they want built, and cloud agents inspect the project, retrieve relevant context and memory, plan the work, modify and test code inside isolated sandboxes, review their own changes, respond to failures, and raise pull requests.

But execution is only one part of the system.

Tourist is designed around several persistent capabilities:

* **User Memory** - remembers how a developer prefers to work across projects.
* **Codebase Memory** - learns repository architecture, conventions, previous changes, decisions, discussions, bugs, and historical agent interactions.
* **Global Memory** - stores reusable engineering knowledge and successful patterns that can generalize across tasks.
* **Episodic Memory** - preserves previous attempts, failures, fixes, and outcomes.
* **Dynamic Context Discovery** - retrieves only the code, memories, tools, and historical information relevant to the current task instead of flooding the model context.
* **Multi-Agent Engineering** - dynamically coordinates planners, coders, researchers, testers, reviewers, integration agents, and tool-building agents when useful.
* **Self-Created Tools** - allows agents to detect missing capabilities, build and test tools inside sandboxes, register them, and reuse successful tools later.
* **Reinforcement-Driven Learning** - uses tests, CI results, latency, token usage, user feedback, PR outcomes, failures, and reversions as reward signals to improve future decisions.
* **Adaptive Agent Policies** - progressively learns which models, tools, memories, context, workflows, and agent topologies work best for different engineering problems.
* **Cloud Execution** - lets agents continue working independently of the user's machine.
* **GitHub-Native Delivery** - branches, commits, CI feedback, revisions, and pull requests are first-class parts of the system.
* **Persistent Visual World** - turns the repository into a living software city where folders become sectors, files become buildings, agents visibly work across the codebase, tools are created in workshops, tests run in dedicated facilities, and completed work moves through animated GitHub ports.

The goal is not to build another chat interface around an LLM.

The goal is to build a **persistent software-engineering system that becomes faster, more context-efficient, more capable, and better at shipping software through experience**.

---

## The Idea

At a high level, Tourist combines autonomous cloud execution with persistent memory, dynamic context retrieval, self-created capabilities, and reinforcement-driven improvement.

```text
Developer
    │
    │ "Implement feature X"
    ▼
┌──────────────────────────────┐
│       Cloud Supervisor       │
│                              │
│ Understand → Retrieve → Plan │
└──────────────┬───────────────┘
               │
               ▼
        Context Discovery
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
   Memory     Code      Tools
     │         │         │
     └─────────┼─────────┘
               ▼
        Agent Topology
               │
      ┌────────┼────────┐
      ▼        ▼        ▼
   Planner   Coder   Researcher
                │
          ┌─────┴─────┐
          ▼           ▼
       Tester       Reviewer
          │           │
          └─────┬─────┘
                ▼
         Cloud Sandbox
                │
        Code / Test / Fix
                │
                ▼
            GitHub PR
                │
                ▼
       Outcome + Reward
                │
       ┌────────┴────────┐
       ▼                 ▼
 Update Memory      Improve Policy
```

Behind the agent layer sits a persistent engineering system:

```text
Memory
+
Codebase Intelligence
+
Dynamic Context Discovery
+
Cloud Execution
+
Multi-Agent Coordination
+
Self-Created Tools
+
Reinforcement Learning
+
GitHub Integration
+
Realtime Visualization
```

Every completed task creates new experience.

```text
More Tasks
    ↓
More Experience
    ↓
Better Memory
    ↓
Better Context Retrieval
    ↓
Better Tool Selection
    ↓
Better Agent Coordination
    ↓
Better Learned Policies
    ↓
Faster + Cheaper + Higher-Quality Coding
```

In the first versions, self-improvement happens primarily **around the foundation model**, rather than through continuous model-weight training.

The system learns decisions such as:

```text
Which context should be retrieved?
Which memories are relevant?
Which tools should be exposed?
Which model should handle the task?
Does this require one agent or several?
Which agent topology should be used?
When should the agent retry?
When should it create a new tool?
When should it stop?
When should it ask the human?
```

The repository itself is presented as a persistent software world:

```text
Repository        → Island / City
Major folder      → Sector
Subdirectory      → District
File              → Building
Agent             → Character / Worker
Tool creation     → Workshop
Tests             → Testing Facility
GitHub / PR work  → Port / Harbor
```

The city is not just decorative. It is a realtime representation of what the engineering system is doing.

Agents move between sectors, buildings react to code changes, tests activate dedicated facilities, tools are created in workshops, and GitHub activity appears through ports, ships, and other background movement.

The visual world provides situational awareness. The memory, agent, tooling, and learning systems underneath it are what make Tourist progressively more capable.

---

# Core Principles

## 1. Cloud-native agents

Agents should not depend on the user's laptop remaining online.

Each engineering task runs inside an isolated cloud sandbox containing:

* the repository
* language runtimes
* package managers
* Git
* terminal access
* testing tools
* code-search tools
* agent-created tools
* task-scoped credentials

A user should eventually be able to:

```text
Start task
    ↓
Close laptop
    ↓
Agent continues working
    ↓
Tests code
    ↓
Raises PR
```

---

## 2. Persistent memory

The system should not treat every task as a blank slate.

Memory is divided into several scopes.

### User Memory

Knowledge specific to the developer.

Examples:

```text
prefers TypeScript
uses pnpm
prefers smaller PRs
likes concise abstractions
usually uses FastAPI for Python services
```

### Codebase Memory

Knowledge specific to a repository.

Examples:

```text
repository architecture
module responsibilities
coding conventions
important symbols
dependency relationships
historical fixes
architectural decisions
past PR discussions
previous agent conversations
known fragile areas
```

### Global Memory

Reusable knowledge learned across tasks and repositories.

Examples:

```text
debugging patterns
framework behaviour
successful repair strategies
general tool-selection patterns
reusable engineering knowledge
```

### Episodic / Task Memory

What happened during previous attempts.

```text
attempt 1 failed because...
tests exposed...
approach 2 succeeded...
user rejected...
PR was merged...
```

### Procedural / Tool Memory

Knowledge about **how to perform tasks**.

```text
For Prisma migration drift,
use schema-diff-tool.
```

### Shared Task Memory

Temporary shared knowledge between multiple agents working on the same task.

---

# Dynamic Context Discovery

Having access to large amounts of context does **not** mean sending all of it to the model.

The system follows the principle:

> **Huge available context. Small active context.**

Instead of preloading an entire repository, every past conversation, every memory, and every available tool into the model context, agents dynamically discover what they need.

```text
                     Task
                       │
                       ▼
               Context Router
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
   Code Search      Memory Search     Tool Search
       │               │               │
       └───────────────┼───────────────┘
                       ▼
                    Rerank
                       │
                       ▼
                 Token Budget
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
 Immediate Context           Discoverable Context
```

Code retrieval can combine:

* exact symbol lookup
* `ripgrep`
* Tree-sitter
* Language Server Protocol
* dependency relationships
* semantic search
* historical codebase memory

Large outputs such as build logs and test results should remain external artifacts and be selectively inspected instead of being dumped wholesale into the model context.

This architecture is designed for both **speed and token efficiency**.

More detail lives in [`cursor-strategy.md`](./cursor-strategy.md).

---

# Self-Created Tools

Agents have access to two categories of tools:

```text
Tools
├── Developer-defined tools
└── Agent-created tools
```

Built-in capabilities may include:

* filesystem operations
* shell execution
* Git
* GitHub
* code search
* documentation search
* browser automation
* testing
* package management
* LSP operations
* repository analysis

But sometimes a task requires a capability that does not exist yet.

In that case:

```text
Missing capability
       ↓
Tool Builder Agent
       ↓
Generate specification
       ↓
Write implementation
       ↓
Generate tests
       ↓
Run inside sandbox
       ↓
Evaluate
       ↓
Register
       ↓
Reuse on future tasks
```

Agent-created tools should be versioned, tested, permission-scoped, and tracked through a tool registry.

Over time, this creates **procedural memory**: the system does not only remember information, it remembers capabilities it has learned to build and use.

---

# Learning and Self-Improvement

The first version will **not** continuously retrain the underlying foundation model.

Instead, it learns around the model.

Each engineering run produces a trajectory containing signals such as:

```text
task type
context retrieved
model used
agents spawned
tools selected
tool results
code changes
test results
failures
latency
token usage
cost
user feedback
PR outcome
merge outcome
revert outcome
```

These signals can later improve decisions such as:

* which model to use
* which memories to retrieve
* how much context to provide
* which tools to expose
* whether a task needs one agent or several
* which agent topology works best
* which tests to run
* when to stop
* when to ask the user
* when an agent-created tool is trustworthy

The initial learning system may use:

```text
Heuristics
    ↓
Reward collection
    ↓
Contextual bandits
    ↓
Offline preference learning
    ↓
Specialized fine-tuning
    ↓
More advanced RL
```

Model-weight training is intentionally a later problem.

---

# Multi-Agent Engineering

Not every task should become an agent swarm.

The system dynamically chooses an appropriate topology.

### Simple change

```text
Coder
```

### Bug fix

```text
Coder
  ↓
Tester
  ↓
Reviewer
```

### Large feature

```text
                 Planner
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
       Coder A   Coder B   Researcher
          │         │         │
          └─────────┼─────────┘
                    ▼
              Integration
                    ↓
                 Tester
                    ↓
                Reviewer
                    ↓
                   PR
```

Parallel agents operate in isolated branches/worktrees and synchronize through shared task memory and an integration layer.

Eventually, agent topology itself becomes something the learning system can optimize.

---

# GitHub-Native Workflow

GitHub is the primary delivery surface.

The planned workflow is:

```text
Connect GitHub repository
        ↓
Create task
        ↓
Provision sandbox
        ↓
Create branch/worktree
        ↓
Agents work
        ↓
Run tests / lint / typecheck
        ↓
Self-review
        ↓
Commit
        ↓
Push
        ↓
Create pull request
        ↓
Observe CI
        ↓
Fix failures if required
        ↓
PR ready for human review
```

The production integration should use a **GitHub App** with minimal repository permissions rather than long-lived personal access tokens.

---

# Bring Your Own OpenAI Key

The initial version is planned around **OpenAI models only**.

Users provide their own OpenAI API key.

```text
User supplies OpenAI key
        ↓
Validate
        ↓
Encrypt / scope
        ↓
Agent runtime
        ↓
Task execution
```

API keys must never be:

* stored in agent memory
* written to logs
* placed in prompts unnecessarily
* exposed back to the browser
* shared across users

The model-provider layer remains abstract so additional providers can be added later.

```text
ModelProvider
├── OpenAI          ← V1
├── Anthropic       ← later
├── Gemini          ← later
├── OpenRouter      ← later
└── Local models    ← later
```

---

# Cloud Execution

The current V1 direction uses **Daytona** for isolated agent sandboxes.

Each sandbox can contain:

```text
Sandbox
│
├── cloned repository
├── isolated branch/worktree
├── shell
├── language runtimes
├── package managers
├── Git / GitHub CLI
├── ripgrep
├── Tree-sitter
├── language servers
├── browser when required
├── built-in tools
└── agent-created tools
```

Speed is a first-class requirement.

Planned optimizations include:

* warm sandbox templates
* dependency caching
* incremental repository indexing
* commit-SHA based cache reuse
* parallel initialization
* progressive context retrieval
* cached code intelligence
* structured tool outputs instead of massive raw logs

---

# The Visual World

One of the primary interfaces is an interactive 3D representation of the repository.

```text
Repository
    ↓
City / Island

Major folder
    ↓
Sector

Subdirectory
    ↓
District

File
    ↓
Building

Import / dependency
    ↓
Road / connection

Agent
    ↓
Character / worker

File edit
    ↓
Construction activity

New file
    ↓
New building

Deleted file
    ↓
Demolition

Tool creation
    ↓
Workshop activity

Tests
    ↓
Testing facility activity

GitHub / PR activity
    ↓
Port / harbor activity

Pull request
    ↓
Construction project

Merged PR
    ↓
Completed project
```

Users should be able to observe where agents are working instead of interpreting a wall of terminal logs.

The world should feel persistent and alive. Background movement can include agents walking between sectors, cranes around files being edited, service vehicles moving between districts, ships arriving or departing during GitHub activity, and lights or traffic reflecting active dependencies.

Where possible, these animations should reflect real system state instead of being purely decorative.

The visualization is not intended to replace conventional developer interfaces.

Selecting a building can still open:

* file details
* code
* diffs
* related memories
* agent activity
* commit history

The spatial interface provides **situational awareness**, while traditional UI handles precision.

---

# Realtime Event System

The agent runtime emits structured events.

Example:

```json
{
  "event": "file.editing",
  "agent": "coder_02",
  "task": "task_451",
  "path": "src/auth/session.ts"
}
```

Possible events include:

```text
task.created
agent.spawned
agent.started
memory.retrieved
context.discovered
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
review.started
pr.created
agent.completed
```

Those events drive:

```text
Agent Runtime
      ↓
Event Bus
      ↓
WebSocket
      ↓
Browser
      ↓
3D World + Traditional UI
```

The frontend should never need to reverse-engineer terminal text to understand what an agent is doing.

---

# Planned Technology Stack

| Area                     | Technology                   |
| ------------------------ | ---------------------------- |
| Web Application          | Next.js + TypeScript         |
| UI                       | React + Tailwind             |
| 3D World                 | React Three Fiber + Three.js |
| Client State             | Zustand                      |
| Server State             | TanStack Query               |
| Realtime                 | WebSockets                   |
| Product API              | Fastify + TypeScript         |
| Agent Runtime            | Python                       |
| Agent Framework          | OpenAI Agents SDK            |
| Models                   | OpenAI via BYOK              |
| Cloud Sandboxes          | Daytona                      |
| Initial Jobs             | BullMQ                       |
| Durable Workflows        | Temporal later               |
| Primary Database         | PostgreSQL                   |
| Managed PostgreSQL       | Neon                         |
| Semantic / Hybrid Search | Qdrant                       |
| Cache / Queues           | Redis                        |
| Artifact Storage         | Cloudflare R2 / S3           |
| GitHub Integration       | GitHub App + Octokit         |
| Parsing                  | Tree-sitter                  |
| Exact Code Search        | ripgrep                      |
| Code Intelligence        | Language Server Protocol     |
| Observability            | OpenTelemetry + Sentry       |
| Frontend Hosting         | Vercel                       |
| API / Workers            | Railway or Fly.io initially  |

---

# High-Level Architecture

```text
                              USER
                                │
                    ┌───────────▼───────────┐
                    │      Web / 3D UI      │
                    │ Next.js + Three.js    │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │     Control Plane     │
                    │                       │
                    │ Task Orchestration    │
                    │ Agent Scheduling      │
                    │ Context Engine        │
                    │ Event Streaming       │
                    │ GitHub Integration    │
                    └──────────┬────────────┘
                               │
               ┌───────────────┼────────────────┐
               ▼               ▼                ▼
          Agent Runtime      Memory          Learning
             Python           Layer            Layer
               │               │                │
        ┌──────┼──────┐        │                │
        ▼      ▼      ▼        ▼                ▼
     Planner  Coder  Tester  PostgreSQL      Trajectories
                       │     Qdrant           Rewards
                       │     Redis            Policies
                       │     R2
                       │
                       ▼
                ┌─────────────┐
                │   Daytona   │
                │  Sandboxes  │
                └──────┬──────┘
                       │
                  Tools / Git
                       │
                       ▼
                    GitHub
                       │
                       ▼
                 Pull Request
```

---

# Context Engine

A dedicated context engine determines what the model actually sees.

```text
                         Task
                           │
                           ▼
                    Context Router
                           │
        ┌──────────────────┼───────────────────┐
        ▼                  ▼                   ▼
     Code Search       Memory Search       Tool Search
        │                  │                   │
        └──────────────────┼───────────────────┘
                           ▼
                        Rerank
                           │
                           ▼
                     Token Budget
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
       Active Context             Discoverable State
```

The system should optimize for:

```text
relevance × usefulness × confidence
────────────────────────────────────
             token cost
```

The agent should be able to access enormous amounts of potential context without placing all of it inside every model request.

---

# Planned Repository Structure

```text
.
├── apps/
│   ├── web/                  # Next.js application + 3D world
│   ├── api/                  # TypeScript control-plane API
│   └── worker/               # background jobs / realtime processing
│
├── services/
│   ├── agent-runtime/        # Python agent runtime
│   ├── memory/               # persistent memory service
│   ├── indexing/             # repository intelligence pipeline
│   ├── learning/             # trajectories, rewards and policies
│   └── tool-builder/         # generated-tool pipeline
│
├── packages/
│   ├── protocol/             # shared schemas
│   ├── events/               # agent / world event definitions
│   ├── github/               # GitHub integration
│   ├── database/             # persistence utilities
│   ├── world-generator/      # repo → spatial world
│   ├── tool-sdk/             # tool specification/runtime
│   └── shared/
│
├── prd.md
├── cursor-strategy.md
└── README.md
```

The exact structure will evolve as the project moves from prototype to production.

---

# Development Roadmap

## Phase 1 - Cloud Coding Agent

Prove the core loop:

```text
GitHub repository
        +
OpenAI key
        +
User task
        ↓
Cloud agent
        ↓
Working pull request
```

Build:

* repository connection
* BYOK OpenAI support
* Daytona sandbox
* basic coding agent
* file operations
* shell execution
* tests
* commits
* branch push
* PR creation
* realtime activity stream

---

## Phase 2 - Codebase Intelligence + Memory

Add:

* repository indexing
* Tree-sitter parsing
* symbol intelligence
* hybrid search
* user memory
* codebase memory
* episodic memory
* old task retrieval
* dynamic context discovery

---

## Phase 3 - Visual World

Add:

* repository → city generation
* sectors / districts
* files as buildings
* agent characters
* live file activity
* construction animations
* file inspector
* diff overlays
* realtime task visualization

---

## Phase 4 - Multi-Agent Engineering

Add:

* supervisor
* planner
* coder
* researcher
* tester
* reviewer
* parallel sandboxes
* shared task memory
* integration agent
* dynamic agent topology

---

## Phase 5 - Self-Created Tools

Add:

* capability-gap detection
* Tool Builder Agent
* sandboxed tool generation
* automated tests
* permission model
* tool registry
* versioning
* semantic tool discovery
* tool reuse

---

## Phase 6 - Learning

Add:

* trajectory collection
* reward calculation
* retrieval evaluation
* tool-selection learning
* model-selection learning
* agent-topology learning
* contextual bandits
* offline preference learning

---

# What This Project Is Not

At least initially, this project is **not** trying to build:

* a new foundation model
* a custom container runtime
* a custom vector database
* a Kubernetes platform
* an enormous always-on agent swarm
* online PPO against frontier models
* another VS Code clone

The primary engineering effort should go toward:

```text
Agent quality
Context efficiency
Speed
Memory
Codebase understanding
Tool creation
Learning
Cloud execution
Developer visibility
```

---

# Inspiration

The visual representation of repositories and agent activity is inspired in part by **Claude City / Claude Clan**, created by Parth Mittal.

Claude City explores the idea of turning a codebase into a spatial world where directories become districts, files become buildings, code relationships become infrastructure, and AI agents visibly move through the repository while working.

This project takes inspiration from that interaction model and explores a broader architecture around it:

* persistent cloud execution
* OpenAI-based BYOK agents
* long-term user memory
* long-term codebase memory
* global and episodic memory
* dynamic context discovery
* multi-agent engineering
* self-created tools
* reinforcement-driven strategy improvement
* autonomous GitHub PR workflows

**Claude City**

* Live project: https://playclaude.vercel.app/
* Source: https://github.com/mittal-parth/claude-clan

Credit for the original codebase-as-a-city interaction concept belongs to the Claude City project and its author.

This project is being developed independently and is not affiliated with or endorsed by Claude City, Anthropic, Cursor, OpenAI, Daytona, or GitHub unless explicitly stated otherwise.

---

# Documentation

More detailed design notes are available in:

* [`prd.md`](./prd.md) - product requirements, architecture, infrastructure, memory design, agents, tooling, learning and roadmap
* [`cursor-strategy.md`](./cursor-strategy.md) - context engineering, token efficiency, dynamic retrieval and coding-agent strategy

---

# Current Priorities

The initial priority order is:

1. **Correctness** - produce useful code and PRs.
2. **Speed** - agents should start and operate quickly.
3. **Context efficiency** - retrieve instead of preload.
4. **Observability** - users should always understand what agents are doing.
5. **Persistence** - agents should remember users and repositories.
6. **Extensibility** - tools, providers and execution backends remain replaceable.
7. **Learning** - successful behaviour should improve future tasks.

---

# Long-Term Goal

A developer should eventually be able to open the application and see something closer to an engineering organization than a chatbot:

```text
Your repositories are persistent worlds.

Agents understand their history.

They know your engineering preferences.

They remember architectural decisions.

They can discover the context they need.

They can create capabilities they don't yet have.

They collaborate when a task requires it.

They learn which strategies work.

They work in the cloud.

And they ship through pull requests.
```

The city is the interface.

The agents are the workforce.

Memory provides continuity.

Tools provide capabilities.

Learning improves behaviour.

GitHub is where the work ships.

---

## License

[MIT](./LICENSE)

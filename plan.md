# Tourist — Build Plan

> Working plan aligned with `prd.md` (esp. §§12, 18–21, 36), `README.md`, and `cursor-strategy.md`.
> Last synced after PRD updates on structured learning, Global Memory graduation, and quality Gates A–D.
>
> **Goal:** ship a reliable single-agent cloud PR loop first; capture trajectories from day one; graduate memory under rules; only then amplify with city, multi-agent, tools, and bandits.

**Source of truth for detailed schemas:** `prd.md`. This file is the execution plan.

---

## 1. Honest take

**Strengths**

* Clear loop: connect repo → task → sandbox → PR → reward → improve.
* Pragmatic stack: Daytona, OpenAI Agents SDK, Neon, Qdrant, GitHub App.
* Dynamic context discovery is the right tenet: huge available context, tiny active context.
* Memory scopes + structured policy learning are real differentiators.
* 3D city is strong identity — as a visualization of a working system, not a substitute for one.

**Risks (constrained in PRD)**

| Risk | Constraint |
| --- | --- |
| Too many products at once | §36 Gates A–D |
| Vague “RL” | §§18–21 decision surface, trajectory, `reward_v1`, policy gates, eval |
| Global memory pollution | §12 sanitizer → promote → retrieve → demote; agents cannot write active global |
| City / swarm / tool-factory too early | Forbidden until Gate A; city pauses if Gate A regresses |

**Verdict**

Build the spine first: **solo agent → real PR → complete trajectory + `reward_v1`**. Everything else layers on.

---

## 2. Quality gates (from PRD §36)

```text
Gate A  Single-Agent PR Loop     ← must pass first
  │
  ├─ MVP2 indexing + user/codebase/episodic memory
  │     └─ Gate B  Memory Safety → active Global Memory
  │
  ├─ MVP3 city (events already flowing; pause if A regresses)
  │
  ├─ Gate C → MVP4 multi-agent
  │
  ├─ Gate D → MVP5 tool builder
  │
  └─ MVP6 bandits / retrieval learning (eval-gated; logging starts in MVP1)
```

### Gate A — Single-Agent PR Loop

**Topology allowed:** `solo_coder` or thin `coder_tester` only.

**Blocked until green:** multi-agent swarms, Tool Builder product work, city-as-milestone, active Global Memory retrieval.

**Exit criteria (all required):**

1. End-to-end: GitHub connect → BYOK → Daytona → edit/test → commit → push → PR
2. Eval suite (≥20 fixture tasks): success/latency/token targets on solo topology
3. 100% completed runs write complete trajectory + `reward_v1`; CI/merge hooks update same row
4. No key leakage; task-scoped sandbox secrets; no destructive default-branch defaults
5. Failures inspectable via event stream / run inspector

### Gate B — Memory Safety

Before any `status=active` Global Memory is retrieved in production:

* Sanitizer scanners live
* Scope classifier routes correctly on a labeled set
* Promotion enforces multi-traj + multi-repo + reward/success/abstraction gates
* Retrieval budget + trajectory attribution
* Demotion path tested

### Gate C — Multi-Agent Readiness

* Gate A still green on solo baseline
* `coder_tester` already logged as a decision arm
* Eval shows which `task_features` need more than solo
* Shared task memory + branch/worktree isolation
* Topology is a logged decision key

### Gate D — Tool Builder Readiness

* Gate A green; built-ins cover the common loop
* Capability-gap detection has precision (not spam)
* Sandboxed tool tests + permissions + registry versioning
* Dynamic tool discovery (do not load hundreds of schemas)

---

## 3. Structured learning (summary of PRD §§18–21)

Prefer product language:

> **Structured policy learning over trajectories**
> (contextual bandits + retrieval credit assignment + memory graduation)

Not: “the agent does reinforcement learning” without schemas or eval.

### Decision surface (discrete only)

| Decision key | Example actions |
| --- | --- |
| `model` | `fast`, `coding`, `reasoning` |
| `topology` | `solo_coder`, `coder_tester`, `coder_tester_reviewer`, `full_pipeline` |
| `context_budget` | `4k`, `8k`, `16k` |
| `tool_pack` | retrieved tool / skill ids |
| `memory_pack` | retrieved memory ids |
| `stop_policy` | `stop_on_green`, `max_3_retries`, `ask_human_on_second_fail` |
| `test_policy` | `unit_only`, `unit_lint_type`, `full_ci` |

### Trajectory + reward

* Every run → immutable trajectory (Postgres) + artifacts (R2)
* Incomplete trajectory = bug
* `reward_v1` versioned in code; component breakdown stored; delayed CI/merge/revert settle the same row
* `useful_files` / `useful_tools` / `useful_memories` / `wasted_retrievals` for credit assignment

### Policy promotion

```text
heuristics + logging (always)
  → contextual bandits (min samples / CIs)
  → offline preferences
  → retrieval learning from useful_* labels
  → distill routers (only after measurable gains)
  → advanced offline RL (last; needs real volume)
```

New policy: offline eval → optional shadow → canary → active, with automatic rollback. **No eval harness → no self-improvement claims.**

---

## 4. Global Memory logic (summary of PRD §12)

**Default: reject.** Extractor proposes; sanitizer + promotion job decide.

```text
raw candidate
  → hard scanners (secrets / PII / internal URLs / raw code dumps)
  → scope classifier → user | codebase | episodic | global | reject
  → WHEN/DO generalization, abstraction_score ≥ 0.7
  → dedupe / contradiction
  → status=candidate
  → promote IFF ≥3 traj, ≥2 repos, reward + success thresholds, age_ok, no conflict
  → retrieve only active + confidence floor + token budget (log memory_pack)
  → demote on underperformance; archive; no silent reactivate
```

**Invariant:** agents cannot set `scope=global` + `status=active`. Only the graduation service can.

Until Gate B: candidates may be collected; **active global retrieval stays off**.

---

## 5. How to implement

### Guiding constraints

1. Vertical slices with demoable exits
2. Trajectories from day one (before bandits)
3. **Gate A before amplifiers** (multi-agent, tools, city-as-milestone)
4. One agent before many
5. City visualizes events; pause city if Gate A regresses
6. Context Engine: discover, don’t dump (`cursor-strategy.md`)
7. Global Memory default deny (§12)

### Monorepo

```text
tourist/
├── apps/web
├── apps/api
├── apps/worker
├── services/agent-runtime    # Python + OpenAI Agents SDK
├── services/indexing
├── services/memory           # includes graduation job
├── services/learning         # reward_v1, bandits, eval
├── packages/protocol         # Task, Event, Trajectory, Reward, MemoryRecord, Policy
├── packages/events
├── packages/github
└── packages/world-generator  # after Gate A / stable events
```

### Spine (Gate A)

```text
GitHub App → task → BYOK → Daytona → solo agent (tool-driven discovery)
  → test / commit / push / PR → events → trajectory + reward_v1
```

---

## 6. Branch strategy

Long-lived `main` (always demoable) + phase branches. **Merge only when the phase exit and any required gate are met.**

| Branch | Purpose | Merge when |
| --- | --- | --- |
| `main` | Stable demos + docs | Continuous |
| `feat/phase-0-scaffold` | Monorepo, CI, protocol schemas | Scaffold boots |
| `feat/phase-1-cloud-agent` | GitHub App, BYOK, Daytona, solo → PR | Real PR on a repo |
| `feat/phase-1b-trajectories` | Trajectory store, `reward_v1`, artifacts | 100% runs scored |
| `feat/phase-1-gate-a` | Eval suite + Gate A checklist | **Gate A green** |
| `feat/phase-2-indexing` | Tree-sitter, hybrid search, Context Engine | Search tools used successfully |
| `feat/phase-2-memory` | User / codebase / episodic | Useful reuse on second task |
| `feat/phase-2b-global-memory` | Sanitizer + promotion/demotion | **Gate B green**; actives graduate under rules |
| `feat/phase-3-city-mvp` | World gen + event-driven city | Gate A still green; city mirrors live edits |
| `feat/phase-4-multi-agent` | Topologies + shared task memory | **Gate C**; simple tasks stay solo |
| `feat/phase-5-tool-builder` | Gap → sandbox tool → registry | **Gate D**; reused tool with +reward |
| `feat/phase-6-learning` | Bandits, eval as release gate, policy versions | Shadow beats baseline |
| `feat/phase-6b-retrieval-rl` | Train on `useful_*` labels | Measurable retrieval lift |

**Rules**

* Core spine: one phase branch at a time until Gate A.
* City may parallelize only after event schema is stable **and** Gate A is green (or clearly on track with a dedicated owner who yields on A regressions).
* Hotfixes → `main`.
* Schema changes update `packages/protocol` in the same PR.
* `experiment/*` for learning experiments that may never merge.

---

## 7. Step-by-step build order

### Phase 0 — Scaffold (1–2 weeks)

* Monorepo + docker compose (Postgres, Redis)
* Protocol: Task, Event, Trajectory, Reward, MemoryRecord, PolicyVersion
* Next.js shell + Fastify healthcheck + CI

**Exit:** compose up, web loads, API healthy.

### Phase 1 — Cloud coding agent → Gate A (3–6 weeks)

* GitHub App, BYOK, Daytona, solo agent tools (read/search/edit/shell)
* Large tool outputs → artifacts (Cursor pattern)
* Branch → commit → push → PR
* Text event stream + run inspector

**Exit:** real PR from natural-language task. Then close Gate A with fixture eval.

### Phase 1b — Trajectories (overlap end of Phase 1)

* Persist trajectory; `reward_v1` components; delayed webhooks
* Completeness alerts

**Exit:** every completed run has score + breakdown (Gate A item 3).

### Phase 2 — Indexing + Context Engine (after Gate A)

* Tree-sitter → symbols → chunks → Qdrant
* `rg` + semantic + `read_file` / `read_artifact`
* Context Router + token budgeter

**Exit:** less dumped context; retrieval logged on trajectory.

### Phase 2 memory — Scoped memory

* User / codebase / episodic APIs; extract after task; memory search as tool

**Exit:** second task on same repo reuses decisions usefully.

### Phase 2b — Global graduation → Gate B

* Full §12 pipeline; admin view of candidates/actives/rejects

**Exit:** Gate B green; a few high-precision global playbooks only.

### Phase 3 — City MVP (after Gate A; stable events)

* Repo → sectors/buildings; event-driven activity; DOM overlays; InstancedMesh / on-demand render

**Exit:** run state understandable from city alone. **Pause if Gate A regresses.**

### Phase 4 — Multi-agent (Gate C)

* Logged topology enum; handoffs; shared task memory; parallel sandboxes only when required

**Exit:** complex tasks may swarm; simple tasks stay near solo cost/latency.

### Phase 5 — Tool builder (Gate D)

* Capability gap → sandboxed build/test → registry → dynamic discovery → reward attribution

**Exit:** one reused tool with positive attributed reward.

### Phase 6 — Learning (logging from 1b; optimization after A–B)

* Eval as release gate; bandits; shadow policies; retrieval learning from `useful_*`

**Exit:** measurable win vs heuristic baseline on holdout tasks.

---

## 8. First 30 days

| Week | Focus |
| --- | --- |
| 1 | Scaffold, protocol schemas (incl. Trajectory/Reward/MemoryRecord), GitHub App skeleton |
| 2 | Daytona hello-world, BYOK path, clone + list files + run tests |
| 3 | Edit → commit → push → PR; WebSocket event stream |
| 4 | Trajectory + `reward_v1`; run inspector; ≥5 fixture tasks; freeze Gate A demo path |

Do **not** start city, multi-agent, or Tool Builder in the first 30 days except optional throwaway event-schema sketches.

---

## 9. Success metrics

| Milestone | North-star |
| --- | --- |
| Gate A | Solo eval success rate + real-repo PR loop |
| 1b | % runs with complete trajectory + reward |
| 2 | Tokens/successful PR ↓ without success ↓ |
| Gate B | Precision of retrieved global playbooks; zero secret leaks in memory |
| 3 | Users can explain agent state from city alone |
| Gate C / 4 | Simple-task cost ≈ solo baseline |
| Gate D / 5 | Reused tools with positive attributed reward |
| 6 | Eval: success ↑ or cost ↓ at fixed success |

---

## 10. Deliberately defer

* Kubernetes / custom sandbox runtime
* Online PPO / training a frontier model
* Unfiltered Global Memory writes
* Multi-agent or Tool Builder before Gate A
* City-as-milestone before Gate A
* Auto image-gen for every building type
* Always-on huge swarms
* Heavy billing beyond BYOK metering
* Ambient city life (ships, weather) before event fidelity is good

---

## 11. Doc map

| Topic | Where |
| --- | --- |
| Vision / product narrative | `README.md` |
| Full architecture | `prd.md` |
| Global Memory sanitize/promote | `prd.md` §12 |
| Learning / trajectories / rewards / gates | `prd.md` §§18–21 |
| MVP + Gates A–D | `prd.md` §36 |
| Dynamic context discovery | `cursor-strategy.md` |
| Execution plan / branches / phases | this file |

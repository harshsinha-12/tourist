# Tourist — Build Plan

> Working plan aligned with `prd.md` (esp. §§12, 18–21, 26, 36), `README.md`, and `cursor-strategy.md`.
> Last synced for: structured learning, Global Memory gates, **City Foundation first**, and **Public Report → CitySnapshot**.
>
> **Goal:** design the city early as the integration + reporting surface; run the solo agent loop in parallel until Gate A; then bind live agents, memory, multi-agent, and tools onto that world.

**Source of truth for detailed schemas:** `prd.md`. This file is the execution plan.

---

## 1. Honest take

**Strengths**

* Clear loop: connect repo → task → sandbox → PR → reward → improve.
* Pragmatic stack: Daytona, OpenAI Agents SDK, Neon, Qdrant, GitHub App.
* Dynamic context discovery: huge available context, tiny active context.
* Memory scopes + structured policy learning.
* **City as product identity** — strongest if it is also the reporting/integration surface, not a late skin.

**Risks (constrained in PRD)**

| Risk | Constraint |
| --- | --- |
| Too many products at once | Gates A–D; Track 0 is scoped to schema/viewer/reports first |
| Vague “RL” | §§18–21 |
| Global memory pollution | §12 + Gate B |
| City polish replacing agent quality | Track 0 ≠ “live autonomous city”; Gate A still required for live claims |
| Multi-agent / Tool Builder too early | Still blocked until Gates C / D |

**Verdict**

Two parallel early tracks:

1. **Track 0 — City Foundation + Public Reports** (design the world; reports generate cities)
2. **MVP 1 — Solo agent → PR + trajectories** (Gate A)

Then bind live agents onto the city (MVP 3), then memory depth, swarms, tools, bandits.

---

## 2. City-first + public reports

### Why build the city early

* Forces a stable **world schema** that events, PRs, tests, and agents must target — better integration later.
* Makes Tourist demoable and branded before the agent is perfect.
* Turns “reporting” into something tangible: **a shareable city**, not a wall of logs.

### Public Report model

```text
Run / task finishes (or fixture report)
      ↓
ReportComposer
  summary, outcomes, reward, files, tests, PR, trajectory highlights
      ↓
WorldGenerator → CitySnapshot
      ↓
PublicReport (share URL)
  city viewer + panels anchored to buildings / landmarks
```

Anchors (examples):

| Report section | City anchor |
| --- | --- |
| File diff / change | Building(path) |
| Tests | Testing Facility |
| PR / push / merge | Harbor / Port |
| Failures | Warning state on building/district |
| Agent steps | Character path highlights |

**When a public report is created, the city is generated (or snapshotted) as part of that flow** — same schema for live in-product world and immutable report worlds; visibility differs.

Details: `prd.md` §26.

---

## 3. Quality gates + Track 0 (from PRD §36)

```text
Track 0 ── City Foundation + PublicReport→CitySnapshot
    │
    ├──────── MVP1 Gate A ── solo PR loop + trajectories
    │              └─ real runs mint reports that generate cities
    │
    ├──────── MVP2 indexing + scoped memory → Gate B (global)
    ├──────── MVP3 living city (bind live agents onto Track 0)
    ├──────── Gate C → MVP4 multi-agent
    ├──────── Gate D → MVP5 tool builder
    └──────── MVP6 learning (eval-gated; logging from MVP1)
```

### Track 0 — City Foundation (start now)

Build:

* World schema: Sector, District, Building, Landmark, AgentPawn, Anchor
* Art direction + building archetypes
* Repo tree → layout generator (fixture repos OK)
* R3F city viewer shell (camera, LOD, instancing basics)
* Report anchors + `PublicReport` + share URL stub
* `CitySnapshot` persistence

**Exit:** shareable report page with a generated city for a fixture repo; summary + file/test/PR anchors work.

### Gate A — Single-Agent PR Loop

**Allowed before A:** Track 0, fixture/mock reports→cities, event schema, text inspector.

**Blocked until A:** multi-agent swarms, Tool Builder, claiming a finished “live autonomous city,” active Global Memory.

**Exit:** real solo PR loop + trajectories + (with Track 0) a real run can mint a PublicReport whose CitySnapshot matches that run.

### Gates B / C / D

Unchanged in spirit: memory safety; multi-agent readiness; tool-builder readiness. See `prd.md` §36.

---

## 4. Structured learning (summary of PRD §§18–21)

> **Structured policy learning over trajectories** — not vibes.

Discrete decision surface, mandatory trajectories, versioned `reward_v1`, policy shadow→canary→active, eval harness required. Full detail in `prd.md` §§18–21.

---

## 5. Global Memory (summary of PRD §12)

Default deny → sanitize → candidate → multi-repo promote → budgeted retrieve → demote. Agents never write `scope=global, status=active`. Active retrieval off until Gate B.

---

## 6. How to implement

### Guiding constraints

1. **City Foundation early** — world schema + report→city before deep agent polish
2. Trajectories from day one of the agent track
3. Gate A before multi-agent / Tool Builder / “live city done” claims
4. One agent before many
5. Living-city polish pauses if Gate A regresses; report/snapshot path should keep working
6. Context Engine: discover, don’t dump
7. Global Memory default deny

### Monorepo

```text
tourist/
├── apps/web                    # city viewer + report pages early
├── apps/api
├── apps/worker
├── services/agent-runtime
├── services/indexing
├── services/memory
├── services/learning
├── services/report-composer    # PublicReport + anchors
├── packages/protocol           # + World*, CitySnapshot, PublicReport
├── packages/events
├── packages/github
└── packages/world-generator    # Track 0 — not “later”
```

### Dual spine

```text
Track 0:  fixture repo → WorldGenerator → CitySnapshot → PublicReport URL
MVP1:     GitHub → BYOK → Daytona → solo agent → PR → events → trajectory
Merge:    real run → ReportComposer → same WorldGenerator → shareable city report
```

---

## 7. Branch strategy

| Branch | Purpose | Merge when |
| --- | --- | --- |
| `main` | Stable demos + docs | Continuous |
| `feat/phase-0-scaffold` | Monorepo, CI, base protocol | Scaffold boots |
| `feat/track-0-city-foundation` | World schema, generator, viewer shell | Fixture city renders |
| `feat/track-0-public-reports` | ReportComposer, anchors, share URL, snapshots | Shareable report→city works |
| `feat/phase-1-cloud-agent` | GitHub, BYOK, Daytona, solo → PR | Real PR |
| `feat/phase-1b-trajectories` | Trajectory + `reward_v1` | 100% runs scored |
| `feat/phase-1-gate-a` | Eval + report bridge from real runs | **Gate A green** |
| `feat/phase-2-indexing` | Context Engine | Search tools work |
| `feat/phase-2-memory` | User / codebase / episodic | Reuse on second task |
| `feat/phase-2b-global-memory` | Graduation pipeline | **Gate B** |
| `feat/phase-3-living-city` | Live pawns/animations on Track 0 | Live run readable in city |
| `feat/phase-4-multi-agent` | Topologies | **Gate C** |
| `feat/phase-5-tool-builder` | Tool factory | **Gate D** |
| `feat/phase-6-learning` | Bandits / eval gates | Shadow beats baseline |

**Rules**

* Track 0 and Phase 1 may run in parallel (two branches / owners).
* Do not block Track 0 on Gate A.
* Do not ship multi-agent or Tool Builder before Gates C/D.
* Schema changes update `packages/protocol` in the same PR.

---

## 8. Step-by-step build order

### Phase 0 — Scaffold (1 week)

Monorepo, docker compose, protocol stubs including `World*`, `CitySnapshot`, `PublicReport`, Trajectory, Reward.

### Track 0 — City + reports (weeks 1–4, parallel)

1. Art direction + schema
2. Fixture repo → layout → R3F viewer
3. Anchors + PublicReport share page
4. Persist CitySnapshot

**Exit:** public report creates/navigates a city.

### Phase 1 — Solo agent → Gate A (weeks 2–7, parallel)

GitHub, BYOK, Daytona, solo tools, PR, events shaped for world schema, trajectories, then real run → PublicReport.

**Exit:** Gate A + report bridge.

### Phase 2 — Indexing + scoped memory

Richer layout inputs; memory tools; Gate B before active global.

### Phase 3 — Living city

Bind live agent events to Track 0 (pawns, construction, harbor). Pause polish if Gate A regresses.

### Phases 4–6

Multi-agent (C), tools (D), bandits/retrieval learning — as in `prd.md` §36.

---

## 9. First 30 days

| Week | Track 0 (city/reports) | Agent track |
| --- | --- | --- |
| 1 | Scaffold + world schema + art spikes | GitHub App skeleton |
| 2 | Fixture repo → generated city in viewer | Daytona hello-world, BYOK path |
| 3 | PublicReport anchors + share URL stub | Edit → commit → push → PR |
| 4 | CitySnapshot persist; polish report page | Trajectory + `reward_v1`; wire one real run → report→city |

**Do start the city now.** Do **not** start multi-agent or Tool Builder in the first 30 days.

---

## 10. Success metrics

| Milestone | North-star |
| --- | --- |
| Track 0 | Fixture PublicReport opens a navigable generated city with working anchors |
| Gate A | Solo eval success + real PR loop + real run mints report→city |
| 1b | % runs with complete trajectory + reward |
| 2 | Tokens/successful PR ↓ without success ↓ |
| Gate B | Global playbook precision; no secret leaks in memory |
| MVP 3 | Live run understandable from city without raw logs |
| Gate C / 4 | Simple-task cost ≈ solo baseline |
| Gate D / 5 | Reused tools with +reward; Workshop landmark updates |
| 6 | Eval: success ↑ or cost ↓ at fixed success |

---

## 11. Deliberately defer

* Kubernetes / custom sandbox runtime
* Online PPO / training a frontier model
* Unfiltered Global Memory writes
* Multi-agent or Tool Builder before Gates C/D
* Claiming “live autonomous city” before Gate A
* Auto image-gen for every building type (archetypes first)
* Always-on huge swarms
* Heavy billing beyond BYOK metering
* Rich ambient life (ships, weather) before report anchors + event fidelity are solid

---

## 12. Doc map

| Topic | Where |
| --- | --- |
| Vision | `README.md` |
| Architecture | `prd.md` |
| City + PublicReport→CitySnapshot | `prd.md` §26 |
| Global Memory | `prd.md` §12 |
| Learning | `prd.md` §§18–21 |
| Track 0 + Gates A–D | `prd.md` §36 |
| Context discovery | `cursor-strategy.md` |
| Execution plan | this file |

Yes. The article you’re probably remembering is Cursor’s **“Dynamic context discovery”** from January 6, 2026. It is extremely relevant to what you’re building. ([Cursor][1])

The core idea is surprisingly simple:

> **Do not give the coding agent everything it might need. Give it the ability to cheaply discover what it needs.**

Cursor found that this is both **more token-efficient and often higher quality**, because the context window contains less irrelevant or contradictory information. ([Cursor][1])

### What Cursor actually does

**1. Very little static context**

Older Cursor agents would preload things like the folder tree, semantic code matches, attached-file summaries, etc. Cursor says much of that static context has now been removed. Current agents mostly start with lightweight information such as OS, git status, current/recent files, then discover additional context through tools. ([Cursor][2])

So instead of:

```text
SYSTEM PROMPT
+ complete repo tree
+ architecture summary
+ 20 retrieved chunks
+ user memory
+ previous chats
+ terminal history
+ 100 tool descriptions
+ request
```

you want:

```text
SYSTEM PROMPT
+ tiny repo metadata
+ critical rules
+ task
+ available discovery mechanisms
```

Then:

```text
Agent decides:
"I need auth architecture"
        ↓
search_code("authentication")
        ↓
retrieve 5 relevant results
        ↓
read specific files
```

That maps directly onto your agent.

---

### 2. Grep + semantic search together

Cursor doesn't rely only on embeddings.

Its agent uses both:

```text
ripgrep / exact search
         +
semantic search
```

Cursor's research found semantic search improved coding-agent question accuracy by **12.5% on average**, and the effect was particularly useful in larger codebases. ([Cursor][3])

This confirms the architecture we already put in your PRD:

```text
Symbol search
↓
ripgrep
↓
LSP
↓
semantic search
```

rather than blindly embedding the entire repo into the prompt.

Cursor itself says the combination of grep and semantic search currently performs best. ([Cursor][3])

---

### 3. Codebase indexing happens ahead of time

Cursor scans the codebase, breaks source into structured chunks and generates embeddings that power semantic retrieval. ([Cursor][4])

But the model **does not receive all those chunks**.

Think:

```text
30 million tokens of repository

        ↓ indexing

┌────────────────────────┐
│ Searchable Code Index  │
│                        │
│ chunks                 │
│ embeddings             │
│ metadata               │
│ symbols                │
└────────────────────────┘

        ↓ query

maybe 2,000 useful tokens

        ↓

       LLM
```

That's where a huge chunk of the token savings comes from.

For your architecture:

```text
GitHub Repo
    ↓
Tree-sitter
    ↓
Symbol extraction
    ↓
Chunking
    ↓
Embeddings
    ↓
Qdrant

Task
 ↓
Search
 ↓
Top relevant code
 ↓
Agent
```

---

### 4. Long tool outputs become files

This is one of the cleverer techniques.

Imagine:

```bash
npm test
```

produces **40,000 tokens** of output.

A naive agent does:

```text
tool output
    ↓
40,000 tokens inserted into context
```

Cursor instead writes large tool responses into files and gives the agent references to them. The agent can inspect the tail or selectively read sections when needed. Cursor says this reduces unnecessary context summarization. ([Cursor][1])

So your sandbox should do:

```text
pytest / npm test / build / logs

           ↓

/artifacts/task-123/test-output.log

           ↓

Tool response to model:

{
  "exit_code": 1,
  "artifact": "test-output.log",
  "tail": "...AssertionError..."
}
```

Maybe **300 tokens**, not 30,000.

Then:

```text
Agent:
read_artifact(
   "test-output.log",
   lines=550:620
)
```

only when required.

I would absolutely implement this.

---

### 5. Terminal sessions are treated like files

Same idea.

Instead of continuously carrying:

```text
terminal command 1
output
command 2
output
command 3
output
...
```

Cursor makes terminal history discoverable rather than permanently stuffing it into context. ([Cursor][1])

Your architecture could make every sandbox artifact addressable:

```text
sandbox://terminal/1
sandbox://tests/latest
sandbox://build/latest
sandbox://logs/server
sandbox://git/diff
```

The agent reads them on demand.

---

### 6. Tool descriptions aren't necessarily loaded

This one matters **massively for your self-created tool system**.

Suppose eventually your agent has:

```text
500 tools
```

and each tool schema + description averages 300 tokens.

You've just wasted:

```text
150,000 tokens
```

before the model even starts working.

Cursor noticed exactly this problem with MCP servers.

Instead of loading all MCP tool descriptions into the prompt, Cursor syncs them somewhere discoverable and gives the agent lightweight information that lets it find the appropriate tool when needed. In an A/B test involving MCP-tool runs, Cursor reports **46.9% fewer total agent tokens** using dynamic tool discovery. ([Cursor][1])

This is huge for your architecture.

Your Tool Registry should therefore work like:

```text
                TOOL REGISTRY

    2,000 available capabilities

                  ↓

Task: "Analyze Prisma migration"

                  ↓

       Tool Retrieval Search

                  ↓

┌────────────────────────────┐
│ prisma_schema_diff         │
│ migration_validator        │
│ postgres_schema_inspector  │
└────────────────────────────┘

                  ↓

Only expose these 3 schemas
to the model
```

Not all 2,000.

---

### 7. Skills are dynamically loaded

Same concept for instructions.

Instead of always injecting:

```text
React instructions
Python instructions
AWS instructions
Prisma instructions
Postgres instructions
Testing instructions
Deployment instructions
...
```

you could maintain:

```text
skills/
├── react/
├── prisma/
├── postgres/
├── debugging/
├── migrations/
└── playwright/
```

Agent gets only a tiny index.

If needed:

```text
load_skill("prisma-migrations")
```

Now those instructions enter context.

Cursor supports this dynamic capability loading as part of its context-discovery approach. ([Cursor][1])

---

### 8. Summarization does not have to destroy history

Eventually:

```text
Agent conversation = 180k tokens
Context window = 128k
```

You need compaction.

Naive approach:

```text
180k tokens
    ↓
3k token summary
    ↓
throw original away
```

Problem: important details disappear.

Cursor uses summarization while keeping historical information discoverable, allowing the agent to recover relevant past context instead of depending entirely on the lossy summary. ([Cursor][1])

For your system:

```text
Full Task History
      ↓
Object Storage

Structured Events
      ↓
Postgres

Semantic summaries
      ↓
Qdrant

Current context
      ↓
Compact task summary
```

Agent gets the compact summary.

But it can ask:

```text
search_task_history(
  "why did we reject Redis?"
)
```

and recover the original decision.

This fits perfectly with your **episodic memory**.

---

### 9. Cursor is training retrieval using agent trajectories

This is probably the most interesting part for your **self-improving agent**.

Cursor records how agents actually search through repositories.

For example:

```text
Task
 ↓
Search A ❌
 ↓
Search B ❌
 ↓
Open X
 ↓
Open Y
 ↓
Found relevant code ✅
```

Afterwards, they can infer:

> "Y should probably have been retrieved much earlier."

They use agent traces, LLM-generated relevance rankings, and those signals to train their embedding model so future retrieval better predicts what the agent will actually need. ([Cursor][3])

That is extremely close to what **your RL / learning layer should eventually do**.

Instead of only learning:

```text
which agent?
which tool?
```

learn:

```text
which context should be retrieved?
```

So your reward loop eventually becomes:

```text
Task
 ↓
Context retrieved
 ↓
Agent searches
 ↓
Eventually discovers useful files
 ↓
Compare initial retrieval
with actually useful files
 ↓
Generate retrieval reward
 ↓
Improve retrieval policy
```

That is legitimately self-improving context engineering.

---

## What I would copy into your project

I'd introduce a formal component called:

### **Context Engine**

```text
                         TASK
                           │
                           ▼
                 ┌──────────────────┐
                 │  Context Router  │
                 └────────┬─────────┘
                          │
       ┌──────────────────┼────────────────────┐
       ▼                  ▼                    ▼

   CODE SEARCH        MEMORY SEARCH       TOOL SEARCH

 ripgrep / LSP       User Memory        Tool Registry
 Tree-sitter         Codebase Memory    Skills Registry
 Semantic Search     Episodic Memory
       │                  │                    │
       └──────────────────┼────────────────────┘
                          ▼
                    Reranker
                          │
                          ▼
                  TOKEN BUDGETER
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
        Immediate Context        Discoverable Context

       actually inserted          stored externally
        into prompt               and loaded later
```

And give every context object a budget/value score:

```text
context_score =
    relevance
    × expected usefulness
    × confidence
    ÷ token_cost
```

Then if:

```text
auth.ts          relevance .98     1,800 tokens
README.md        relevance .31     7,000 tokens
old task         relevance .84       400 tokens
user memory      relevance .63        80 tokens
```

you can intelligently build a small context package.

---

## This slightly changes one thing in your PRD

Right now you have:

```text
Retrieve:
 User Memory
 Codebase Memory
 Global Memory
 Relevant historical tasks
```

I'd change the conceptual model to:

```text
Discover available context
        ↓
Context Router determines sources
        ↓
Retrieve candidates
        ↓
Rerank
        ↓
Token budget
        ↓
Inject minimum necessary context
        ↓
Allow agent to discover more dynamically
```

So **memory retrieval itself becomes tool-driven**, rather than automatically inserting memories at the beginning.

Your agent could start with, say:

```text
System + rules        4k
User task             1k
Repo metadata         1k
Initial context       4k
-------------------------
~10k tokens
```

despite having access to potentially:

```text
Codebase      20M tokens
Chats          5M
Git history   10M
Tool docs      2M
Memory         1M
Logs          50M+
```

That's the Cursor philosophy in one sentence:

> **Huge available context, tiny active context.**

I think that principle should become one of the core architectural tenets of your coding agent. ([Cursor][1])

The two Cursor posts worth saving beside your PRD are [Dynamic context discovery](https://cursor.com/blog/dynamic-context-discovery?utm_source=chatgpt.com) and [Improving agent with semantic search](https://cursor.com/blog/semsearch?utm_source=chatgpt.com).

For your design, I'd go one step beyond Cursor and make **context selection itself part of the reinforcement-learning policy**, because you're already collecting trajectories and rewards. That could be one of the genuinely novel pieces of this project.

Counter-question: say a task needs one 2,000-token file and there are ten semantically related 2,000-token files. Would you initially send all 20k tokens, or send the highest-ranked file and let the agent pull the others only if it needs them?

[1]: https://cursor.com/blog/dynamic-context-discovery?utm_source=chatgpt.com "Dynamic context discovery · Cursor"
[2]: https://cursor.com/blog/continually-improving-agent-harness?utm_source=chatgpt.com "Continually improving our agent harness · Cursor"
[3]: https://prod.cursor.com/blog/semsearch?utm_source=chatgpt.com "Improving agent with semantic search · Cursor"
[4]: https://cursor.com/blog/dropbox?utm_source=chatgpt.com "Dropbox uses Cursor to index over 550,000 files and build an AI-native SDLC · Cursor"

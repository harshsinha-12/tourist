"use client";

import { useEffect, useState } from "react";

interface RunEvent { type: "stage" | "tool" | "agent_event"; at: string; stage?: string; trace?: { name: string; input?: Record<string, unknown>; result?: Record<string, unknown> }; event?: { type: string; agent?: string; path?: string; tool?: string } }
interface Feed { status: string; events: RunEvent[] }

function describe(event: RunEvent): string {
  if (event.type === "stage") return event.stage ?? "Working";
  if (event.type === "agent_event") return [event.event?.type, event.event?.agent, event.event?.path ?? event.event?.tool].filter(Boolean).join(" · ") || "Agent event";
  const trace = event.trace;
  if (!trace) return "Tool used";
  const path = typeof trace.input?.path === "string" ? ` ${trace.input.path}` : "";
  const program = typeof trace.input?.program === "string" ? ` ${trace.input.program}` : "";
  return `${trace.name}${path}${program}`;
}

export function AgentRunTerminal() {
  const [runInput, setRunInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [runId, setRunId] = useState("");
  const [token, setToken] = useState("");
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!runId || !token) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/agent-runs/${encodeURIComponent(runId)}`, { headers: { "x-view-token": token }, cache: "no-store" });
        const data = await response.json() as Feed & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load run");
        if (active) { setFeed(data); setError(""); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Unable to load run"); }
    };
    void load();
    const interval = setInterval(() => { void load(); }, 2_000);
    return () => { active = false; clearInterval(interval); };
  }, [runId, token]);
  return (
    <div className="agent-terminal">
      <div className="agent-terminal-top"><span>● ● ●</span><strong>Tourist Cloud · run activity</strong><span>{feed?.status ?? "waiting"}</span></div>
      <form onSubmit={(event) => { event.preventDefault(); setFeed(null); setRunId(runInput.trim()); setToken(tokenInput); }}>
        <label>Run ID<input aria-label="Run ID" value={runInput} onChange={(event) => setRunInput(event.target.value)} placeholder="Cloud run ID" required /></label>
        <label>Viewer token<input aria-label="Viewer token" type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder="Viewer token" required /></label>
        <button type="submit">Watch run</button>
      </form>
      <div className="agent-terminal-output" role="log" aria-live="polite">
        {error && <p className="agent-terminal-error">{error}</p>}
        {!feed && !error && <p>Enter a cloud run ID to watch the agent work.</p>}
        {feed?.events.map((event, index) => <p key={`${event.at}-${index}`}><time>{new Date(event.at).toLocaleTimeString()}</time><span className="agent-terminal-prompt">$</span>{describe(event)}</p>)}
      </div>
    </div>
  );
}

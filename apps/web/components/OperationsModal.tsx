"use client";

import { useEffect, useMemo, useState } from "react";

export type CityOperation = "airbase" | "skill-port" | "pr-base" | "command";

type OperationModalProps = {
  operation: CityOperation;
  repositoryName: string;
  onClose: () => void;
  onDispatch?: (message: string) => void;
};

const copy: Record<CityOperation, { eyebrow: string; title: string; description: string; icon: string }> = {
  airbase: { eyebrow: "CCX · TERMINAL 01 · REPOSITORY TRANSIT", title: "Choose your destination", description: "Import a repository into the city. Ground control will map its files into districts before the next flight departs.", icon: "✈" },
  "skill-port": { eyebrow: "SKILL PORT · HOME FLEET · ORG CREW", title: "Sail to your skill org", description: "Pick a guild and send a crew to the part of the island that needs its tools, research, or release experience.", icon: "⚓" },
  "pr-base": { eyebrow: "NAVY BASE · REVIEW FLEET · TARGETS FOR REVIEW", title: "Pick a pull request to attack", description: "Send the review fleet offshore, inspect the diff, and return a report with the changes that need attention.", icon: "⚑" },
  command: { eyebrow: "MAIN COMMAND · MAYOR CONSOLE · CREW DISPATCH", title: "What should the crew build?", description: "Describe the next job and a builder will walk from command to the matching file on the island.", icon: "⌘" },
};

export function OperationsModal({ operation, repositoryName, onClose, onDispatch }: OperationModalProps) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const details = copy[operation];
  // These rows are deliberately derived from the live snapshot. GitHub-backed
  // repositories, skills, and pull requests can replace them without adding a
  // second configuration file or changing the landmark UI.
  const filteredRepositories = useMemo(() => [[repositoryName, "snapshot", "local"] as const].filter(([name]) => name.toLowerCase().includes(query.toLowerCase())), [query, repositoryName]);
  const filteredSkills = useMemo(() => [] as readonly (readonly [string, string, string])[], []);
  const filteredPullRequests = useMemo(() => [] as readonly (readonly [string, string, string, string])[], []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function dispatch(nextMessage: string) {
    setMessage(nextMessage);
    onDispatch?.(nextMessage);
  }

  return <div className="operation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="operation-modal" role="dialog" aria-modal="true" aria-labelledby="operation-title">
      <button className="operation-close" type="button" onClick={onClose} aria-label="Close operation panel">×</button>
      <header className="operation-header">
        <div className="operation-tag">{operation === "airbase" ? "CCX" : operation === "skill-port" ? "SKILL PORT" : operation === "pr-base" ? "CITY-PR" : "COMMAND"}</div>
        <span className="operation-eyebrow">{details.eyebrow}</span>
        <div className="operation-title-row"><span className="operation-icon" aria-hidden="true">{details.icon}</span><div><h2 id="operation-title">{details.title}</h2><p>{details.description}</p></div></div>
      </header>

      {operation === "command" ? <form className="operation-command" onSubmit={(event) => { event.preventDefault(); const value = message.trim(); if (value) dispatch(`Builder dispatched: ${value}`); }}>
        <label htmlFor="crew-order">CREW ORDER</label>
        <textarea id="crew-order" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="e.g. polish the TypeScript district entrances" rows={3} autoFocus />
        <div className="operation-footer"><span>{repositoryName} · builders standing by</span><button type="submit" disabled={!message.trim()}>DISPATCH CREW</button></div>
      </form> : <>
        <label className="operation-search"><span aria-hidden="true">⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={operation === "airbase" ? "SEARCH DESTINATIONS OR REPOSITORIES" : operation === "skill-port" ? "SEARCH SKILL GUILDS" : "SEARCH TARGETS BY TITLE OR AUTHOR"} /></label>
        <div className="operation-list">
          {operation === "airbase" && filteredRepositories.map(([name, branch, size]) => <button className="operation-card" type="button" key={name} onClick={() => dispatch(`Import queued for ${name}`)}><span className="operation-card-icon">{name.slice(0, 3).toUpperCase()}</span><span><strong>{name}</strong><small>⌘ {branch} · {size}</small></span><b>IMPORT &amp; BOARD →</b></button>)}
          {operation === "skill-port" && filteredSkills.map(([name, description, crew]) => <button className="operation-card" type="button" key={name} onClick={() => dispatch(`${name} crew is sailing to ${repositoryName}`)}><span className="operation-card-icon">⚓</span><span><strong>{name}</strong><small>{description} · {crew}</small></span><b>SAIL →</b></button>)}
          {operation === "pr-base" && filteredPullRequests.map(([number, title, author, files]) => <button className="operation-card" type="button" key={number} onClick={() => dispatch(`Review fleet launched for ${number}`)}><span className="operation-card-icon">{number}</span><span><strong>{title}</strong><small>{author} · {files}</small></span><b>ATTACK →</b></button>)}
          {((operation === "airbase" && filteredRepositories.length === 0) || (operation === "skill-port" && filteredSkills.length === 0) || (operation === "pr-base" && filteredPullRequests.length === 0)) && <div className="operation-empty">{operation === "airbase" ? "GitHub destinations will appear here when the connector is enabled." : operation === "skill-port" ? "Skill org routes will appear here when the connector is enabled." : "No pull requests are connected to this snapshot yet."}</div>}
        </div>
        <div className="operation-footer"><span>{message || `${operation === "pr-base" ? "3 targets in range" : operation === "skill-port" ? "4 guilds on the manifest" : "4 destinations available"}`}</span><button type="button" onClick={onClose}>CLOSE PANEL</button></div>
      </>}
    </section>
  </div>;
}

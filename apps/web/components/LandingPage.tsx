"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { CitySnapshot } from "@tourist/protocol";
import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { CityCanvas } from "./CityCanvas";
import { EnvironmentSprite } from "./EnvironmentSprite";
import { LandmarkSprite } from "./LandmarkSprite";
import { buildingArchetypes } from "./buildings/registry";
import { cityPath, parseGitHubRepo } from "../lib/github-repo";

const FEATURED = ["typescript", "python", "rust", "ruby", "go", "docker"] as const;

export function LandingPage({ snapshot, localCityHref }: { snapshot: CitySnapshot; localCityHref: string }) {
  return (
    <main className="landing">
      <header className="landing-topbar">
        <a className="brand" href="/" aria-label="Tourist home">
          <BrandMark />
          <span>TOURIST</span>
        </a>
        <nav className="landing-nav">
          <a href="#how">How it works</a>
          <a href="#island">The island</a>
          <a href="#agent">The agent <Soon compact /></a>
          <a href="#memory">Memory <Soon compact /></a>
          <a href="#architecture">Buildings</a>
        </nav>
        <Link className="share-button landing-walk" href={localCityHref}>Walk this island</Link>
      </header>

      <section className="landing-hero">
        <div className="landing-city" aria-hidden="true" inert>
          <CityCanvas snapshot={snapshot} chrome={false} onSelectBuilding={() => undefined} />
        </div>
        <div className="landing-veil" />
        <div className="landing-hero-copy">
          <p className="landing-kicker">CLOUD CODING, DRAWN AS A CITY</p>
          <h1>Claude Code in the cloud,<br />with a village attached.</h1>
          <p className="landing-lede">Connect a GitHub repo, bring a key, describe the work. Agents inspect, patch, test, and open a pull request in the cloud — the way Claude Code or Codex would, except you can watch the crew walk the files, and they keep going after you close the laptop.</p>
          <GitHubForm />
        </div>
        <a className="landing-scroll" href="#how">Scroll the island</a>
        <EnvironmentSprite asset="cloud" className="landing-float landing-float-cloud" />
        <EnvironmentSprite asset="compact-car" className="landing-float landing-float-car" />
      </section>

      <section className="landing-band" id="how">
        <EnvironmentSprite asset="lighthouse" className="landing-float landing-float-lighthouse" />
        <p className="landing-kicker">HOW A REPO BECOMES AN ISLAND</p>
        <h2>Land it. Plot it. Walk it.</h2>
        <p className="landing-copy">Tourist is not another chat box around a model. It is a persistent cloud engineering organization: you bring a repository and an API key, give a task in plain language, and agents inspect, plan, edit, test, and open a pull request — while the city shows you where they went.</p>
        <div className="landing-steps">
          <article>
            <LandmarkSprite asset="airbase" className="landing-step-art" />
            <span>01</span>
            <h3>Land the repository</h3>
            <p>Paste a public GitHub URL. Tourist reads the default branch, keeps source, docs, and config, and drops images and generated assets off the map. Folders become sectors; the grid is the real tree.</p>
          </article>
          <article>
            <div className="landing-step-building">{featured("python")}</div>
            <span>02</span>
            <h3>Files take a plot</h3>
            <p>Each kept file gets a building from its type. TypeScript raises a headquarters. Python opens a workshop. Markdown keeps a library. Click a plot and you are inspecting the file, not a decoration.</p>
          </article>
          <article>
            <LandmarkSprite asset="town-hall" className="landing-step-art" />
            <span>03</span>
            <h3>Give it work <Soon /></h3>
            <p>Describe a change the way you would to Codex or Claude Code. A supervisor retrieves memory, picks an agent layout, and runs the job in a cloud sandbox — not on your laptop.</p>
          </article>
        </div>
      </section>

      <section className="landing-band" id="island">
        <EnvironmentSprite asset="cargo-ship" className="landing-float landing-float-ship" />
        <p className="landing-kicker">WHAT YOU CAN ALREADY SEE</p>
        <h2>The island is already alive.</h2>
        <p className="landing-copy">The city behind the prompt is this codebase, mapped for real. Streets follow the block grid. Cars turn at junctions. Ships circle the coast and pause at the harbor. Clouds take the long way around. Town hall already fields a builder crew. That motion is situational awareness in miniature — later it will track actual jobs, not only atmosphere.</p>
        <ul className="landing-facts">
          <li>
            <EnvironmentSprite asset="compact-car" />
            <div>
              <strong>Traffic on the grid</strong>
              <p>Cars stay on the streets, pick turns at junctions, and face the way they drive. No vanish at the end of a road, no teleport back to the start.</p>
            </div>
          </li>
          <li>
            <EnvironmentSprite asset="speedboat" />
            <div>
              <strong>Harbor traffic</strong>
              <p>Cargo and boats loop the water, dock at Skill harbor and the review navy, then head out again — the same ports GitHub work will use.</p>
            </div>
          </li>
          <li>
            <EnvironmentSprite asset="cloud" />
            <div>
              <strong>A slow sky</strong>
              <p>Clouds orbit on curved routes, not a straight scroll. They bob, they take their time, they stay part of the weather instead of a sticker.</p>
            </div>
          </li>
          <li>
            <LandmarkSprite asset="builder-worker" />
            <div>
              <strong>A crew at town hall</strong>
              <p>When a file is being edited, builders leave the plaza and walk that plot. Clash of Clans, except the building is your source file.</p>
            </div>
          </li>
        </ul>
      </section>

      <section className="landing-band landing-agent" id="agent">
        <LandmarkSprite asset="builder-worker" className="landing-float landing-float-builder" />
        <p className="landing-kicker">CLOUD CODING YOU CAN WATCH <Soon /></p>
        <h2>Same power as a coding agent. Visible, and it does not stop when you do.</h2>
        <p className="landing-copy">You already know the loop from Claude Code or Codex: inspect the repo, write the patch, run tests, fix the fallout, open a PR. Tourist does that in isolated cloud sandboxes with Git, runtimes, and search already inside. The difference is the village: every time a file is touched, builders walk out to that plot and work on it, Clash of Clans style. Close the laptop. The crew keeps walking.</p>
        <ol className="landing-loop">
          <li><Soon compact /><b>01</b><strong>Task</strong><span>Describe the work in natural language. A supervisor unpacks it and decides whether one agent is enough or a planner, coder, tester, and reviewer should split the job.</span></li>
          <li><Soon compact /><b>02</b><strong>Sandbox</strong><span>Each run gets its own cloud machine: the repository, tools, and a terminal. Missing a capability? A workshop agent can build a tool, test it, and register it for next time.</span></li>
          <li><Soon compact /><b>03</b><strong>The plot</strong><span>Builders move to the files they touch. Cranes, test-facility lights, and harbor ships are meant to follow real events — editing, tests, PRs — not a fake screensaver.</span></li>
          <li><Soon compact /><b>04</b><strong>Ship</strong><span>A branch, a review pass, then a GitHub pull request. CI and your comments become the next reward signal, not a discarded chat.</span></li>
        </ol>
      </section>

      <section className="landing-band" id="memory">
        <p className="landing-kicker">MEMORY AND REINFORCEMENT <Soon /></p>
        <h2>It should not rediscover your repo every morning.</h2>
        <p className="landing-copy">Session-oriented agents forget the architecture, the failed approach, and how you like a PR cut. Tourist keeps scoped memory, pulls only the context a task needs, and treats tests, CI, latency, tokens, reversions, and your feedback as rewards — so the next topology, tool, and context pack get a little less wasteful.</p>
        <ul className="landing-memory">
          <li><Soon compact /><strong>User memory</strong>How you like to work: TypeScript, smaller PRs, pnpm, the stack you reach for.</li>
          <li><Soon compact /><strong>Codebase memory</strong>Module roles, conventions, fragile areas, past fixes, and prior agent chats on this island.</li>
          <li><Soon compact /><strong>Global memory</strong>Patterns that generalize across repositories, kept only when they earn their keep.</li>
          <li><Soon compact /><strong>Episodic memory</strong>The attempt, the failure, the fix, the outcome — so it does not retry the same dead end.</li>
          <li><Soon compact /><strong>Dynamic context</strong>Only the code, memories, tools, and history that belong to this task — not the whole tree stuffed into the prompt.</li>
          <li><Soon compact /><strong>Reward signal</strong>Tests, CI, tokens, latency, PR outcomes, and your notes train which layout and tools to try next.</li>
        </ul>
      </section>

      <section className="landing-band landing-architecture" id="architecture">
        <p className="landing-kicker">THE BUILDING CODE</p>
        <h2>A façade for every language.</h2>
        <p className="landing-copy">Architecture is authored once per file type, then instanced across the island. Sectors are top-level folders. Blocks are the directory grid. The skyline is a catalog — workshops, halls, institutes — keyed to extensions you already know, not a random pack of towers.</p>
        <ul className="landing-skyline">
          {FEATURED.map((id) => {
            const entry = buildingArchetypes.find((item) => item.design.id === id);
            if (!entry) return null;
            const Artwork = entry.Component;
            return (
              <li key={id}>
                <Artwork design={entry.design} />
                <strong>{entry.design.label}</strong>
                <span>{entry.design.example}</span>
              </li>
            );
          })}
        </ul>
        <Link className="landing-more" href="/buildings">See the full architecture collection ↗</Link>
      </section>

      <section className="landing-band landing-landmarks" id="landmarks">
        <EnvironmentSprite asset="fountain" className="landing-float landing-float-fountain" />
        <p className="landing-kicker">CIVIC GROUNDS</p>
        <h2>Not every plot is a file.</h2>
        <p className="landing-copy">Landmarks are the operations layer. The airbase is where a repository arrives. The skill harbor is the workshop where agents invent missing tools, test them, and register them for next time. Dedicated test facilities light up when the suite runs. The review navy is pull-request traffic. Town hall is command — the place you send work from, and where idle builders wait until a file needs them.</p>
        <div className="landing-landmark-row">
          <figure>
            <LandmarkSprite asset="airbase" />
            <figcaption>Airbase · import a repo</figcaption>
          </figure>
          <figure>
            <LandmarkSprite asset="skill-harbor" />
            <figcaption>Skill harbor · tools</figcaption>
          </figure>
          <figure>
            <LandmarkSprite asset="navy-review-yard" />
            <figcaption>Review navy · PRs</figcaption>
          </figure>
          <figure>
            <LandmarkSprite asset="town-hall" />
            <figcaption>Town hall · command</figcaption>
          </figure>
        </div>
      </section>

      <section className="landing-band landing-close">
        <h2>Put a repository on the map.</h2>
        <p className="landing-copy">The island behind you is Tourist’s own tree. Next: paste yours, bring an OpenAI key when the agents are live, and leave a crew that keeps building after you log off.</p>
        <GitHubForm />
      </section>

      <footer className="landing-footer">
        <span>Tourist · cloud coding, as a city</span>
        <Link href={localCityHref}>Open the local island ↗</Link>
      </footer>
    </main>
  );
}

function Soon({ compact = false }: { compact?: boolean }) {
  return <span className={compact ? "landing-soon is-compact" : "landing-soon"}>{compact ? "Soon" : "Coming soon"}</span>;
}

function featured(id: string) {
  const entry = buildingArchetypes.find((item) => item.design.id === id);
  if (!entry) return null;
  const Artwork = entry.Component;
  return <Artwork design={entry.design} />;
}

function GitHubForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseGitHubRepo(value);
    if (!parsed) {
      setError("Use owner/repo or a github.com URL.");
      return;
    }
    setError(undefined);
    router.push(cityPath(parsed.owner, parsed.repo));
  }

  return (
    <form className="landing-form" onSubmit={onSubmit}>
      <label className="landing-input-label" htmlFor="github-url">GitHub repository</label>
      <div className="landing-input-row">
        <span className="landing-github-mark" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="22" height="22">
            <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </span>
        <input
          id="github-url"
          name="url"
          value={value}
          onChange={(event) => { setValue(event.target.value); setError(undefined); }}
          placeholder="github.com/owner/repo"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "github-url-error" : undefined}
        />
        <button type="submit">Enter the city</button>
      </div>
      {error ? <p id="github-url-error" className="landing-form-error">{error}</p> : <p className="landing-form-hint">Public GitHub repos for now. Bring a key later; the agents keep working in the cloud.</p>}
    </form>
  );
}

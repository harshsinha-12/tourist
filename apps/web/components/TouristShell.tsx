"use client";

import { useMemo, useState } from "react";
import type { Building, PublicReport } from "@tourist/protocol";
import { CityCanvas } from "./CityCanvas";

export function TouristShell({ report }: { report: PublicReport }) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>();
  const [focusedAnchorId, setFocusedAnchorId] = useState<string>();
  const snapshot = report.snapshot;
  const selectedBuilding = useMemo(
    () => snapshot.buildings.find((building) => building.id === selectedBuildingId),
    [selectedBuildingId, snapshot.buildings],
  );
  const activeSection = report.sections.find((section) => section.anchorId === focusedAnchorId);

  function focusAnchor(anchorId: string) {
    const anchor = snapshot.anchors.find((candidate) => candidate.id === anchorId);
    setFocusedAnchorId(anchorId);
    if (anchor?.target.type === "building") setSelectedBuildingId(anchor.target.buildingId);
  }

  return (
    <main className="tourist-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Tourist home">
          <span className="brand-mark">T</span>
          <span>TOURIST</span>
        </a>
        <div className="repo-chip">
          <span className="live-dot" />
          {snapshot.repository.name}
          <span className="slash">/</span>
          {snapshot.repository.revision}
        </div>
        <button className="share-button" type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
          Copy report link
        </button>
      </header>

      <section className="world-stage" aria-label="Interactive repository city">
        <CityCanvas
          snapshot={snapshot}
          focusedAnchorId={focusedAnchorId}
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={(building: Building) => setSelectedBuildingId(building.id)}
        />

        <aside className="report-card glass-panel">
          <div className="panel-kicker">PUBLIC BUILD REPORT</div>
          <h1>{report.title}</h1>
          <p>{report.summary}</p>
          <div className="report-meta">
            <span>{snapshot.buildings.length} buildings</span>
            <span>{snapshot.sectors.length} sectors</span>
            <span>snapshot v{snapshot.schemaVersion}</span>
          </div>
          <div className="report-sections">
            {report.sections.map((section, index) => (
              <button
                className={`report-section ${focusedAnchorId === section.anchorId ? "is-active" : ""}`}
                key={section.id}
                onClick={() => focusAnchor(section.anchorId)}
                type="button"
              >
                <span className={`status-gem status-${section.status}`}>{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <small>{section.eyebrow}</small>
                  <strong>{section.title}</strong>
                </span>
              </button>
            ))}
          </div>
          {activeSection && (
            <div className="active-report-copy">
              <span>{activeSection.eyebrow}</span>
              <p>{activeSection.body}</p>
            </div>
          )}
        </aside>

        <aside className="inspector glass-panel" aria-live="polite">
          {selectedBuilding ? <BuildingDetails building={selectedBuilding} /> : (
            <>
              <div className="panel-kicker">CITY INSPECTOR</div>
              <h2>Choose a building</h2>
              <p>Click any structure to inspect the file behind it, or pick a report stop to fly to its evidence.</p>
            </>
          )}
        </aside>

        <div className="world-controls glass-panel">
          <span>Select a report stop</span>
          <span>Click a file marker</span>
          <span>Inspect the build</span>
        </div>
      </section>
    </main>
  );
}

function BuildingDetails({ building }: { building: Building }) {
  return (
    <>
      <div className="panel-kicker">BUILDING INSPECTOR</div>
      <div className="inspector-title">
        <span className="language-swatch" style={{ backgroundColor: building.color }} />
        <h2>{building.name}</h2>
      </div>
      <code>{building.path}</code>
      <dl>
        <div><dt>Language</dt><dd>{building.language}</dd></div>
        <div><dt>Purpose</dt><dd>{building.kind}</dd></div>
        <div><dt>Size</dt><dd>{building.linesOfCode.toLocaleString()} LOC</dd></div>
        <div><dt>State</dt><dd className={`state-${building.state}`}>{building.state}</dd></div>
      </dl>
    </>
  );
}

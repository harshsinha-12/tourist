"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../BrandMark";
import { buildingArchetypes, getBuildingArchetype } from "./registry";
import type { BuildingArchetype } from "./types";

const categories = [...new Set(buildingArchetypes.map(({ design }) => design.category ?? "Other"))];

export function BuildingGallery() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<string>();
  const [path, setPath] = useState("src/app.tsx");
  const visible = useMemo(() => buildingArchetypes.filter(({ design, extensions }) =>
    (category === "All" || design.category === category)
    && `${design.badge} ${design.label} ${design.example} ${extensions.join(" ")}`.toLowerCase().includes(query.toLowerCase().trim())), [query, category]);
  const detail = buildingArchetypes.find(({ design }) => design.id === selected);
  const resolved = getBuildingArchetype({ path, language: "unknown" });

  return <main className="building-gallery">
    <header className="gallery-header">
      <Link className="brand" href="/"><BrandMark /><span>TOURIST</span></Link>
      <span className="gallery-edition">THE ARCHITECTURE COLLECTION · VOL. 01</span>
      <Link className="gallery-back" href="/">Explore the city ↗</Link>
    </header>
    <section className="gallery-intro">
      <div><div className="panel-kicker">A PLACE FOR EVERY FILE</div>
        <h1>Small buildings.<br /><em>Extraordinary detail.</em></h1>
        <p>A workshop for your scripts. A library for your words. An entire neighborhood, built from the files you know.</p>
      </div>
      <div className="gallery-count"><strong>{buildingArchetypes.length}</strong><span>distinct buildings<br />one design per file type</span></div>
    </section>
    <section className="file-preview" aria-label="Try a file path">
      <label htmlFor="file-path">Find a file’s home</label>
      <input id="file-path" value={path} onChange={(event) => setPath(event.target.value)} spellCheck={false} placeholder="src/app.tsx" />
      <span aria-hidden="true">→</span>
      <button type="button" onClick={() => setSelected(resolved.design.id)} aria-live="polite">{resolved.design.label} ↗</button>
    </section>
    <div className="gallery-toolbar">
      <label className="gallery-search"><span>Search buildings</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Python, .css, Docker…" /></label>
      <span aria-live="polite">{visible.length} of {buildingArchetypes.length} buildings</span>
    </div>
    <nav className="gallery-filters" aria-label="Building categories">
      {["All", ...categories].map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
    </nav>
    <section className="gallery-grid" aria-label="Building collection">
      {visible.map(({ design, Component, extensions }) => <button type="button" className="gallery-card" key={design.id} onClick={() => setSelected(design.id)} aria-label={`View ${design.badge} building`}>
        <div className="gallery-card-top"><span>{design.example}</span><span>{design.category}</span></div>
        <div className="gallery-art"><Component design={design} /></div>
        <div className="gallery-card-copy"><h2>{design.label}</h2><span>{extensions.length ? extensions.map((extension) => `.${extension}`).join(" · ") : design.badge}</span><b aria-hidden="true">↗</b></div>
      </button>)}
      {visible.length === 0 && <p className="gallery-empty">No buildings match that search. Try another extension or category.</p>}
    </section>
    <footer className="gallery-footer"><span>{buildingArchetypes.length} little pieces of a larger world.</span><Link href="/">Back to the island ↗</Link></footer>
    {detail && <BuildingPreview detail={detail} onClose={() => setSelected(undefined)} />}

  </main>;
}

function BuildingPreview({ detail, onClose }: { detail: BuildingArchetype; onClose: () => void }) {
  const Artwork = detail.Component;
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return <dialog ref={ref} className="building-dialog" aria-labelledby="building-dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <button className="dialog-close" type="button" onClick={onClose} aria-label="Close building preview">×</button>
    <div className="dialog-art"><Artwork design={detail.design} /></div>
    <div className="dialog-copy"><div className="panel-kicker">{detail.design.category}</div><h2 id="building-dialog-title">{detail.design.label}</h2><p>{detail.design.badge}</p><code>{detail.design.example}</code><p className="dialog-extensions">{detail.extensions.map((extension) => `.${extension}`).join(" · ") || "Recognized by file name or purpose"}</p></div>
  </dialog>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./video-studio-v2.module.css";

type RailModel = { id: string; name: string; providerFamily?: string; tier: string; available?: boolean };

export function VideoModelBrand({ name, provider = "" }: { name: string; provider?: string }) {
  const value = `${name} ${provider}`.toLowerCase();
  const brand = value.includes("ltx") ? "ltx.png" : value.includes("minimax") ? "minimax.ico" : value.includes("seedance") ? "seedance.ico" : value.includes("kling") ? "kling.png" : value.includes("wan") ? "wan.ico" : value.includes("grok") ? "grok.ico" : value.includes("google") ? "google.png" : null;
  return <span className={styles.videoBrand} aria-hidden="true">{brand ? <img src={`/video-studio/brands/${brand}`} alt="" width={28} height={28} /> : <span>{value.includes("flashvsr") ? "VSR" : "AI"}</span>}</span>;
}

export function VideoModelRail({ models, selected, onSelect, motionAllowed }: { models: RailModel[]; selected: string; onSelect: (id: string) => void; motionAllowed: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    if (!motionAllowed || paused || interacting) return;
    const timer = window.setInterval(() => {
      const el = rail.current;
      if (!el || document.hidden || el.scrollWidth <= el.clientWidth) return;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 3;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + 230, behavior: "smooth" });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [motionAllowed, paused, interacting]);
  const move = (direction: number) => {
    setPaused(true);
    rail.current?.scrollBy({ left: direction * 460, behavior: motionAllowed ? "smooth" : "auto" });
  };
  return <section className={styles.modelShowcase} aria-label="Video model collection">
    <div className={styles.railHeading}><span><b>Choose your creative engine</b><small>Find your fit. Every model, one studio.</small></span><div>
      {motionAllowed && <button type="button" aria-label={paused ? "Resume model scrolling" : "Pause model scrolling"} aria-pressed={paused} onClick={() => { setPaused(!paused); if (!paused && rail.current) rail.current.scrollTo({ left: rail.current.scrollLeft, behavior: "instant" }); }}>{paused ? "▶" : "Ⅱ"}</button>}
      <button type="button" aria-label="Previous video models" onClick={() => move(-1)}>←</button><button type="button" aria-label="Next video models" onClick={() => move(1)}>→</button>
    </div></div>
    <div ref={rail} className={styles.modelRail} aria-label="Available video models" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onTouchStart={() => setPaused(true)} onFocusCapture={() => setInteracting(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false); }}>
      {models.filter(model => model.available !== false).map(model => <button key={model.id} type="button" aria-pressed={selected === model.id} className={selected === model.id ? styles.modelRailSelected : ""} onClick={() => onSelect(model.id)}><VideoModelBrand name={model.name} provider={model.providerFamily} /><span><b>{model.name}</b><small>{model.providerFamily || "Video model"} · {model.tier}</small></span>{selected === model.id && <i aria-hidden="true">✓</i>}</button>)}
    </div>
  </section>;
}

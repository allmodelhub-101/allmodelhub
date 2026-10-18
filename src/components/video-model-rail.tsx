"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./video-studio-v2.module.css";

type RailModel = { id: string; name: string; providerFamily?: string; tier: string; available?: boolean };

export function VideoModelBrand({ name, provider = "" }: { name: string; provider?: string }) {
  const value = `${name} ${provider}`.toLowerCase();
  const brand = value.includes("ltx") ? "ltx.png" : value.includes("minimax") ? "minimax.ico" : value.includes("seedance") ? "seedance.ico" : value.includes("kling") ? "kling.png" : value.includes("wan") ? "wan.ico" : value.includes("grok") ? "grok.ico" : value.includes("google") ? "google.png" : null;
  return <span className={styles.videoBrand} aria-hidden="true">{brand ? <Image src={`/video-studio/brands/${brand}`} alt="" width={28} height={28} unoptimized /> : <span>{value.includes("flashvsr") ? "VSR" : "AI"}</span>}</span>;
}

export function VideoModelRail({ models, selected, onSelect, motionAllowed }: { models: RailModel[]; selected: string; onSelect: (id: string) => void; motionAllowed: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    if (!motionAllowed || paused || interacting) return;
    let frame = 0;
    let previous = 0;
    let position = rail.current?.scrollLeft || 0;
    let visible = true;
    const stop = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    };
    const start = () => {
      if (visible && !document.hidden && !frame) frame = window.requestAnimationFrame(animate);
    };
    const animate = (time: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      const el = rail.current;
      const width = group.current?.offsetWidth || 0;
      if (el && width && !document.hidden && previous) {
        position = (position + Math.min(time - previous, 50) * 0.028) % width;
        el.scrollLeft = position;
      }
      previous = time;
      start();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start(); else stop();
    });
    if (rail.current) observer.observe(rail.current);
    const visibilityChanged = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener("visibilitychange", visibilityChanged);
    start();
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [motionAllowed, paused, interacting]);
  const move = (direction: number) => {
    setPaused(true);
    rail.current?.scrollBy({ left: direction * 460, behavior: motionAllowed ? "smooth" : "auto" });
  };
  const available = models.filter(model => model.available !== false);
  return <section className={styles.modelShowcase} aria-label="Video model collection">
    <div className={styles.railHeading}><span><b>Video models</b></span><div>
      {motionAllowed && <button type="button" aria-label={paused ? "Resume model scrolling" : "Pause model scrolling"} aria-pressed={paused} onClick={() => { setPaused(!paused); if (!paused && rail.current) rail.current.scrollTo({ left: rail.current.scrollLeft, behavior: "instant" }); }}>{paused ? "▶" : "Ⅱ"}</button>}
      <button type="button" aria-label="Previous video models" onClick={() => move(-1)}>←</button><button type="button" aria-label="Next video models" onClick={() => move(1)}>→</button>
    </div></div>
    <div ref={rail} className={styles.modelRail} aria-label="Available video models" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onTouchStart={() => setPaused(true)} onFocusCapture={() => setInteracting(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false); }}>
      <div className={styles.modelTrack}>
        {[0, ...(motionAllowed ? [1, 2] : [])].map(copy => <div key={copy} ref={copy === 0 ? group : undefined} className={styles.modelGroup} aria-hidden={copy === 0 ? undefined : true}>
          {available.map(model => <button key={model.id} type="button" tabIndex={copy === 0 ? 0 : -1} aria-pressed={selected === model.id} className={selected === model.id ? styles.modelRailSelected : ""} onClick={() => onSelect(model.id)}><VideoModelBrand name={model.name} provider={model.providerFamily} /><span><b>{model.name}</b><small>{model.providerFamily || "Video model"}</small></span>{selected === model.id && <i aria-hidden="true">✓</i>}</button>)}
        </div>)}
      </div>
    </div>
  </section>;
}

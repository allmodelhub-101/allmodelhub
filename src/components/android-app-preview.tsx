"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChatCircleDots, ImageSquare, VideoCamera, Waveform, Sparkle } from "@phosphor-icons/react";
import styles from "@/app/android/android.module.css";

const modes = [
  { id: "chat", label: "Chat", icon: ChatCircleDots },
  { id: "image", label: "Image", icon: ImageSquare },
  { id: "video", label: "Video", icon: VideoCamera },
  { id: "audio", label: "Audio", icon: Waveform },
] as const;

export function AndroidAppPreview() {
  const [selected, setSelected] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let visible = true;
    const update = () => { element.dataset.moving = String(visible && !document.hidden); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);

  function navigate(event: KeyboardEvent, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % modes.length :
      event.key === "ArrowLeft" ? (index + modes.length - 1) % modes.length :
      event.key === "Home" ? 0 : event.key === "End" ? modes.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  const mode = modes[selected];
  return <div className={styles.showcase} ref={root} data-moving="true">
    <div className={styles.orbit} aria-hidden="true" />
    <div className={styles.orbitInner} aria-hidden="true" />
    <div className={styles.floatingNote} aria-hidden="true"><Sparkle size={18} weight="duotone" /><div><strong>One connected workspace</strong><span>From the first idea to the final frame.</span></div></div>
    <figure className={styles.phoneFigure}>
      <div className={styles.phoneFloat}>
        <div className={styles.phone}>
          <div className={styles.camera} aria-hidden="true"><span /></div>
          <div className={styles.phoneScreen} id="android-preview-panel" role="tabpanel" aria-labelledby={`android-preview-${mode.id}`} tabIndex={0}>
            <Image className={styles.screenDark} src={`/android/previews/${mode.id}-dark.webp`} alt={`Models Suite ${mode.label} workspace interface with example content`} width={390} height={844} unoptimized loading="eager" />
            <Image className={styles.screenLight} src={`/android/previews/${mode.id}-light.webp`} alt={`Models Suite ${mode.label} workspace interface with example content`} width={390} height={844} unoptimized loading="eager" />
          </div>
          <div className={styles.gesture} aria-hidden="true" />
        </div>
      </div>
      <div className={styles.previewTabs} role="tablist" aria-label="Preview the Models Suite workspace">
        {modes.map(({ id, label, icon: Icon }, index) => <button key={id} id={`android-preview-${id}`} type="button" role="tab" aria-selected={selected === index} aria-controls="android-preview-panel" tabIndex={selected === index ? 0 : -1} ref={element => { tabs.current[index] = element; }} onClick={() => setSelected(index)} onKeyDown={event => navigate(event, index)}><Icon size={17} aria-hidden="true" /><span>{label}</span></button>)}
      </div>
      <figcaption>Workspace interface previews · example content</figcaption>
    </figure>
    <div className={styles.floatingIcon} aria-hidden="true"><Image src="/pwa/icon-192.png" alt="" width={52} height={52} /><span>Your ideas.<br /><strong>In motion.</strong></span></div>
  </div>;
}

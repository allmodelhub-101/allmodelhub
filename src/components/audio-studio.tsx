"use client";

import { useState } from "react";
import { AudioGenerationClient } from "@/components/audio-generation-client";
import { TtsClient } from "@/components/tts-client";
import styles from "@/components/audio-studio.module.css";

type AudioMode = "speech" | "music" | "sfx";

const copy = {
  speech: { title: <>Give your words a <span>voice</span>.</>, body: "Create realistic speech, music, and sound effects with advanced AI models." },
  music: { title: <>Give your story a <span>soundtrack</span>.</>, body: "Create original music from a focused written direction." },
  sfx: { title: <>Create a sound from <span>words</span>.</>, body: "Generate clear, purpose-built sound effects for the moment you have in mind." }
} as const;

export function AudioStudio() {
  const [mode, setMode] = useState<AudioMode>("speech");
  const current = copy[mode];

  return <div className={styles.page}>
    <div className={styles.hero}>
      <div className={styles.heroCopy}><div className={styles.kicker}>Audio Studio</div><h1>{current.title}</h1><p>{current.body}</p></div>
      <div className={styles.heroWave} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
    </div>
    <div className={styles.modeTabs} role="tablist" aria-label="Audio creation mode">
      <button type="button" role="tab" aria-selected={mode === "speech"} className={mode === "speech" ? styles.active : ""} onClick={() => setMode("speech")}>Speech</button>
      <button type="button" role="tab" aria-selected={mode === "music"} className={mode === "music" ? styles.active : ""} onClick={() => setMode("music")}>Music</button>
      <button type="button" role="tab" aria-selected={mode === "sfx"} className={mode === "sfx" ? styles.active : ""} onClick={() => setMode("sfx")}>Sound effects</button>
    </div>
    <div className={styles.content}>{mode === "speech" ? <TtsClient /> : <AudioGenerationClient key={mode} mode={mode} />}</div>
  </div>;
}

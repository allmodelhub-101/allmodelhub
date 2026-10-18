"use client";

import { useState,type ReactNode } from "react";
import { AudioGenerationClient } from "@/components/audio-generation-client";
import { TtsClient } from "@/components/tts-client";
import styles from "@/components/audio-studio.module.css";
import Link from "next/link";
import { Microphone, MusicNote, SpeakerHigh, Waveform } from "@phosphor-icons/react";

type AudioMode = "speech" | "music" | "sfx";

export function AudioStudio({panels}:{panels?:Partial<Record<AudioMode,ReactNode>>}) {
  const [mode, setMode] = useState<AudioMode>("speech");
  const [paused, setPaused] = useState(false);
  const modes = ["speech", "music", "sfx"] as const;

  return <div className={styles.page} data-studio="audio" data-mode={mode} data-motion-paused={paused}>
    <div className={styles.hero}>
      <div className={styles.heroCopy}><span className={styles.studioMark}><Waveform aria-hidden="true" /></span><div><h1>Audio Studio</h1><p>Create sound. Set the mood.</p></div></div>
      <div className={styles.headerActions}><button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Resume motion" : "Pause motion"}</button><Link href="/history">History ↗</Link></div>
    </div>
    <div className={styles.modeTabs} role="tablist" aria-label="Audio creation mode" onKeyDown={event => { const focused=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')).indexOf(document.activeElement as HTMLButtonElement); const index=focused>=0?focused:modes.indexOf(mode); const next=event.key === "ArrowRight" ? (index+1)%3 : event.key === "ArrowLeft" ? (index+2)%3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1; if(next<0)return;event.preventDefault();setMode(modes[next]);event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus(); }}>
      {modes.map((item,index)=><button key={item} id={`audio-tab-${item}`} type="button" role="tab" tabIndex={mode===item?0:-1} aria-controls="audio-mode-panel" aria-selected={mode===item} className={mode===item?styles.active:""} onClick={()=>setMode(item)}>{index===0?<Microphone aria-hidden="true"/>:index===1?<MusicNote aria-hidden="true"/>:<SpeakerHigh aria-hidden="true"/>}<span><b>{item==="speech"?"Speech":item==="music"?"Music":"Sound effects"}</b><small>{item==="speech"?"Words into voice":item==="music"?"Find your soundtrack":"Design the moment"}</small></span></button>)}
    </div>
    <div className={styles.content} id="audio-mode-panel" role="tabpanel" aria-labelledby={`audio-tab-${mode}`}>{panels?.[mode]??(mode === "speech" ? <TtsClient /> : <AudioGenerationClient key={mode} mode={mode} />)}</div>
  </div>;
}

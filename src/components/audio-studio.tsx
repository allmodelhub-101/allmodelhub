"use client";

import { useState } from "react";
import { MediaStudio } from "@/components/media-studio";
import { TtsClient } from "@/components/tts-client";
import styles from "@/components/audio-studio.module.css";

type AudioMode="speech"|"music"|"sfx";

export function AudioStudio(){
  const [mode,setMode]=useState<AudioMode>("speech");
  return <div className={styles.page}>
    <div className={styles.hero}>
      <div className={styles.heroCopy}><div className={styles.kicker}>Audio Studio</div><h1>{mode==="speech"?<>Give your words a <span>voice</span>.</>:mode==="music"?"Give your story a soundtrack.":"Create a sound from words."}</h1><p>{mode==="speech"?"Create realistic speech, music, and sound effects with advanced AI models.":mode==="music"?"Create original music with controls supported by the selected model.":"Generate precise sound effects with model-specific duration controls."}</p></div>
      <div className={styles.heroWave} aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
    </div>
    <div className={styles.modeTabs} role="tablist" aria-label="Audio creation mode">
      <button type="button" role="tab" aria-selected={mode==="speech"} className={mode==="speech"?styles.active:""} onClick={()=>setMode("speech")}>Speech</button>
      <button type="button" role="tab" aria-selected={mode==="music"} className={mode==="music"?styles.active:""} onClick={()=>setMode("music")}>Music</button>
      <button type="button" role="tab" aria-selected={mode==="sfx"} className={mode==="sfx"?styles.active:""} onClick={()=>setMode("sfx")}>Sound effects</button>
    </div>
    <div className={styles.content}>
      {mode==="speech"?<TtsClient/>:<MediaStudio key={mode} modality="audio" embedded hideAudioModeTabs initialAudioMode={mode} title="Audio Studio" subtitle={mode==="music"?"Create original music with controls supported by the selected model.":"Generate precise sound effects with model-specific duration controls."}/>} 
    </div>
  </div>;
}


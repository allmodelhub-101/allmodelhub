"use client";

import { useState } from "react";
import { MediaStudio } from "@/components/media-studio";
import { TtsClient } from "@/components/tts-client";

type AudioMode="speech"|"music"|"sfx";

export function AudioStudio(){
  const [mode,setMode]=useState<AudioMode>("speech");
  return <div className="audio-studio-page">
    <div className="workspace-heading"><div><div className="kicker">Audio Studio</div><h1>{mode==="speech"?"Give your words a voice.":mode==="music"?"Give your story a soundtrack.":"Create a sound from words."}</h1></div><div className="workspace-context">Specialized audio workspace</div></div>
    <div className="workspace-modes" role="tablist" aria-label="Audio creation mode">
      <button type="button" role="tab" aria-selected={mode==="speech"} className={mode==="speech"?"active":""} onClick={()=>setMode("speech")}>Speech</button>
      <button type="button" role="tab" aria-selected={mode==="music"} className={mode==="music"?"active":""} onClick={()=>setMode("music")}>Music</button>
      <button type="button" role="tab" aria-selected={mode==="sfx"} className={mode==="sfx"?"active":""} onClick={()=>setMode("sfx")}>Sound effects</button>
    </div>
    <div className="audio-studio-scroll">
      {mode==="speech"?<TtsClient/>:<MediaStudio key={mode} modality="audio" embedded hideAudioModeTabs initialAudioMode={mode} title="Audio Studio" subtitle={mode==="music"?"Create original music with controls supported by the selected model.":"Generate precise sound effects with model-specific duration controls."}/>} 
    </div>
  </div>;
}


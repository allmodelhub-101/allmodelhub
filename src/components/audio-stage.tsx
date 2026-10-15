import styles from "./audio-studio.module.css";

/** Decorative studio artwork, not an audio waveform or a playback control. */
export function AudioStage({ mode, busy=false }: { mode: "speech" | "music" | "sfx"; busy?: boolean }) {
  return <div className={`${styles.soundStage} ${styles[mode]} ${busy ? styles.rendering : ""}`} aria-hidden="true">
    <div className={styles.soundGrid}/><div className={styles.soundHalo}/>
    <div className={styles.soundOrbit}><i/><i/><i/></div>
    <div className={styles.soundDisc}><div className={styles.soundCore}>{mode === "music" ? "♪" : mode === "speech" ? "Aa" : "✦"}</div></div>
    <div className={styles.soundBars}>{Array.from({length:40},(_,index)=><i key={index} style={{height:`${15+((index*17+index%3*11)%65)}%`,animationDelay:`${-index*.13}s`}}/>)}</div>
    <span className={styles.stageLabel}>STUDIO VISUAL · {mode === "speech" ? "VOICE" : mode === "music" ? "MUSIC" : "SOUND DESIGN"}</span>
  </div>;
}

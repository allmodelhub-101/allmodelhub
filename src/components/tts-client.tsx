"use client";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PremiumSelect } from "@/components/premium-select";
import { CheckCircle, DotsThree, DownloadSimple, GearSix, GlobeHemisphereWest, Info, Microphone, Pause, Play, Sparkle, SpeakerHigh, UploadSimple, UsersThree, Waveform } from "@phosphor-icons/react";
import styles from "@/components/audio-studio.module.css";

type AudioModel = { id: string; name: string; tier: string; capabilities: string[]; retail?: { per1kCharsCredits?: number; flatCredits?: number } };

const voices = [
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Sarah · Reassuring female", note: "Reassuring female", tone: "Natural" },
  { value: "pNInz6obpgDQGcFmaJgB", label: "Adam · Deep male", note: "Deep male voice", tone: "Professional" },
  { value: "hpp4J3VqNfWAUOO0d1Us", label: "Bella · Bright female", note: "Friendly female", tone: "Friendly" },
  { value: "JBFqnCBsd6RMkjVDRZzb", label: "George · British storyteller", note: "Narrator", tone: "Calm" },
  { value: "onwK4e9ZLuTAKqWW03F9", label: "Daniel · Broadcaster", note: "Broadcaster", tone: "Professional" },
];

const templates = [
  { label: "Product explainer", copy: "Welcome to All Model Hub. Create more, explore leading AI models, and bring your best ideas to life.", icon: "product" },
  { label: "YouTube narration", copy: "Today, we are breaking down the five ideas that can make your next project stand out.", icon: "youtube" },
  { label: "Social media", copy: "Stop scrolling. Your next great idea starts right here.", icon: "social" },
  { label: "Meditation", copy: "Take a gentle breath in. Let your shoulders soften, and allow this moment to be completely yours.", icon: "meditation" },
];

function secondsLabel(value: number) { return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, "0")}`; }

export function TtsClient() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("EXAVITQu4vr4xnSDxMaL");
  const [url, setUrl] = useState<string>();
  const [credits, setCredits] = useState<string>();
  const [models, setModels] = useState<AudioModel[]>([]);
  const [modelId, setModelId] = useState("eleven-tts-flash");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [showVoices, setShowVoices] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => { fetch("/api/models").then((r) => r.json()).then((data) => { const list = (data.models || []).filter((item: AudioModel) => item.capabilities?.includes("tts")); setModels(list); const requested = new URLSearchParams(window.location.search).get("model"); if (requested && list.some((item: AudioModel) => item.id === requested)) setModelId(requested); }).catch(() => undefined); }, []);
  const selectedModel = models.find((item) => item.id === modelId);
  const per1k = Number(selectedModel?.retail?.per1kCharsCredits || 0);
  const flat = Number(selectedModel?.retail?.flatCredits || 0);
  const estimate = useMemo(() => flat || per1k * Math.max(0.001, text.length / 1000), [flat, per1k, text.length]);
  const expensive = estimate >= 50;
  const visibleVoices = showVoices ? voices : voices.slice(0, 4);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);


  async function submit(event: FormEvent) {
    event.preventDefault();
    if (expensive && !confirmed) { setError("Confirm the estimated cost before generating this voiceover."); return; }
    setBusy(true); setError("");
    if (url) URL.revokeObjectURL(url);
    const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), modelId, text, voiceId: voice, confirmedCost: confirmed || !expensive }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || "TTS failed"); setBusy(false); return; }
    const blob = await response.blob(); setUrl(URL.createObjectURL(blob)); setCredits(response.headers.get("x-amh-credits") || undefined); setCurrentTime(0); setDuration(0); setPlaying(false); setBusy(false);
  }

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (audio.paused) await audio.play(); else audio.pause();
  };

  return <div className={styles.workspace}>
    <form className={styles.controls} onSubmit={submit}>
      <div className={styles.cardHead}><span className={styles.headIcon}><Microphone weight="fill" /></span><div><h2>Generate Speech</h2><p>Turn your text into natural, lifelike speech with the best AI voices.</p></div><i>01</i></div>
      <label className={styles.field}><span>AI speech model</span><div className={styles.selectWrap}><span className={styles.fieldIcon}><UsersThree /></span><PremiumSelect className={styles.select} value={modelId} onChange={(value) => { setModelId(value); setConfirmed(false); }} options={models.map((model) => ({ value: model.id, label: `${model.name} · ${model.tier}` }))} aria-label="AI speech model" /></div>{selectedModel && <small>{selectedModel.capabilities.includes("multilingual") ? "High quality, natural and expressive multilingual speech" : "High quality, natural and expressive speech"}</small>}</label>
      <label className={styles.field}><span>Script <small>{text.length.toLocaleString()} / 10,000</small></span><textarea value={text} onChange={(event) => { setText(event.target.value); setConfirmed(false); }} maxLength={10000} required placeholder="Write or paste your script here…&#10;E.g. a product explainer, narration, or any text you want to hear." /></label>
      <div className={styles.twoFields}><label className={styles.field}><span>Voice</span><div className={styles.selectWrap}><span className={styles.fieldIcon}><UsersThree /></span><PremiumSelect className={styles.select} value={voice} onChange={setVoice} options={voices} aria-label="Voice" /></div></label><label className={styles.field}><span>Language &amp; accent <Info aria-label="The current provider infers language from the script" /></span><div className={styles.capabilityField} title="The current provider infers language from your script"><GlobeHemisphereWest /> <b>{selectedModel?.capabilities.includes("multilingual") ? "Automatic from script" : "Model default"}</b></div></label></div>
      <div className={styles.styleGroup}><span>Tone / Style</span><div>{["Natural", "Professional", "Friendly", "Energetic", "Calm"].map((item, index) => <button key={item} type="button" disabled title="Tone controls are unavailable for the selected provider" className={index === 0 ? styles.selectedStyle : ""}>{item}</button>)}<button type="button" disabled title="Tone controls are unavailable for the selected provider">More</button></div><small>Additional voice-direction parameters appear when supported by the selected model.</small></div>
      <div className={styles.sliders}>{[["Speed", "1.0x"], ["Pitch", "0%"], ["Stability", "75%"]].map(([label, value]) => <label key={label}><span>{label} <Info aria-label={`${label} is unavailable for the selected provider`} /><small>{value}</small></span><input type="range" disabled min="0" max="100" value={label === "Stability" ? 75 : label === "Pitch" ? 50 : 50} readOnly /></label>)}</div>
      <div className={styles.additional}><span>Additional options</span><div><button type="button" disabled title="Pronunciation controls are not supported by the selected provider"><SpeakerHigh />Pronunciation</button><button type="button" disabled title="Reference audio is not supported by the selected provider"><UploadSimple />Reference audio</button><button type="button" onClick={() => setAdvanced((value) => !value)}><GearSix />Advanced settings</button></div>{advanced && <div className={styles.advancedPanel}><b>Current model capabilities</b><p>{selectedModel?.capabilities?.join(" · ") || "Choose a speech model to see supported capabilities."}</p><p>Generation sends only supported model, script, and voice settings.</p></div>}</div>
      <div className={styles.costRow}><span className={styles.costIcon}><Waveform /></span><span><small>Estimated cost</small><b>~ {estimate.toFixed(2)} credits</b></span><Info aria-label="Credits are reserved safely before synthesis and charged after success" /></div>
      {expensive && <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I authorize the displayed estimated usage.</label>}
      <button className={styles.generate} disabled={busy || !modelId || !text.trim() || (expensive && !confirmed)}><Sparkle weight="fill" />{busy ? "Synthesizing voice…" : "Generate Audio"}</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>

    <div className={styles.sideColumn}>
      <section className={styles.preview} aria-label="Audio preview"><div className={styles.previewHead}><span><i className={busy ? styles.live : ""} />Audio preview</span><small>{selectedModel?.name || "Choose a model"}</small></div><p>Listen to your generated audio, download, or make adjustments.</p>
        <div className={`${styles.waveArea} ${busy ? styles.isBusy : ""}`} aria-label={url ? "Generated audio waveform" : "Audio waveform placeholder"}><div className={styles.waveBars}>{Array.from({ length: 44 }, (_, index) => <i key={index} />)}</div>{busy && <span>Creating your audio preview…</span>}</div>
        <audio ref={audioRef} src={url} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
        <div className={styles.player}><button type="button" onClick={togglePlayback} disabled={!url || busy} aria-label={playing ? "Pause audio" : "Play audio"}>{playing ? <Pause weight="fill" /> : <Play weight="fill" />}</button><span>{secondsLabel(currentTime)}</span><input aria-label="Audio progress" type="range" min="0" max={duration || 1} step="0.1" value={Math.min(currentTime, duration || 0)} disabled={!url || busy} onChange={(event) => { const next = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = next; setCurrentTime(next); }} /><span>{secondsLabel(duration)}</span><SpeakerHigh /><input aria-label="Audio volume" type="range" min="0" max="1" step="0.05" value={volume} disabled={!url || busy} onChange={(event) => setVolume(Number(event.target.value))} /><a className={styles.iconAction} href={url} download="voiceover.mp3" aria-disabled={!url} tabIndex={url ? 0 : -1}><DownloadSimple /></a><button className={styles.iconAction} type="button" onClick={() => { if (url) { setUrl(undefined); setCurrentTime(0); setDuration(0); } }} disabled={!url} aria-label="Clear audio preview"><DotsThree /></button></div>
        <div className={styles.qualityStrip}><span className={styles.qualityIcon}><Waveform /></span><div><b>{url ? "Your voice, beautifully rendered." : "Your preview is ready when you are."}</b><p>{url ? "Crystal clear audio with natural intonation and emotion." : "Choose a model and voice, then write a script to create your audio."}</p></div><ul><li><CheckCircle weight="fill" /> Natural &amp; realistic voices</li><li><CheckCircle weight="fill" /> High quality audio</li><li><CheckCircle weight="fill" /> Commercial use readiness varies by model</li></ul></div>
      </section>
      <section className={styles.quick}><div className={styles.sectionHead}><span><UsersThree weight="fill" /><div><h2>Quick voices</h2><p>Popular voices to get you started.</p></div></span><button type="button" onClick={() => setShowVoices((value) => !value)}>{showVoices ? "Show less" : "View all voices"}</button></div><div className={styles.voiceList}>{visibleVoices.map((item) => <button type="button" key={item.value} className={`${styles.voiceCard} ${voice === item.value ? styles.voiceSelected : ""}`} onClick={() => setVoice(item.value)} aria-pressed={voice === item.value}><span className={styles.voicePlay}><Play weight="fill" /></span><span><b>{item.label.split(" · ")[0]}</b><small>{item.note}</small><em>{item.tone}</em></span></button>)}</div></section>
      <section className={styles.inspiration}><div className={styles.sectionHead}><span><Sparkle weight="fill" /><div><h2>Inspiration</h2><p>Try a template to get started quickly.</p></div></span><button type="button" onClick={() => { setText(templates[0].copy); setConfirmed(false); }}>View all templates</button></div><div className={styles.templateList}>{templates.map((item) => <button type="button" key={item.label} onClick={() => { setText(item.copy); setConfirmed(false); }}><span>{item.icon === "product" ? <Waveform /> : item.icon === "youtube" ? <Play weight="fill" /> : item.icon === "social" ? <SpeakerHigh /> : <Sparkle />}</span><b>{item.label}</b><small>{item.label === "Product explainer" ? "Showcase your product" : item.label === "YouTube narration" ? "Engaging long-form content" : item.label === "Social media" ? "Short and catchy" : "Calm and relaxing"}</small></button>)}</div></section>
    </div>
  </div>;
}


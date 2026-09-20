"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle, DownloadSimple, GearSix, Microphone, Play, Sparkle, UsersThree, Waveform } from "@phosphor-icons/react";
import { PremiumSelect } from "@/components/premium-select";
import styles from "@/components/audio-studio.module.css";

type AudioModel = { id: string; name: string; tier: string; description?: string; capabilities: string[]; retail?: { per1kCharsCredits?: number; flatCredits?: number } };

const voices = [
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Sarah · Reassuring female", note: "Reassuring female" },
  { value: "pNInz6obpgDQGcFmaJgB", label: "Adam · Deep male", note: "Deep male voice" },
  { value: "hpp4J3VqNfWAUOO0d1Us", label: "Bella · Bright female", note: "Friendly female" },
  { value: "JBFqnCBsd6RMkjVDRZzb", label: "George · British storyteller", note: "Narrator" }
];

const templates = [
  { label: "Product explainer", copy: "Welcome to All Model Hub. Create more, explore leading AI models, and bring your best ideas to life." },
  { label: "YouTube narration", copy: "Today, we are breaking down the five ideas that can make your next project stand out." },
  { label: "Social media", copy: "Stop scrolling. Your next great idea starts right here." }
];

export function TtsClient() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(voices[0].value);
  const [url, setUrl] = useState<string>();
  const [credits, setCredits] = useState<string>();
  const [models, setModels] = useState<AudioModel[]>([]);
  const [modelId, setModelId] = useState("eleven-tts-flash");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    fetch("/api/models").then((response) => response.json()).then((data) => {
      const list = (data.models || []).filter((item: AudioModel) => item.capabilities?.includes("tts"));
      setModels(list);
      const requested = new URLSearchParams(window.location.search).get("model");
      if (requested && list.some((item: AudioModel) => item.id === requested)) setModelId(requested);
    }).catch(() => setError("Speech models are unavailable right now."));
  }, []);

  const selectedModel = models.find((item) => item.id === modelId);
  const per1k = Number(selectedModel?.retail?.per1kCharsCredits || 0);
  const flat = Number(selectedModel?.retail?.flatCredits || 0);
  const estimate = useMemo(() => flat || per1k * Math.max(0.001, text.length / 1000), [flat, per1k, text.length]);
  const expensive = estimate >= 50;

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (expensive && !confirmed) { setError("Confirm the estimated cost before generating this voiceover."); return; }
    setBusy(true);
    setError("");
    if (url) URL.revokeObjectURL(url);
    try {
      const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), modelId, text, voiceId: voice, confirmedCost: confirmed || !expensive }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "TTS failed"); }
      const blob = await response.blob();
      setUrl(URL.createObjectURL(blob));
      setCredits(response.headers.get("x-amh-credits") || undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "TTS failed");
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.workspace}>
    <form className={styles.controls} onSubmit={submit}>
      <div className={styles.cardHead}><span className={styles.headIcon}><Microphone weight="fill" /></span><div><h2>Generate Speech</h2><p>Turn your script into natural, lifelike speech.</p></div><i>01</i></div>
      <label className={styles.field}><span>Speech model</span><PremiumSelect className={styles.select} value={modelId} onChange={(value) => { setModelId(value); setConfirmed(false); }} options={models.map((model) => ({ value: model.id, label: `${model.name} · ${model.tier}` }))} aria-label="Speech model" />{selectedModel?.description && <small>{selectedModel.description}</small>}</label>
      <label className={styles.field}><span>Script <small>{text.length.toLocaleString()} / 10,000</small></span><textarea value={text} onChange={(event) => { setText(event.target.value); setConfirmed(false); }} maxLength={10_000} required placeholder={"Write or paste your script here…\nE.g. a product explainer, narration, or any text you want to hear."} /></label>
      <label className={styles.field}><span>Voice</span><PremiumSelect className={styles.select} value={voice} onChange={setVoice} options={voices} aria-label="Voice" /></label>
      <div className={styles.advancedToggle}><button type="button" onClick={() => setAdvanced((current) => !current)}><GearSix />{advanced ? "Hide model details" : "Model details"}</button>{advanced && <div><b>Available capabilities</b><p>{selectedModel?.capabilities?.map((item) => item.replaceAll("-", " ")).join(" · ") || "Choose a model to view its capabilities."}</p><small>Only the selected model, script, and voice are sent with this request.</small></div>}</div>
      <div className={styles.costRow}><span className={styles.costIcon}><Waveform /></span><span><small>Estimated cost</small><b>~ {estimate.toFixed(2)} credits</b></span></div>
      {expensive && <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I authorize the displayed estimated usage.</label>}
      <button className={styles.generate} disabled={busy || !modelId || !text.trim() || (expensive && !confirmed)}><Sparkle weight="fill" />{busy ? "Generating speech…" : "Generate Audio"}</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>

    <div className={styles.sideColumn}>
      <section className={styles.preview} aria-label="Audio preview"><div className={styles.previewHead}><span><i className={busy ? styles.live : ""} />{url ? "Voice ready" : busy ? "Generating" : "Audio preview"}</span><small>{selectedModel?.name || "Choose a model"}</small></div><p>{url ? "Listen, download, or create another take." : "Your generated voice will appear here when it is ready."}</p>
        <div className={`${styles.waveArea} ${busy ? styles.isBusy : ""}`}><div className={styles.waveBars}>{Array.from({ length: 38 }, (_, index) => <i key={index} />)}</div>{busy && <span>Creating your voice…</span>}</div>
        {url ? <div className={styles.resultPlayer}><audio controls src={url} /><div><a className={styles.secondaryAction} href={url} download="voiceover.mp3"><DownloadSimple />Download</a><button className={styles.secondaryAction} type="button" onClick={() => setUrl(undefined)}><Play />New take</button></div><small>Ready · Charged {Number(credits || estimate).toFixed(2)} credits</small></div> : <div className={styles.emptyPreview}><span><Waveform weight="fill" /></span><h2>Your voice, beautifully rendered.</h2><p>Choose a model and voice, write your script, then preview the finished audio here.</p><small>MODEL → SCRIPT → VOICE → GENERATE</small></div>}
        <div className={styles.qualityStrip}><span className={styles.qualityIcon}><CheckCircle weight="fill" /></span><div><b>Focused, provider-aware generation.</b><p>Only settings supported by the selected speech workflow are shown.</p></div></div>
      </section>
      <section className={styles.quick}><div className={styles.sectionHead}><span><UsersThree weight="fill" /><div><h2>Quick voices</h2><p>Popular voices to get you started.</p></div></span></div><div className={styles.voiceList}>{voices.map((item) => <button type="button" key={item.value} className={`${styles.voiceCard} ${voice === item.value ? styles.voiceSelected : ""}`} onClick={() => setVoice(item.value)} aria-pressed={voice === item.value}><span className={styles.voicePlay}><Play weight="fill" /></span><span><b>{item.label.split(" · ")[0]}</b><small>{item.note}</small></span></button>)}</div></section>
      <section className={styles.inspiration}><div className={styles.sectionHead}><span><Sparkle weight="fill" /><div><h2>Script starters</h2><p>Give your voiceover a useful first draft.</p></div></span></div><div className={styles.templateList}>{templates.map((item) => <button type="button" key={item.label} onClick={() => { setText(item.copy); setConfirmed(false); }}><span><Waveform /></span><b>{item.label}</b><small>Use this starter</small></button>)}</div></section>
    </div>
  </div>;
}

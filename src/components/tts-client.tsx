"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DownloadSimple, GearSix, Microphone, Play, Sparkle, UsersThree, Waveform } from "@phosphor-icons/react";
import { PremiumSelect } from "@/components/premium-select";
import styles from "@/components/audio-studio.module.css";
import { AudioStage } from "@/components/audio-stage";
import { SpeechScriptEditor } from "@/components/speech-script-editor";
import { isMinimaxSpeech, minimaxVoices } from "@/lib/audio-execution";
import { modelAvailabilityMessage } from "@/lib/model-availability-message";

type AudioModel = { id: string; name: string; tier: string; description?: string; capabilities: string[]; available?: boolean; availabilityReason?: string | null; retail?: { per1kCharsCredits?: number; flatCredits?: number } };

const elevenVoices = [
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Sarah · Reassuring female", note: "Reassuring female" },
  { value: "pNInz6obpgDQGcFmaJgB", label: "Adam · Deep male", note: "Deep male voice" },
  { value: "hpp4J3VqNfWAUOO0d1Us", label: "Bella · Bright female", note: "Friendly female" },
  { value: "JBFqnCBsd6RMkjVDRZzb", label: "George · British storyteller", note: "Narrator" }
];
const klingVoices = [
  { value: "genshin_vindi2", label: "Vindi · Kling preset", note: "Kling multilingual voice" },
];
const modelLoadingError = "Speech models are unavailable right now.";

const templates = [
  { label: "Product explainer", copy: "Welcome to Models Suite. Create more, explore leading AI models, and bring your best ideas to life." },
  { label: "YouTube narration", copy: "Today, we are breaking down the five ideas that can make your next project stand out." },
  { label: "Social media", copy: "Stop scrolling. Your next great idea starts right here." }
];

function useTtsClient() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(elevenVoices[0].value);
  const [languageCode, setLanguageCode] = useState("en");
  const [voiceSpeed, setVoiceSpeed] = useState("1");
  const [url, setUrl] = useState<string>();
  const [credits, setCredits] = useState<string>();
  const [models, setModels] = useState<AudioModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => fetch("/api/models", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Models unavailable");
      return response.json();
    }).then((data) => {
      if (!active) return;
      setError((current) => current === modelLoadingError ? "" : current);
      const list = (data.models || []).filter((item: AudioModel) => item.capabilities?.includes("tts"));
      setModels(list);
      const executable = list.filter((item: AudioModel) => item.available !== false);
      const requested = new URLSearchParams(window.location.search).get("model");
      setModelId((current) => executable.some((item: AudioModel) => item.id === current) ? current
        : requested && executable.some((item: AudioModel) => item.id === requested) ? requested : executable[0]?.id || "");
    }).catch(() => { if (active) setError(modelLoadingError); });
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, []);

  const selectedModel = models.find((item) => item.id === modelId);
  const asyncKling = selectedModel?.id === "kling-tts";
  const asyncMinimax = isMinimaxSpeech(modelId);
  const asyncSpeech = asyncKling || asyncMinimax;
  const scriptLimit = asyncKling ? 1_000 : 10_000;
  const voices = asyncMinimax ? minimaxVoices : asyncKling ? klingVoices : elevenVoices;
  const selectedVoice = voices.some((item) => item.value === voice) ? voice : voices[0].value;
  const per1k = Number(selectedModel?.retail?.per1kCharsCredits || 0);
  const flat = Number(selectedModel?.retail?.flatCredits || 0);
  // Match estimateMediaCredits() in the TTS route while keeping an empty
  // composer at zero: no script means there is no generation to charge for.
  const estimate = useMemo(() => {
    const textLength = Array.from(text).length;
    if (!text.trim()) return 0;
    return Math.max(0.05, flat + per1k * Math.max(0.001, textLength / 1000));
  }, [flat, per1k, text]);
  const expensive = estimate >= 50;

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function pollAsyncJob(id: string) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const response = await fetch(`/api/jobs/${id}`);
      if (!response.ok) continue;
      const data = await response.json();
      const job = data.job;
      if (job?.status === "completed" && job.result_urls?.[0]) {
        setUrl(job.result_urls[0]);
        setCredits(job.charged_credits == null ? undefined : String(job.charged_credits));
        return;
      }
      if (["failed", "cancelled", "expired"].includes(job?.status)) throw new Error(job.error_message || "Speech generation failed.");
    }
    throw new Error("Speech is still processing. Follow it in the Generation Center.");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (expensive && !confirmed) { setError("Confirm the estimated cost before generating this voiceover."); return; }
    setBusy(true);
    setError("");
    if (url) URL.revokeObjectURL(url);
    try {
      const response = await fetch(asyncSpeech ? "/api/generations/audio" : "/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(asyncSpeech
        ? { requestId: crypto.randomUUID(), modelId, prompt: text, voiceId: selectedVoice,
          ...(asyncKling ? { languageCode, voiceSpeed: Number(voiceSpeed) } : {}), confirmedCost: confirmed || !expensive }
        : { requestId: crypto.randomUUID(), modelId, text, voiceId: selectedVoice, confirmedCost: confirmed || !expensive }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "TTS failed"); }
      if (asyncSpeech) {
        const data = await response.json();
        if (!data.job?.id) throw new Error("Provider did not return a trackable speech task.");
        await pollAsyncJob(data.job.id);
      } else {
        const blob = await response.blob();
        setUrl(URL.createObjectURL(blob));
        const finalCredits = response.headers.get("x-amh-credits") || undefined;
        setCredits(finalCredits);
        const quoteId = response.headers.get("x-amh-billing-quote-id");
        if (!finalCredits && quoteId) {
          for (let attempt = 0; attempt < 6; attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 1_000));
            const settlement = await fetch("/api/billing/settle-pending", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId }) });
            if (!settlement.ok) continue;
            const result = await settlement.json().catch(() => ({}));
            if (result.billingStatus === "settled" && result.chargeCredits != null) { setCredits(String(result.chargeCredits)); break; }
          }
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "TTS failed");
    } finally {
      setBusy(false);
    }
  }

  return {text,setText,setVoice,languageCode,setLanguageCode,voiceSpeed,setVoiceSpeed,url,setUrl,credits,models,modelId,setModelId,confirmed,setConfirmed,busy,error,advanced,setAdvanced,selectedModel,asyncKling,scriptLimit,voices,selectedVoice,estimate,expensive,submit};
}
export function TtsClient() {return <TtsView {...useTtsClient()}/>;}
export type TtsViewProps=ReturnType<typeof useTtsClient>;
export function TtsView({text,setText,setVoice,languageCode,setLanguageCode,voiceSpeed,setVoiceSpeed,url,setUrl,credits,models,modelId,setModelId,confirmed,setConfirmed,busy,error,advanced,setAdvanced,selectedModel,asyncKling,scriptLimit,voices,selectedVoice,estimate,expensive,submit}:TtsViewProps) {
return <div className={styles.workspace}>
    <form className={styles.controls} onSubmit={submit}>
      <div className={styles.cardHead}><span className={styles.headIcon}><Microphone weight="fill" /></span><div><h2>Bring your words to life</h2><p>A voice for every story.</p></div></div>
      <label className={styles.field}><span>Speech model</span><PremiumSelect className={styles.select} value={modelId} onChange={(value) => { setModelId(value); setVoice(isMinimaxSpeech(value) ? minimaxVoices[0].value : value === "kling-tts" ? klingVoices[0]?.value ?? "" : elevenVoices[0]?.value ?? ""); setConfirmed(false); }} options={models.map((model) => ({ value: model.id, label: `${model.name} · ${model.tier}${model.available === false ? ` · ${modelAvailabilityMessage(model.availabilityReason)}` : ""}`, disabled: model.available === false }))} aria-label="Speech model" /></label>
      <SpeechScriptEditor value={text} onChange={value => { setText(value); setConfirmed(false); }} limit={scriptLimit} busy={busy} />
      <div className={styles.settingsGrid}>
      <label className={styles.field}><span>Voice</span><PremiumSelect className={styles.select} value={selectedVoice} onChange={setVoice} options={[...voices]} aria-label="Voice" /></label>
      {asyncKling && <><label className={styles.field}><span>Language</span><PremiumSelect className={styles.select} value={languageCode} onChange={setLanguageCode} options={[{ value: "en", label: "English" }, { value: "zh", label: "Chinese" }]} aria-label="Language" /></label><label className={styles.field}><span>Speed</span><PremiumSelect className={styles.select} value={voiceSpeed} onChange={setVoiceSpeed} options={[{ value: "0.8", label: "0.8×" }, { value: "1", label: "1.0×" }, { value: "1.2", label: "1.2×" }, { value: "1.5", label: "1.5×" }, { value: "2", label: "2.0×" }]} aria-label="Voice speed" /></label></>}
      </div>
      <div className={styles.advancedToggle}><button type="button" aria-expanded={advanced} onClick={() => setAdvanced((current) => !current)}><GearSix />{advanced ? "Hide model details" : "Model details"}</button>{advanced && <div><p>{selectedModel?.description}</p><p>{selectedModel?.capabilities?.map((item) => item.replaceAll("-", " ")).join(" · ") || "Choose a model to view its capabilities."}</p></div>}</div>
      {text.trim() && <div className={styles.costRow}><span className={styles.costIcon}><Waveform /></span><span><small>Estimated usage</small><b>~ {estimate.toFixed(2)} credits</b></span></div>}
      {expensive && <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I authorize the displayed estimated usage.</label>}
      <button className={styles.generate} disabled={busy || !modelId || !text.trim() || (expensive && !confirmed)}><Sparkle weight="fill" />{busy ? "Generating speech…" : "Generate Speech"}<span aria-hidden="true">→</span></button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>

    <div className={styles.sideColumn}>
      <section className={styles.preview} aria-label="Audio preview"><div className={styles.previewHead}><span><i className={busy ? styles.live : ""} />{url ? "Voice ready" : busy ? "Generating" : "Audio preview"}</span><small>{selectedModel?.name || "Choose a model"}</small></div><p>{url ? "Listen, download, or create another take." : "Your generated voice will appear here when it is ready."}</p>
        <AudioStage mode="speech" busy={busy}/>
        {url ? <div className={styles.resultPlayer}><audio controls preload="metadata" aria-label="Generated speech playback" src={url} /><div><a className={styles.secondaryAction} href={url} download="voiceover.mp3"><DownloadSimple />Download</a><button className={styles.secondaryAction} type="button" onClick={() => setUrl(undefined)}><Play />New take</button></div><small>{credits ? `Ready · Charged ${Number(credits).toFixed(2)} credits` : "Ready · Billing pending"}</small></div> : <div className={styles.emptyPreview}><h2>{busy ? "Finding your voice…" : "Ready when you are."}</h2><p>{busy ? "Your speech is being generated." : "Your finished voiceover will play here."}</p></div>}
      </section>
      <section className={styles.quick}><div className={styles.sectionHead}><span><UsersThree weight="fill" /><div><h2>Voice palette</h2></div></span></div><div className={styles.voiceList}>{voices.map((item) => <button type="button" key={item.value} aria-label={`Select ${item.label.split(" · ")[0]} voice`} className={`${styles.voiceCard} ${selectedVoice === item.value ? styles.voiceSelected : ""}`} onClick={() => setVoice(item.value)} aria-pressed={selectedVoice === item.value}><span className={styles.voicePlay}><Microphone weight="fill" /></span><span><b>{item.label.split(" · ")[0]}</b><small>{item.note}</small></span></button>)}</div></section>
      <section className={styles.inspiration}><div className={styles.sectionHead}><span><Sparkle weight="fill" /><div><h2>Script starters</h2><p>Give your voiceover a useful first draft.</p></div></span></div><div className={styles.templateList}>{templates.map((item) => <button type="button" key={item.label} onClick={() => { setText(item.copy); setConfirmed(false); }}><span><Waveform /></span><b>{item.label}</b><small>Use this starter</small></button>)}</div></section>
    </div>
  </div>;
}

"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PremiumSelect } from "@/components/premium-select";
import { ArrowClockwise, DownloadSimple, Waveform } from "@phosphor-icons/react";

type AudioModel = { id: string; name: string; tier: string; capabilities: string[]; retail?: { per1kCharsCredits?: number; flatCredits?: number } };

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
  useEffect(() => { fetch("/api/models").then((r) => r.json()).then((data) => { const list = (data.models || []).filter((item: AudioModel) => item.capabilities?.includes("tts")); setModels(list); const requested = new URLSearchParams(window.location.search).get("model"); if (requested && list.some((item: AudioModel) => item.id === requested)) setModelId(requested); }).catch(() => undefined); }, []);
  const selectedModel = models.find((item) => item.id === modelId);
  const per1k = Number(selectedModel?.retail?.per1kCharsCredits || 0);
  const flat = Number(selectedModel?.retail?.flatCredits || 0);
  const estimate = useMemo(() => flat || per1k * Math.max(0.001, text.length / 1000), [flat, per1k, text.length]);
  const expensive = estimate >= 50;


  async function submit(event: FormEvent) {
    event.preventDefault();
    if (expensive && !confirmed) { setError("Confirm the estimated cost before generating this voiceover."); return; }
    setBusy(true); setError("");
    if (url) URL.revokeObjectURL(url);
    const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), modelId, text, voiceId: voice, confirmedCost: confirmed || !expensive }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || "TTS failed"); setBusy(false); return; }
    const blob = await response.blob(); setUrl(URL.createObjectURL(blob)); setCredits(response.headers.get("x-amh-credits") || undefined); setBusy(false);
  }

  return <div className="studio-layout tts-workspace"><form className="card studio-panel tts-controls" onSubmit={submit}><div className="studio-control-head"><span><small>Speech setup</small><strong>Direct your voiceover</strong></span><i>01</i></div><label className="label">AI speech model<PremiumSelect value={modelId} onChange={setModelId} options={models.map((model) => ({ value: model.id, label: `${model.name} · ${model.tier}` }))} /></label><label className="label">Script <span className="field-counter">{text.length.toLocaleString()} / 10,000</span><textarea className="textarea" value={text} onChange={(event) => { setText(event.target.value); setConfirmed(false); }} maxLength={10000} required placeholder="Write or paste your voiceover…" /></label><label className="label">Voice<PremiumSelect value={voice} onChange={setVoice} options={[{value:"EXAVITQu4vr4xnSDxMaL",label:"Sarah · Reassuring female"},{value:"hpp4J3VqNfWAUOO0d1Us",label:"Bella · Bright female"},{value:"pNInz6obpgDQGcFmaJgB",label:"Adam · Deep male"},{value:"JBFqnCBsd6RMkjVDRZzb",label:"George · British storyteller"},{value:"onwK4e9ZLuTAKqWW03F9",label:"Daniel · Broadcaster"}]} /></label><div className="confirm-box"><span>Estimated usage</span><b>{estimate.toFixed(2)} Credits</b><small>Reserved safely before synthesis; final charge follows success.</small></div>{expensive && <label className="check-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I authorize the displayed estimated usage.</label>}<button className="btn btn-primary media-submit" disabled={busy || !modelId || !text.trim() || (expensive && !confirmed)}><Waveform size={16} weight="bold"/>{busy ? "Synthesizing voice…" : "Generate voice"}</button>{error && <div className="soft-card small" style={{ padding: 12, color: "var(--danger)" }}>{error}</div>}</form><section className="card studio-panel studio-result tts-stage"><div className="studio-stage-label"><span className={busy?"live":""}/><b>{url?"Voice ready":busy?"Synthesizing":"Audio preview"}</b><small>{selectedModel?.name || "Choose a speech model"}</small></div>{busy?<div className="audio-processing"><div className="waveform-orbit"><i/><i/><i/><i/><i/><i/><i/></div><h3>Shaping your voiceover</h3><p>Generating natural pacing, tone and clarity.</p></div>:url ? <div className="tts-output"><div className="audio-art"><Waveform size={42} weight="duotone"/></div><audio controls src={url} /><div className="result-meta">Ready · {credits ? `${Number(credits).toFixed(2)} Credits charged` : "Voice generated"}</div><div className="generation-actions"><a className="btn btn-primary" href={url} download="voiceover.mp3"><DownloadSimple/>Download</a><button className="btn" type="button" onClick={()=>setUrl(undefined)}><ArrowClockwise/>New voice</button></div></div> : <div className="studio-empty"><div className="studio-empty-glyph"><Waveform weight="duotone"/></div><h2>Your voice, beautifully rendered.</h2><p>Choose a speech model and voice, write a script, then preview the finished audio here.</p><span>Model → Script → Voice → Generate</span></div>}</section></div>;
}


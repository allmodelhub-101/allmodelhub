"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";

type AudioModel = { id: string; retail?: { per1kCharsCredits?: number } };

export function TtsClient() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("EXAVITQu4vr4xnSDxMaL");
  const [url, setUrl] = useState<string>();
  const [credits, setCredits] = useState<string>();
  const [per1k, setPer1k] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/models").then((r) => r.json()).then((data) => { const model = (data.models || []).find((item: AudioModel) => item.id === "eleven-tts-flash"); setPer1k(Number(model?.retail?.per1kCharsCredits || 0)); }).catch(() => undefined); }, []);
  const estimate = useMemo(() => per1k * Math.max(0.001, text.length / 1000), [per1k, text.length]);
  const expensive = estimate >= 50;


  async function submit(event: FormEvent) {
    event.preventDefault();
    if (expensive && !confirmed) { setError("Confirm the estimated cost before generating this voiceover."); return; }
    setBusy(true); setError("");
    if (url) URL.revokeObjectURL(url);
    const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), text, voiceId: voice, confirmedCost: confirmed || !expensive }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || "TTS failed"); setBusy(false); return; }
    const blob = await response.blob(); setUrl(URL.createObjectURL(blob)); setCredits(response.headers.get("x-amh-credits") || undefined); setBusy(false);
  }

  return <div className="studio-layout"><form className="card studio-panel" onSubmit={submit} style={{ display: "grid", gap: 14 }}><div className="kicker">Text to speech</div><h2 style={{ margin: 0 }}>Eleven Flash Voice</h2><label className="label">Text<textarea className="textarea" value={text} onChange={(event) => { setText(event.target.value); setConfirmed(false); }} maxLength={10000} required placeholder="Write your voiceover…" /></label><label className="label">Voice<select className="select" value={voice} onChange={(event) => setVoice(event.target.value)}><option value="EXAVITQu4vr4xnSDxMaL">Sarah · Reassuring female</option><option value="hpp4J3VqNfWAUOO0d1Us">Bella · Bright female</option><option value="pNInz6obpgDQGcFmaJgB">Adam · Deep male</option><option value="JBFqnCBsd6RMkjVDRZzb">George · British storyteller</option><option value="onwK4e9ZLuTAKqWW03F9">Daniel · Broadcaster</option></select></label><div className="confirm-box">Estimated usage: <b>{estimate.toFixed(2)} Credits</b>. The wallet reserves usage before synthesis and captures the final charge after a successful provider response.</div>{expensive && <label className="check-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I understand this voice generation may cost about {estimate.toFixed(2)} Credits.</label>}<button className="btn btn-primary" disabled={busy || !text.trim() || (expensive && !confirmed)}>{busy ? "Generating voice…" : "Generate voice"}</button>{error && <div className="soft-card small" style={{ padding: 12, color: "var(--danger)" }}>{error}</div>}</form><section className="card studio-panel studio-result">{url ? <div><audio controls src={url} /><div className="muted small" style={{ marginTop: 12 }}>{credits ? `${Number(credits).toFixed(2)} Credits charged` : "Voice ready"}</div></div> : <div><div style={{ fontSize: 50 }}>◖))</div><h3>Your voiceover will appear here</h3></div>}</section></div>;
}

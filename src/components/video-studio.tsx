"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowClockwise, DownloadSimple, FileImage, FilmSlate, LinkSimple, Sparkle, VideoCamera } from "@phosphor-icons/react";
import { PremiumSelect } from "@/components/premium-select";
import styles from "@/components/video-studio-v2.module.css";

type Schema = { aspectRatios?: string[]; durationOptions?: number[]; resolutionOptions?: string[]; maxReferences?: number; nativeAudio?: boolean };
type VideoModel = { id: string; name: string; tier: string; modality: string; description: string; capabilities: string[]; retail: { flatCredits?: number; perSecondCredits?: number }; uiSchema?: Schema };
type Job = { id?: string; public_id?: string; status?: string; result_urls?: string[]; error_message?: string; charged_credits?: number; estimated_credits?: number };

const starters = [
  { label: "Cinematic", prompt: "Cinematic mountain lake at sunrise, slow camera push-in, soft atmospheric light, detailed natural movement." },
  { label: "Product", prompt: "Premium product reveal, sculpted studio light, slow orbiting camera, precise material detail." },
  { label: "Portrait", prompt: "Expressive portrait with subtle natural movement, shallow depth of field, gentle handheld camera motion." },
  { label: "Nature", prompt: "Waterfall in a lush forest after rain, drifting mist, cinematic wide shot and gentle camera glide." },
  { label: "Sci-Fi", prompt: "Futuristic city at blue hour, reflections on wet streets, aerial camera motion, elegant cinematic atmosphere." },
  { label: "Vlog", prompt: "A warm travel vlog moment in a lively market, natural handheld movement, candid detail and daylight." }
];

export function VideoStudio() {
  const [models, setModels] = useState<VideoModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [aspect, setAspect] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [references, setReferences] = useState<string[]>([]);
  const [mode, setMode] = useState<"text" | "image">("text");
  const [projectId, setProjectId] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [copied, setCopied] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/models").then((response) => response.json()).then((data) => {
      const list = (data.models || []).filter((item: VideoModel) => item.modality === "video" && !["flashvsr"].includes(item.id));
      setModels(list); setModelId((current) => current || list[0]?.id || "");
    }).catch(() => setError("Video models are unavailable right now."));
  }, []);
  useEffect(() => { const sync = () => setProjectId(localStorage.getItem("amh-active-project") || ""); sync(); window.addEventListener("amh-project-change", sync); return () => window.removeEventListener("amh-project-change", sync); }, []);

  const model = models.find((item) => item.id === modelId);
  const schema = model?.uiSchema || {};
  const durations = schema.durationOptions?.length ? schema.durationOptions : [5, 8, 10, 15];
  const aspects = schema.aspectRatios?.length ? schema.aspectRatios : ["16:9", "9:16", "1:1", "4:3"];
  const resolutions = schema.resolutionOptions?.length ? schema.resolutionOptions : ["720p"];
  const maxReferences = Math.max(0, schema.maxReferences ?? (model?.capabilities.includes("image-to-video") ? 1 : 0));
  const effectiveDuration = durations.includes(duration) ? duration : durations[0] || 5;
  const effectiveAspect = aspects.includes(aspect) ? aspect : aspects[0] || "16:9";
  const effectiveResolution = resolutions.includes(resolution) ? resolution : resolutions[0] || "";
  const estimate = Number(model?.retail.flatCredits || (model?.retail.perSecondCredits || 0) * effectiveDuration);
  const resultUrl = job?.result_urls?.[0];
  const failed = Boolean(job && ["failed", "cancelled", "expired"].includes(job.status || ""));
  const generating = Boolean(job && !failed && job.status !== "completed");

  function selectModel(nextId: string) {
    const next = models.find((item) => item.id === nextId);
    const nextSchema = next?.uiSchema || {};
    const nextDurations = nextSchema.durationOptions?.length ? nextSchema.durationOptions : [5, 8, 10, 15];
    const nextAspects = nextSchema.aspectRatios?.length ? nextSchema.aspectRatios : ["16:9", "9:16", "1:1", "4:3"];
    const nextResolutions = nextSchema.resolutionOptions?.length ? nextSchema.resolutionOptions : ["720p"];
    const nextMaxReferences = Math.max(0, nextSchema.maxReferences ?? (next?.capabilities.includes("image-to-video") ? 1 : 0));
    setModelId(nextId);
    setDuration((value) => nextDurations.includes(value) ? value : nextDurations[0] || 5);
    setAspect((value) => nextAspects.includes(value) ? value : nextAspects[0] || "16:9");
    setResolution((value) => nextResolutions.includes(value) ? value : nextResolutions[0] || "");
    setReferences((value) => value.slice(0, nextMaxReferences));
    if (!nextMaxReferences) setMode("text");
    setConfirmed(false);
  }

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) { setError("Starting frames must be images."); return; }
    if (!maxReferences) { setError(`${model?.name || "This model"} does not support image-to-video.`); return; }
    setUploading(true); setError("");
    try { const form = new FormData(); form.set("file", file); const response = await fetch("/api/files", { method: "POST", body: form }); const data = await response.json(); if (!response.ok || !data.file?.id) throw new Error(data.error || "Reference upload failed."); setReferences((value) => [...value, data.file.id].slice(0, maxReferences)); setMode("image"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Reference upload failed."); }
    finally { setUploading(false); }
  }
  async function poll(id: string) { for (let attempt = 0; attempt < 120; attempt += 1) { await new Promise((resolve) => setTimeout(resolve, 7000)); const response = await fetch(`/api/jobs/${id}`); if (!response.ok) continue; const data = await response.json(); if (data.job) { setJob(data.job); if (["completed", "failed", "cancelled", "expired"].includes(data.job.status)) return; } } setError("This generation is still running. Follow it in the Generation Center."); }
  async function submit(event: FormEvent) { event.preventDefault(); if (!confirmed) { setError("Confirm the estimated maximum cost before generating."); return; } setBusy(true); setError(""); setJob(null); try { const response = await fetch("/api/generations/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), projectId: projectId || undefined, modelId, prompt, duration: effectiveDuration, resolution: effectiveResolution, aspectRatio: effectiveAspect, imageFileIds: references, confirmedCost: true }) }); const data = await response.json(); if (!response.ok || !data.job) throw new Error(data.error || "Generation request failed."); setJob(data.job); void poll(data.job.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Generation request failed."); } finally { setBusy(false); } }
  function chooseMode(next: "text" | "image") { setMode(next); if (next === "text") setReferences([]); else uploadRef.current?.click(); }
  function applyStarter(starter: typeof starters[number]) { setPrompt(starter.prompt); }

  return <main className={styles.page}>
    <header className={styles.hero}><div className={styles.heroIdentity}><span className={styles.heroIcon}><VideoCamera weight="fill" /></span><div><small>Video Studio</small><h1>Create cinematic <em>videos</em></h1><p>Turn your ideas into stunning videos with state-of-the-art AI models.</p></div></div><ol className={styles.steps}><li className={styles.current}><b>1</b><span>Set up<small>Configure your video</small></span></li><li><b>2</b><span>Generate<small>AI creates your video</small></span></li><li><b>3</b><span>Download<small>Preview & export</small></span></li></ol></header>
    <div className={styles.workspace}>
      <form className={styles.setup} onSubmit={submit}><div className={styles.cardHead}><span><b>1</b><div><small>Video setup</small><h2>Configure your video</h2><p>Choose a model, describe your idea, and set the options.</p></div></span><i>01</i></div>
        <label className={styles.field}>Video model<PremiumSelect value={modelId} onChange={selectModel} options={models.map((item) => ({ value: item.id, label: `${item.name} · ${item.tier}` }))} /><small>{model?.description || "Choose the best model for your vision."}</small></label>
        <label className={styles.field}>Prompt<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the video you want to create…" maxLength={20_000} required /><small>{prompt.length.toLocaleString()} / 20,000</small></label>
        <div className={styles.chips}>{starters.slice(0, 4).map((starter) => <button type="button" key={starter.label} onClick={() => applyStarter(starter)}>{starter.label}</button>)}</div>
        {maxReferences > 0 && <label className={`${styles.field} ${styles.upload}`}>Starting frame <small>Optional image to animate</small><input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || references.length >= maxReferences} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /><span><FileImage />{uploading ? "Uploading image…" : references.length ? `${references.length} reference image ready` : "Upload an image"}</span></label>}
        <div className={styles.primaryControls}><label className={styles.field}>Duration<PremiumSelect value={String(effectiveDuration)} onChange={(value) => { setDuration(Number(value)); setConfirmed(false); }} options={durations.map((value) => ({ value: String(value), label: `${value} seconds` }))} /></label><label className={styles.field}>Aspect ratio<PremiumSelect value={effectiveAspect} onChange={setAspect} options={aspects.map((value) => ({ value, label: value }))} /></label></div>
        <details className={styles.advanced} open={advanced} onToggle={(event) => setAdvanced(event.currentTarget.open)}><summary>Advanced settings <span>{advanced ? "Hide" : "Customize"}</span></summary><div>{resolutions.length > 0 && <label className={styles.field}>Resolution<PremiumSelect value={effectiveResolution} onChange={setResolution} options={resolutions.map((value) => ({ value, label: value }))} /></label>}{schema.nativeAudio && <p>Native audio is supported by this model.</p>}</div></details>
        <div className={styles.cost}><span>Estimated cost <b>~ {estimate.toFixed(2)} credits</b><small>{effectiveDuration}s · {model?.name || "Video model"}</small></span>{projectId && <em>Project connected</em>}</div><label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I understand this is a higher-cost generation and authorize the displayed estimate.</label><button className={styles.generate} disabled={busy || !modelId || !prompt.trim() || !confirmed}><Sparkle weight="fill" />{busy ? "Submitting…" : "Generate Video"}</button>{error && <p className={styles.error}>{error}</p>}
      </form>
      <section className={styles.preview}><div className={styles.modeTabs} role="tablist"><button type="button" role="tab" aria-selected={mode === "text"} className={mode === "text" ? styles.active : ""} onClick={() => chooseMode("text")}>Text to Video</button><button type="button" role="tab" aria-selected={mode === "image"} className={mode === "image" ? styles.active : ""} disabled={!maxReferences} onClick={() => chooseMode("image")}>Image to Video</button></div><div className={styles.previewHead}><span><i className={generating ? styles.live : ""} />{job?.status === "completed" ? "Result ready" : generating ? "Generating" : "Preview"}</span><small>{model?.name || "Choose a model"}</small></div>
        {!job && <div className={styles.empty}><span><FilmSlate weight="fill" /></span><h2>{mode === "image" ? "Bring your frame to life." : "Your video will appear here."}</h2><p>{mode === "image" ? "Upload a starting frame, describe its movement, and generate when you are ready." : "Choose a model, describe a scene, then preview the finished video here."}</p><b>MODEL → PROMPT → GENERATE</b></div>}
        {generating && <div className={styles.status}><Sparkle weight="fill" /><h2>{job?.status === "queued" ? "Your video is queued." : "Creating your video."}</h2><p>The selected model is processing your request. You can safely keep working.</p></div>}
        {failed && <div className={styles.status}><h2>Generation could not complete.</h2><p>{job?.error_message || "Eligible reserved credits are released automatically."}</p><button type="button" onClick={() => { setJob(null); setError(""); }}>Try again</button></div>}
        {job?.status === "completed" && <div className={styles.result}>{resultUrl ? <video controls playsInline src={resultUrl} /> : <p>Generation completed. Open the result from your Library.</p>}{resultUrl && <div><a href={resultUrl} download><DownloadSimple />Download</a><button type="button" onClick={() => { navigator.clipboard?.writeText(resultUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); }}><LinkSimple />{copied ? "Copied" : "Copy link"}</button><button type="button" onClick={() => setJob(null)}><ArrowClockwise />Variation</button></div>}</div>}
        <section className={styles.inspiration}><header><div><h2>Get inspired</h2><p>Start with a polished direction, then make it your own.</p></div></header><div className={styles.templateGrid}>{starters.map((starter) => <button type="button" key={starter.label} onClick={() => applyStarter(starter)}><span>{starter.label.slice(0, 1)}</span><b>{starter.label}</b><small>Use prompt</small></button>)}</div></section>
      </section>
    </div>
  </main>;
}

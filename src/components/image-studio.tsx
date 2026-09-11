"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ModelPicker, PickerModel } from "@/components/model-picker";

type ImageModel = PickerModel & { modality: string; description?: string; capabilities?: string[] };
type ReferenceAsset = { id: string; name: string; previewUrl: string; size: number };
type ImageJob = {
  id?: string;
  status?: string;
  result_urls?: string[];
  public_id?: string;
  error_message?: string;
  charged_credits?: number;
  estimated_credits?: number;
};

const fallbackAspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const promptStarters = [
  "Editorial product photograph with sculpted studio light",
  "Cinematic landscape at blue hour with atmospheric depth",
  "Expressive character portrait with natural skin texture"
];

function statusCopy(status?: string) {
  if (status === "queued") return { step: "Queued", title: "Your request is in line" };
  if (status === "submitted") return { step: "Starting model", title: "The provider accepted your request" };
  if (status === "settling") return { step: "Processing", title: "Securing your finished image" };
  return { step: "Generating", title: "Creating your image" };
}

export function ImageStudio() {
  const qs = useSearchParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollTokenRef = useRef(0);
  const referenceUrlsRef = useRef<string[]>([]);
  const [models, setModels] = useState<ImageModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState(qs.get("prompt") || "");
  const [aspect, setAspect] = useState("1:1");
  const [references, setReferences] = useState<ReferenceAsset[]>([]);
  const [job, setJob] = useState<ImageJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [copied, setCopied] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [availableCredits, setAvailableCredits] = useState<number | null>(null);
  const [resultReferenceId, setResultReferenceId] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/models").then((response) => response.json()), fetch("/api/wallet").then((response) => response.json())])
      .then(([modelData, walletData]) => {
        const list = (modelData.models || []).filter((model: ImageModel) => model.modality === "image");
        setModels(list);
        const requested = qs.get("model");
        const chosen = requested && list.some((model: ImageModel) => model.id === requested) ? requested : list[0]?.id;
        if (chosen) setModelId(chosen);
        if (walletData.wallet) setAvailableCredits(Number(walletData.wallet.available));
      }).catch(() => setError("Could not load the Image workspace."));
  }, [qs]);

  useEffect(() => () => {
    pollTokenRef.current += 1;
    referenceUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const model = useMemo(() => models.find((item) => item.id === modelId), [modelId, models]);
  const aspectRatios = model?.uiSchema?.aspectRatios?.length ? model.uiSchema.aspectRatios : fallbackAspectRatios;
  const maxReferences = Math.max(0, model?.uiSchema?.maxReferences ?? (model?.capabilities?.includes("multi-reference") ? 10 : model?.capabilities?.includes("editing") ? 1 : 0));
  const estimate = Number(model?.retail?.flatCredits || 0);
  const expensive = estimate >= 50;
  const supportsEditing = maxReferences > 0 && (model?.uiSchema?.inputModes?.includes("image") ?? model?.capabilities?.includes("editing") ?? false);
  const supportsMultipleReferences = maxReferences > 1;
  const generating = Boolean(job && !["completed", "failed", "cancelled", "expired"].includes(job.status || ""));
  const resultUrl = Array.isArray(job?.result_urls) ? job.result_urls[0] : undefined;
  const status = statusCopy(job?.status);

  useEffect(() => {
    if (!aspectRatios.includes(aspect)) setAspect(aspectRatios[0] || "1:1");
    setReferences((current) => {
      current.slice(maxReferences).forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return current.slice(0, maxReferences);
    });
  }, [modelId]);

  async function uploadReference(file: File) {
    setUploading(true); setError("");
    try {
      if (!file.type.startsWith("image/")) throw new Error("Reference files must be PNG, JPEG, or WebP images.");
      if (!supportsEditing || maxReferences < 1) throw new Error(`${model?.name || "This model"} does not support reference-image editing.`);
      if (file.size > 50 * 1024 * 1024) throw new Error("Reference images must be smaller than 50 MB.");
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/files", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.file?.id) throw new Error(data.error || "Reference upload failed.");
      const previewUrl = URL.createObjectURL(file);
      referenceUrlsRef.current.push(previewUrl);
      const asset = { id: data.file.id as string, name: file.name, previewUrl, size: file.size };
      setReferences((current) => {
        const limit = maxReferences;
        current.slice(limit - 1).forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return [...current.slice(0, limit - 1), asset];
      });
      return data.file.id as string;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reference upload failed.");
      return "";
    } finally { setUploading(false); }
  }

  async function poll(id: string) {
    const token = ++pollTokenRef.current;
    for (let attempt = 0; attempt < 120 && token === pollTokenRef.current; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const response = await fetch(`/api/jobs/${id}`);
      if (!response.ok) continue;
      const data = await response.json();
      if (!data.job) continue;
      setJob(data.job);
      if (["completed", "failed", "cancelled", "expired"].includes(data.job.status)) {
        if (data.job.status === "completed") void fetch("/api/wallet").then((walletResponse) => walletResponse.json()).then((walletData) => { if (walletData.wallet) setAvailableCredits(Number(walletData.wallet.available)); });
        return;
      }
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!modelId || !prompt.trim() || generating) return;
    if (references.length && !supportsEditing) { setError(`${model?.name || "This model"} does not support reference-image editing.`); return; }
    if (expensive && !confirmed) { setError("Confirm the estimated maximum cost before generating."); return; }
    setSubmitting(true); setError(""); setJob(null); setResultReferenceId("");
    try {
      const response = await fetch("/api/generations/image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), modelId, prompt: prompt.trim(), aspectRatio: aspect, imageFileIds: references.map((reference) => reference.id), mode: references.length ? "edit" : "create", confirmedCost: confirmed || !expensive })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Generation request failed.");
      setJob(data.job); void poll(data.job.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Generation request failed."); }
    finally { setSubmitting(false); }
  }

  function removeReference(id: string) {
    setReferences((current) => {
      const removed = current.find((item) => item.id === id); if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  async function ensureResultReference() {
    if (resultReferenceId) return resultReferenceId;
    if (!resultUrl) return "";
    setActionBusy(true); setError("");
    try {
      const response = await fetch(resultUrl); if (!response.ok) throw new Error("Could not import this result.");
      const blob = await response.blob();
      const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      const id = await uploadReference(new File([blob], `generated-reference.${extension}`, { type: blob.type || "image/jpeg" }));
      if (id) setResultReferenceId(id);
      return id;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not import this result."); return ""; }
    finally { setActionBusy(false); }
  }

  function resetResult() { pollTokenRef.current += 1; setJob(null); setError(""); setConfirmed(false); }
  async function applyAsReference() { const id = await ensureResultReference(); if (id) { resetResult(); setReferences((current) => current.filter((item) => item.id === id)); } }
  async function animateInVideo() { const id = await ensureResultReference(); if (id) router.push(`/video?reference=${encodeURIComponent(id)}&prompt=${encodeURIComponent(prompt)}`); }
  async function copySettings() {
    await navigator.clipboard.writeText(JSON.stringify({ prompt, model: model?.name, modelId, aspectRatio: aspect, mode: references.length ? "edit" : "create" }, null, 2));
    setCopied("settings"); window.setTimeout(() => setCopied(""), 1500);
  }

  return <div className={`image-workspace ${dragActive ? "is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }} onDrop={(event) => { event.preventDefault(); setDragActive(false); const file = event.dataTransfer.files[0]; if (file) void uploadReference(file); }}>
    {dragActive && <div className="image-drop-overlay"><strong>Drop an image to use as a reference</strong><span>The selected model will switch into editing mode.</span></div>}
    <header className="image-workspace-bar">
      <div><span className="eyebrow">AI Creation Workspace</span><strong>Image Studio</strong></div>
      <nav aria-label="Image workspace actions"><Link href="/history">Library</Link><button type="button" onClick={() => setInspectorOpen((value) => !value)} aria-expanded={inspectorOpen}>Controls</button></nav>
    </header>

    <main className="image-canvas-shell">
      <section className={`image-canvas-stage aspect-${aspect.replace(":", "-")}`} aria-live="polite">
        {!job && <div className="image-empty-state"><span className="canvas-orbit" aria-hidden="true" /><span className="empty-kicker">Create or transform</span><h1>What do you want to create?</h1><p>Start with an idea, or add a reference image to edit something visually.</p><div className="image-starters">{promptStarters.map((starter) => <button type="button" key={starter} onClick={() => setPrompt(starter)}>{starter}</button>)}</div></div>}
        {generating && <div className="image-generating-state" role="status"><div className="image-generation-frame"><span /><span /><span /></div><span className="empty-kicker">{status.step}</span><h2>{status.title}</h2><p>{job?.public_id || "Your image will appear here when it is ready."}</p><small>No fake percentage—this updates from the provider.</small></div>}
        {job?.status === "failed" && <div className="image-failed-state"><span className="empty-kicker">Generation stopped</span><h2>That image was not created</h2><p>{job.error_message || "The provider returned a failure. Eligible reserved credits were released."}</p><button type="button" onClick={resetResult}>Try again</button></div>}
        {job?.status === "completed" && resultUrl && <div className="image-result-stage"><Image src={resultUrl} alt={`Generated image for: ${prompt}`} width={1536} height={1536} sizes="(max-width: 900px) 100vw, 75vw" unoptimized priority /><div className="image-result-toolbar"><a href={resultUrl} target="_blank" rel="noreferrer">Open</a><button type="button" disabled={actionBusy} onClick={() => void applyAsReference()}>Use as reference</button><button type="button" onClick={resetResult}>Variation</button><button type="button" disabled={actionBusy} onClick={() => void animateInVideo()}>Animate in Video</button><a href={resultUrl} download>Download</a><button type="button" onClick={() => void copySettings()}>{copied === "settings" ? "Copied" : "Copy settings"}</button></div></div>}
        {job?.status === "completed" && !resultUrl && <div className="image-failed-state"><h2>Generation completed</h2><p>The provider did not return a displayable image. You can find this job in Library.</p><Link href="/history">Open Library</Link></div>}
      </section>

      <aside className={`image-inspector ${inspectorOpen ? "is-open" : ""}`} aria-label="Image controls">
        <div className="image-inspector-head"><div><span className="eyebrow">Inspector</span><strong>Generation controls</strong></div><button type="button" onClick={() => setInspectorOpen(false)} aria-label="Close controls">Close</button></div>
        <div className="inspector-section"><span className="inspector-label">Model</span><button className="inspector-model" type="button" onClick={() => setPickerOpen(true)}><span className="provider-mark">{(model?.providerFamily || "AI").slice(0, 2).toUpperCase()}</span><span><strong>{model?.name || "Loading models"}</strong><small>{model?.providerFamily || "Image model"} · {model?.tier || ""}</small></span><b>Change</b></button>{model?.description && <p className="inspector-help">{model.description}</p>}<div className="capability-list">{model?.capabilities?.map((capability) => <em key={capability}>{capability.replaceAll("-", " ")}</em>)}</div></div>
        <div className="inspector-section"><span className="inspector-label">Mode</span><div className="mode-readout"><strong>{references.length ? "Edit image" : "Create image"}</strong><small>{references.length ? "Your reference supplies the visual starting point." : "Text prompt to a new image."}</small></div></div>
        <div className="inspector-section"><span className="inspector-label">Reference images</span><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadReference(file); event.currentTarget.value = ""; }} />{supportsEditing ? <button type="button" className="reference-upload" disabled={uploading || references.length >= maxReferences} onClick={() => fileInputRef.current?.click()}><strong>{uploading ? "Uploading…" : references.length ? "Add another reference" : "Add a reference image"}</strong><small>PNG, JPEG or WebP · {supportsMultipleReferences ? `up to ${maxReferences}` : "one image"}</small></button> : <div className="mode-readout"><strong>Text creation only</strong><small>{model?.name || "This model"} does not accept a reference image.</small></div>}{references.length > 0 && <div className="reference-list">{references.map((reference) => <div className="reference-item" key={reference.id}><Image src={reference.previewUrl} alt="" width={80} height={80} unoptimized /><span><strong>{reference.name}</strong><small>{Math.max(1, Math.round(reference.size / 1024)).toLocaleString()} KB</small></span><button type="button" onClick={() => removeReference(reference.id)} aria-label={`Remove ${reference.name}`}>×</button></div>)}</div>}</div>
        <div className="inspector-section"><span className="inspector-label">Aspect ratio</span><div className="aspect-grid">{aspectRatios.map((ratio) => <button type="button" key={ratio} className={aspect === ratio ? "active" : ""} onClick={() => setAspect(ratio)}>{ratio}</button>)}</div><div className="output-count"><span>Outputs</span><strong>1 image</strong><small>Current provider capability</small></div></div>
        <div className="inspector-cost"><span>Estimated cost</span><strong>{estimate ? `~${estimate.toFixed(2)} credits` : "Calculating…"}</strong><small>Actual charge is shown after completion.</small>{availableCredits != null && <small>{availableCredits.toFixed(2)} credits available</small>}</div>
        {expensive && <label className="image-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I authorize the displayed estimated usage.</span></label>}
      </aside>
    </main>

    <div className="image-prompt-dock"><form onSubmit={submit}><div className="prompt-reference-summary">{supportsEditing && <button type="button" onClick={() => fileInputRef.current?.click()}>+ Reference</button>}{references.length > 0 && <span>{references.length} ready</span>}<button type="button" onClick={() => setPickerOpen(true)}>{model?.name || "Choose model"}</button></div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} placeholder={references.length ? "Describe what to change in the reference…" : "Describe the image you want to create…"} aria-label="Image prompt" /><div className="image-prompt-footer"><div className="quick-aspects">{aspectRatios.slice(0, 4).map((ratio) => <button type="button" key={ratio} className={aspect === ratio ? "active" : ""} onClick={() => setAspect(ratio)}>{ratio}</button>)}</div><span className="dock-estimate">{estimate ? `~${estimate.toFixed(2)} cr` : "—"}</span><button className="image-generate-button" disabled={submitting || generating || !modelId || !prompt.trim() || Boolean(references.length && !supportsEditing) || (expensive && !confirmed)}>{submitting ? "Submitting…" : generating ? status.step : references.length ? "Edit image" : "Generate"}</button></div></form>{error && <div className="image-error" role="alert"><strong>Couldn’t continue.</strong><span>{error}</span></div>}</div>
    <ModelPicker models={models} value={modelId} onChange={(value) => { setModelId(value); setConfirmed(false); }} open={pickerOpen} onOpenChange={setPickerOpen} modality="image" />
  </div>;
}


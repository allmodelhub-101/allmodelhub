"use client";

import Image from "next/image";
import {createPortal} from "react-dom";
import {useWorkspaceOverlay} from "./use-workspace-overlay";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowsClockwise, CaretDown, Cube, DownloadSimple, Lightbulb, PaperPlaneTilt, Plus, ShareNetwork, SlidersHorizontal, UserCircle, X } from "@phosphor-icons/react";
import { ModelBrand } from "@/components/model-brand";
import { ModelPicker, PickerModel } from "@/components/model-picker";
import "./image-studio.css";
import { clipboardImageFiles } from "@/lib/image-clipboard";

type ImageModel = PickerModel & { modality: string; description?: string; capabilities?: string[];
  uiSchema?: { inputModes?: string[]; aspectRatios?: string[]; resolutionOptions?: string[]; maxReferences?: number } };
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
const emptyOptions: string[] = [];
const directionStarters = [
  { label: "Product", prompt: "Clean commercial product photography, precise materials, sculpted studio light, editorial art direction" },
  { label: "Portrait", prompt: "Expressive editorial portrait, natural skin texture, cinematic lighting, quiet confidence" },
  { label: "Concept", prompt: "A striking conceptual campaign image, confident art direction, layered atmosphere, considered composition" }
];
const inspirationTiles = ["Perfume product", "Editorial portrait", "Modern interior", "Sports car", "Mountain landscape", "Golden retriever"];

function InspirationImage({ index, alt }: { index: number; alt: string }) {
  return <span className={`inspiration-crop tile-${index}`}><Image src="/image-studio-inspiration-v2.webp" alt={alt} width={1200} height={800} sizes="(max-width: 700px) 68vw, 240px" /></span>;
}

function statusCopy(status?: string) {
  if (status === "queued") return { step: "Queued", title: "Your request is in line" };
  if (status === "submitted") return { step: "Starting model", title: "The provider accepted your request" };
  if (status === "settling") return { step: "Processing", title: "Securing your finished image" };
  return { step: "Generating", title: "Creating your image" };
}

function useImageStudio({crossModalityHandoffs=false}:{crossModalityHandoffs?:boolean}) {
  const qs = useSearchParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const pollTokenRef = useRef(0);
  const referenceUrlsRef = useRef<string[]>([]);
  const uploadBatchRef = useRef(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [models, setModels] = useState<ImageModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState(qs.get("prompt") || "");
  const [aspect, setAspect] = useState("1:1");
  const [resolution, setResolution] = useState("");
  const [references, setReferences] = useState<ReferenceAsset[]>([]);
  const [job, setJob] = useState<ImageJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [resultReferenceId, setResultReferenceId] = useState("");

  useEffect(() => {
    fetch("/api/models", { cache: "no-store" }).then((response) => response.json())
      .then((modelData) => {
        const list = (modelData.models || []).filter((model: ImageModel) => model.modality === "image");
        setModels(list);
        const requested = qs.get("model");
        const incomingReference=qs.get("reference");
        const acceptsReference=(item:ImageModel)=>Boolean((item.uiSchema?.maxReferences||0)>0||item.capabilities?.includes("editing")||item.capabilities?.includes("multi-reference"));
        const executable = list.filter((model: ImageModel) => model.available !== false);
        const chosen = requested && executable.some((model: ImageModel) => model.id === requested && (!incomingReference||acceptsReference(model))) ? requested : incomingReference?executable.find(acceptsReference)?.id:executable[0]?.id;
        if (chosen) setModelId(chosen);
      }).catch(() => setError("Could not load the Image workspace."));
  }, [qs]);

  useEffect(() => () => {
    pollTokenRef.current += 1;
    referenceUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const model = useMemo(() => models.find((item) => item.id === modelId), [modelId, models]);
  const aspectRatios = model ? model.uiSchema?.aspectRatios ?? emptyOptions : fallbackAspectRatios;
  const resolutions = model?.uiSchema?.resolutionOptions ?? emptyOptions;
  const effectiveResolution = resolutions.includes(resolution) ? resolution : resolutions[0] || "";
  const maxReferences = Math.max(0, model?.uiSchema?.maxReferences ?? (model?.capabilities?.includes("multi-reference") ? 10 : model?.capabilities?.includes("editing") ? 1 : 0));
  const estimate = Number(model?.retail?.flatCredits || 0);
  const expensive = estimate >= 50;
  const supportsEditing = maxReferences > 0 && (model?.uiSchema?.inputModes?.includes("image") ?? model?.capabilities?.includes("editing") ?? false);
  const supportsMultipleReferences = maxReferences > 1;
  const generating = Boolean(job && !["completed", "failed", "cancelled", "expired"].includes(job.status || ""));
  const resultUrl = Array.isArray(job?.result_urls) ? job.result_urls[0] : undefined;
  const status = statusCopy(job?.status);

  useEffect(()=>{
    const incoming=qs.get("reference");
    if(!incoming||!modelId||maxReferences<1||references.some(item=>item.id===incoming))return;
    fetch(`/api/files/${encodeURIComponent(incoming)}`).then(async response=>{
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.file?.url)throw new Error(data.error||"Could not load the selected Library asset.");
      if(!String(data.file.mime_type||"").startsWith("image/"))throw new Error("Only image assets can be used as image references.");
      setReferences([{id:data.file.id,name:data.file.name,previewUrl:data.file.url,size:Number(data.file.size_bytes||0)}]);
    }).catch(caught=>setError(caught instanceof Error?caught.message:"Could not load the selected Library asset."));
  },[maxReferences,modelId,qs,references]);

  useEffect(() => {
    const timer=window.setTimeout(()=>{if (!aspectRatios.includes(aspect)) setAspect(aspectRatios[0] || "1:1");
      setReferences((current) => {if (current.length <= maxReferences) return current; current.slice(maxReferences).forEach((item) => URL.revokeObjectURL(item.previewUrl));return current.slice(0, maxReferences);});},0);
    return()=>window.clearTimeout(timer);
  }, [aspect,aspectRatios,maxReferences,modelId]);

  async function uploadReference(file: File) {
    setUploading(true); setError("");
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Reference files must be PNG, JPEG, or WebP images.");
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

  async function addReferences(files: File[]) {
    if (!files.length || uploadBatchRef.current || submitting || generating) return;
    if (!supportsEditing) { setError("Choose a model that supports reference images before adding an image."); return; }
    const remaining = maxReferences - references.length;
    if (remaining < 1) { setError(`This model supports ${maxReferences} reference image${maxReferences === 1 ? "" : "s"}. Remove one before adding another.`); return; }
    uploadBatchRef.current = true;
    setUploading(true);
    try {
      for (const file of files.slice(0, remaining)) {
        const id = await uploadReference(file);
        if (!id) break;
      }
      if (files.length > remaining) setError(`Only ${remaining} more reference image${remaining === 1 ? "" : "s"} can be added to this model.`);
    } finally { uploadBatchRef.current = false; setUploading(false); }
  }

  function pasteReference(event: React.ClipboardEvent<HTMLDivElement>) {
    const files = clipboardImageFiles(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    void addReferences(files);
  }

  async function pasteFromClipboard() {
    if (uploadBatchRef.current || uploading || submitting || generating) return;
    try {
      if (!navigator.clipboard?.read) throw new Error("Use Ctrl / ⌘ + V in the prompt box, or Add reference to choose an image.");
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const type = item.types.find(type => ["image/png", "image/jpeg", "image/webp"].includes(type));
        if (!type) continue;
        const blob = await item.getType(type);
        files.push(new File([blob], `pasted-image-${files.length + 1}.${type === "image/jpeg" ? "jpg" : type.split("/")[1]}`, { type }));
      }
      if (!files.length) throw new Error("No supported image found in your clipboard. Copy an image, then paste again.");
      await addReferences(files);
    } catch (caught) {
      setError(caught instanceof Error && caught.name !== "NotAllowedError" ? caught.message : "Clipboard access was blocked. Use Ctrl / ⌘ + V in the prompt box, or Add reference.");
    }
  }

  function openSettings() {
    setInspectorOpen(true);
    window.setTimeout(() => { settingsRef.current?.scrollIntoView({ behavior: motionPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }); settingsRef.current?.focus({ preventScroll: true }); }, 0);
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
        if (data.job.status === "completed") window.dispatchEvent(new Event("amh-wallet-refresh"));
        return;
      }
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!modelId || !prompt.trim() || generating || submitting || uploading || uploadBatchRef.current) return;
    if (references.length && !supportsEditing) { setError(`${model?.name || "This model"} does not support reference-image editing.`); return; }
    if (expensive && !confirmed) { setError("Authorize generation in Image settings before continuing."); openSettings(); return; }
    setSubmitting(true); setError(""); setJob(null); setResultReferenceId("");
    try {
      const response = await fetch("/api/generations/image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), modelId, prompt: prompt.trim(), ...(aspectRatios.length ? { aspectRatio: aspect } : {}),
          ...(effectiveResolution ? { resolution: effectiveResolution } : {}), imageFileIds: references.map((reference) => reference.id),
          mode: references.length ? "edit" : "create", confirmedCost: confirmed || !expensive })
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
  async function shareResult() {
    if (!resultUrl) return;
    if (navigator.share) {
      try { await navigator.share({ title: "Created with Models Suite", text: prompt, url: resultUrl }); return; }
      catch (caught) { if (caught instanceof DOMException && caught.name === "AbortError") return; }
    }
    await navigator.clipboard.writeText(resultUrl); setCopied("link"); window.setTimeout(() => setCopied(""), 1500);
  }

  useEffect(() => {
    const input = promptInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }, [prompt]);

  return {fileInputRef,promptInputRef,settingsRef,settingsButtonRef,models,modelId,setModelId,prompt,setPrompt,aspect,setAspect,setResolution,references,job,submitting,uploading,actionBusy,error,confirmed,setConfirmed,pickerOpen,setPickerOpen,inspectorOpen,setInspectorOpen,copied,dragActive,setDragActive,motionPaused,setMotionPaused,model,aspectRatios,resolutions,effectiveResolution,maxReferences,expensive,supportsEditing,supportsMultipleReferences,generating,resultUrl,status,addReferences,pasteReference,pasteFromClipboard,openSettings,submit,removeReference,resetResult,applyAsReference,animateInVideo,copySettings,shareResult,crossModalityHandoffs};
}

export function ImageStudio(props:{crossModalityHandoffs?:boolean}) { return <ImageStudioView {...useImageStudio(props)} />; }
export type ImageStudioViewProps=ReturnType<typeof useImageStudio>;
export function ImageStudioView({fileInputRef,promptInputRef,settingsRef,settingsButtonRef,models,modelId,setModelId,prompt,setPrompt,aspect,setAspect,setResolution,references,job,submitting,uploading,actionBusy,error,confirmed,setConfirmed,pickerOpen,setPickerOpen,inspectorOpen,setInspectorOpen,copied,dragActive,setDragActive,motionPaused,setMotionPaused,model,aspectRatios,resolutions,effectiveResolution,maxReferences,expensive,supportsEditing,supportsMultipleReferences,generating,resultUrl,status,addReferences,pasteReference,pasteFromClipboard,openSettings,submit,removeReference,resetResult,applyAsReference,animateInVideo,copySettings,shareResult,crossModalityHandoffs}:ImageStudioViewProps) {
  const [viewerOpen,setViewerOpen]=useState(false);
  const viewerRef=useRef<HTMLDivElement|null>(null);
  useWorkspaceOverlay(viewerOpen,viewerRef,()=>setViewerOpen(false));
  useWorkspaceOverlay(inspectorOpen,settingsRef,()=>setInspectorOpen(false),false);
  return <div className={`image-workspace image-studio-refined ${motionPaused ? "is-motion-paused" : ""} ${dragActive ? "is-dragging" : ""}`} onPaste={pasteReference} onDragEnter={(event) => { if (!event.dataTransfer.types.includes("Files")) return; event.preventDefault(); setDragActive(true); }} onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }} onDrop={(event) => { if (!event.dataTransfer.files.length) return; event.preventDefault(); setDragActive(false); void addReferences(Array.from(event.dataTransfer.files)); }}>
    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple={supportsMultipleReferences} hidden onChange={(event) => { void addReferences(Array.from(event.target.files || [])); event.currentTarget.value = ""; }} />
    {dragActive && <div className="image-drop-overlay"><strong>Drop an image to use as a reference</strong><span>PNG, JPEG or WebP · Your selected model must support references.</span></div>}
    <main className="image-canvas-shell">
      <section className={`image-canvas-stage aspect-${aspect.replace(":", "-")}`} aria-live="polite">
        {!job && <div className="image-stage-identity"><span>Image Studio</span><strong><i />{references.length ? "Edit an image" : "Create something original"}</strong><button type="button" className="image-motion-toggle" aria-pressed={motionPaused} onClick={() => setMotionPaused(value => !value)}>{motionPaused ? "Resume motion" : "Pause motion"}</button></div>}
        {!job && <div className="image-empty-state image-studio-hero"><div className="hero-art hero-art-left"><InspirationImage index={0} alt="Perfume product inspiration" /><em>From idea<br/>to stunning images</em></div><div className="hero-art hero-art-right"><InspirationImage index={4} alt="Mountain landscape inspiration" /><InspirationImage index={2} alt="Interior inspiration" /><em>Turn your ideas<br/>into amazing visuals</em></div><div className="hero-copy"><h1>Create an <span>image</span></h1><p>Describe your idea, customize the look, then create with the world’s<br className="desktop-only"/> most advanced AI models.</p><div className="image-creation-path" aria-label="How image creation works"><span><b>1</b>Describe</span><i/><span><b>2</b>Customize</span><i/><span><b>3</b>Create</span></div><div className="direction-starters" aria-label="Prompt ideas">{directionStarters.map((starter,index) => <button type="button" key={starter.label} onClick={() => setPrompt(starter.prompt)}>{index===0?<Cube/>:index===1?<UserCircle/>:<Lightbulb/>}<span><strong>{starter.label}</strong><small>Use direction</small></span></button>)}</div></div></div>}
        {generating && <div className="image-generating-state" role="status"><div className="image-generation-frame"><span /><span /><span /></div><span className="empty-kicker">{status.step}</span><h2>{status.title}</h2><p>{job?.public_id || "Your image will appear here when it is ready."}</p><small>No fake percentage—this updates from the provider.</small></div>}
        {job?.status === "failed" && <div className="image-failed-state"><span className="empty-kicker">Generation stopped</span><h2>That image was not created</h2><p>{job.error_message || "The provider returned a failure. Eligible reserved credits were released."}</p><button type="button" onClick={resetResult}>Try again</button></div>}
        {job?.status === "completed" && resultUrl && <div className="image-result-stage"><Image src={resultUrl} alt={`Generated image for: ${prompt}`} width={1536} height={1536} sizes="(max-width: 900px) 100vw, 75vw" unoptimized priority /><button type="button" className="image-view-trigger" onClick={event=>{event.currentTarget.focus();setViewerOpen(true)}}>View full image</button><div className="image-result-toolbar"><a href={resultUrl} download><DownloadSimple/>Download</a><button type="button" onClick={() => void shareResult()}><ShareNetwork/>{copied === "link" ? "Link copied" : "Share"}</button><button type="button" onClick={resetResult}><ArrowsClockwise/>Create variation</button><button type="button" disabled={actionBusy} onClick={() => void applyAsReference()}><Plus aria-hidden="true" />Edit this image</button>{crossModalityHandoffs&&<button type="button" disabled={actionBusy} onClick={() => void animateInVideo()}>Animate in Video</button>}<button type="button" onClick={() => void copySettings()}>{copied === "settings" ? "Settings copied" : "Copy settings"}</button></div></div>}
        {job?.status === "completed" && !resultUrl && <div className="image-failed-state"><h2>Generation completed</h2><p>The provider did not return a displayable image. You can find this job in Library.</p><Link href="/history">Open Library</Link></div>}
      </section>

    </main>

    <div className="image-prompt-dock">
      <form onSubmit={submit}>
        <label className="image-prompt-label" htmlFor="image-creation-prompt"><b>Describe your image</b><span>Subject, style, lighting, composition — make it yours.</span></label>
        <textarea ref={promptInputRef} id="image-creation-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} placeholder={references.length ? "What would you like to change in your reference?" : "Describe the image you imagine…"} aria-label="Image prompt" />
        {references.length > 0 && <div className="image-reference-strip" role="region" tabIndex={0} aria-label="Attached reference images">{references.map((reference) => <div className="image-reference-chip" key={reference.id}><Image src={reference.previewUrl} alt={reference.name} width={48} height={48} unoptimized /><span>{reference.name}</span><button type="button" disabled={uploading || submitting || generating} onClick={() => removeReference(reference.id)} aria-label={`Remove ${reference.name}`}><X size={14} aria-hidden="true" /></button></div>)}</div>}
        <div className="image-prompt-footer">
          <div className="image-compose-tools">
            <button type="button" className="compose-tool model-tool" disabled={uploading || submitting || generating} onClick={(event) => {event.currentTarget.focus();setPickerOpen(true)}}><ModelBrand compact modelName={model?.name || "Auto"} provider={model?.providerFamily || ""} /><span><small>Model</small>{model?.name || "Choose model"}</span><CaretDown className="image-tool-chevron" size={14} aria-hidden="true" /></button>
            <button type="button" className="compose-tool reference-tool" disabled={uploading || submitting || generating || !supportsEditing || references.length >= maxReferences} title={supportsEditing ? "Upload or paste a reference image" : "Select a reference-capable model in Image settings"} onClick={() => fileInputRef.current?.click()}><Plus size={18} aria-hidden="true" /><span>{uploading ? "Uploading…" : "Add reference"}</span></button>
            <button ref={settingsButtonRef} type="button" className={`compose-tool settings-tool ${inspectorOpen ? "active" : ""}`} aria-expanded={inspectorOpen} aria-controls="image-settings-panel" onClick={() => inspectorOpen ? setInspectorOpen(false) : openSettings()}><SlidersHorizontal size={18} aria-hidden="true" /><span>Image settings<small>{aspectRatios.length ? aspect : "Automatic canvas"}{effectiveResolution ? ` · ${effectiveResolution}` : ""}</small></span></button>
          </div>
          <button className="image-generate-button" disabled={submitting || generating || uploading || !modelId || model?.available === false || !prompt.trim() || Boolean(references.length && !supportsEditing) || (expensive && !confirmed)}><PaperPlaneTilt aria-hidden="true" weight="fill" /><span>{submitting ? "Submitting…" : generating ? status.step : references.length ? "Edit image" : "Create image"}</span></button>
        </div>
        {expensive && <label className="image-authorization"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I authorize this generation using my credits. The final charge is recorded after completion.</span></label>}
        {inspectorOpen && <div ref={settingsRef} id="image-settings-panel" className="image-settings-panel" tabIndex={-1} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setInspectorOpen(false); settingsButtonRef.current?.focus(); } }}>
          <div className="image-settings-heading"><div><h2>Image settings</h2><p>Choose your canvas and add a visual starting point.</p></div><button type="button" className="image-settings-close" onClick={() => { setInspectorOpen(false); settingsButtonRef.current?.focus(); }} aria-label="Close image settings"><X size={18} aria-hidden="true" /></button></div>
          <div className="image-settings-grid">
            <fieldset className="image-setting-group" disabled={submitting || generating || uploading}><legend>Canvas</legend><p>Choose the shape that fits your idea.</p>
              {aspectRatios.length > 0 ? <div className="image-ratio-options">{aspectRatios.map((ratio) => <button type="button" key={ratio} aria-pressed={aspect === ratio} className={aspect === ratio ? "selected" : ""} onClick={() => { setAspect(ratio); setConfirmed(false); }}><span className="image-ratio-preview" aria-hidden="true" style={{ aspectRatio: ratio.replace(":", " / ") }} /><strong>{ratio}</strong><small>{ratio === "1:1" ? "Square" : Number(ratio.split(":")[0]) > Number(ratio.split(":")[1]) ? "Landscape" : "Portrait"}</small></button>)}</div> : <div className="image-setting-note">This model chooses the canvas automatically.</div>}
              {resolutions.length > 0 && <><label className="image-setting-label" htmlFor="image-resolution">Resolution</label><select id="image-resolution" value={effectiveResolution} onChange={(event) => { setResolution(event.target.value); setConfirmed(false); }}>{resolutions.map((value) => <option key={value} value={value}>{value}</option>)}</select></>}
            </fieldset>
            <fieldset className="image-setting-group" disabled={submitting || generating || uploading}><legend>Reference images <span>Optional</span></legend>
              <p>{supportsEditing ? "Guide the composition, style, or details with your own image." : "This model creates images from text. Choose an editing model to use references."}</p>
              {supportsEditing ? <button type="button" className="image-reference-dropzone" disabled={references.length >= maxReferences} onClick={() => fileInputRef.current?.click()}><Plus size={24} aria-hidden="true" /><strong>{uploading ? "Uploading your image…" : "Choose an image"}</strong><span>Or paste with Ctrl / ⌘ + V, or drag it onto this page</span><small>PNG, JPEG, WebP · up to 50 MB · {references.length}/{maxReferences} attached</small></button> : <button type="button" className="image-model-change" onClick={() => setPickerOpen(true)}>Choose another model</button>}
              {supportsEditing && <p className="image-reference-help">Adding a reference switches this generation to editing. Remove all references to create from text.</p>}
            </fieldset>
          </div>
          <div className="image-settings-summary"><span>{references.length ? "Editing from your references" : "Creating from your prompt"} · 1 image</span><button type="button" onClick={() => { setInspectorOpen(false); promptInputRef.current?.focus(); }}>Done</button></div>
        </div>}
        <div className="image-composer-utility"><p className="image-composer-help">{supportsEditing ? "Paste an image with Ctrl / ⌘ + V, or drag it here." : "Select a model with editing support to add a reference."}</p>{supportsEditing && <button type="button" className="image-paste-button" disabled={uploading || submitting || generating || references.length >= maxReferences} onClick={() => void pasteFromClipboard()}>Paste image</button>}<span className="image-prompt-count">{prompt.length.toLocaleString()} characters</span></div>
      </form>
      {error && <div className="image-error" role="alert"><strong>Couldn’t continue.</strong><span>{error}</span></div>}
    </div>
    {!job && <section className="image-inspiration" aria-labelledby="image-inspiration-title"><div><h2 id="image-inspiration-title">Get inspired</h2><p>Explore what’s possible with AI-generated images.</p></div><Link href="/history">View more <span aria-hidden="true">→</span></Link><div className="inspiration-grid">{inspirationTiles.map((alt,index)=><InspirationImage key={alt} index={index} alt={alt}/>)}</div></section>}
    {viewerOpen && resultUrl && createPortal(<div className="image-viewer-overlay"><button className="image-viewer-backdrop" type="button" aria-label="Close image viewer" onClick={()=>setViewerOpen(false)}/><div ref={viewerRef} role="dialog" aria-modal="true" aria-label="Image viewer" tabIndex={-1}><header><h2>Image preview</h2><button type="button" aria-label="Close image viewer" onClick={()=>setViewerOpen(false)}><X size={20}/></button></header><Image src={resultUrl} alt={prompt||"Generated image"} width={1536} height={1536} unoptimized/><a href={resultUrl} download>Download image</a></div></div>,document.body)}
    <ModelPicker models={models} value={modelId} onChange={(value) => { setModelId(value); setResolution(""); setConfirmed(false); }} open={pickerOpen} onOpenChange={setPickerOpen} modality="image" showPrices={false} />
  </div>;
}

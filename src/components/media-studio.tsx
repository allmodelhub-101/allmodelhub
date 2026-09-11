"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PremiumSelect } from "@/components/premium-select";

type Modality = "image"|"video"|"audio";
type Retail = { flatCredits?: number; perSecondCredits?: number };
type Model = {id:string;name:string;tier:string;modality:string;description:string;retail:Retail;capabilities:string[]};

type Props = { modality: Modality; title:string; subtitle:string };

export function MediaStudio({modality,title,subtitle}:Props){
  const qs=useSearchParams();
  const [models,setModels]=useState<Model[]>([]);
  const [modelId,setModelId]=useState("");
  const [prompt,setPrompt]=useState(qs.get("prompt") || "");
  const [duration,setDuration]=useState(5);
  const [resolution]=useState(modality==="video"?"720p":"");
  const [aspect,setAspect]=useState("16:9");
  const [job,setJob]=useState<{ id?: string; status?: string; result_urls?: string[]; public_id?: string; error_message?: string; charged_credits?: number; estimated_credits?: number } | null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [referenceFileIds,setReferenceFileIds]=useState<string[]>(()=>{const incoming=qs.get("reference");return incoming?[incoming]:[]});
  const [uploading,setUploading]=useState(false);
  const [copied,setCopied]=useState(false);
  const [projectId,setProjectId]=useState("");
  const [advanced,setAdvanced]=useState(false);
  const [audioMode,setAudioMode]=useState<"music"|"sfx">("music");

  useEffect(()=>{fetch("/api/models").then(r=>r.json()).then(d=>{const list=(d.models||[]).filter((m:Model)=>m.modality===modality && !(modality==="audio"&&m.id==="eleven-tts-flash"));setModels(list);const requested=qs.get("model");const chosen=requested&&list.some((m:Model)=>m.id===requested)?requested:list[0]?.id;if(chosen)setModelId(chosen)}).catch(()=>undefined)},[modality,qs]);
  useEffect(()=>{const sync=()=>setProjectId(window.localStorage.getItem("amh-active-project")||"");sync();const listener=(event:Event)=>setProjectId((event as CustomEvent<string>).detail||"");window.addEventListener("amh-project-change",listener);return()=>window.removeEventListener("amh-project-change",listener)},[]);
  const model=models.find(m=>m.id===modelId);
  const veoFixed = modelId === "veo-3-1-fast-fhd";
  const estimate=useMemo(()=>{if(!model)return 0;if(model.retail.flatCredits)return Number(model.retail.flatCredits);if(model.retail.perSecondCredits)return Number(model.retail.perSecondCredits)*duration;return 0},[model,duration]);
  const effectiveDuration = veoFixed ? 8 : duration;
  const expensive=modality==="video"||estimate>=50;

  async function uploadReference(file:File){setUploading(true);setError("");try{if(!file.type.startsWith("image/"))throw new Error("Reference files must be images.");const form=new FormData();form.set("file",file);const r=await fetch("/api/files",{method:"POST",body:form});const d=await r.json().catch(()=>({}));if(!r.ok||!d.file?.id)throw new Error(d.error||"Reference upload failed.");setReferenceFileIds(ids=>[...ids,d.file.id].slice(0,10));}catch(err){setError(err instanceof Error?err.message:"Reference upload failed.");}finally{setUploading(false);}}

  async function submit(e:FormEvent){e.preventDefault();if(expensive&&!confirmed){setError("Confirm the estimated maximum cost before generating.");return;}setBusy(true);setError("");setJob(null);const r=await fetch(`/api/generations/${modality}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:crypto.randomUUID(),projectId:projectId||undefined,modelId,prompt,duration:modality==="video"?effectiveDuration:modality==="audio"?duration:undefined,resolution:resolution||undefined,aspectRatio:aspect||undefined,imageFileIds:referenceFileIds,audioMode:modality==="audio"?audioMode:undefined,confirmedCost:confirmed||!expensive})});const d=await r.json().catch(()=>({}));setBusy(false);if(!r.ok){setError(d.error||"Generation request failed.");return;}setJob(d.job);poll(d.job.id);}

  async function poll(id:string){for(let attempt=0;attempt<120;attempt++){await new Promise(r=>setTimeout(r,modality==="video"?7000:3000));const res=await fetch(`/api/jobs/${id}`);if(!res.ok)continue;const d=await res.json();if(d.job){setJob(d.job);if(["completed","failed","cancelled","expired"].includes(d.job.status))return;}}}

  const resultUrl=Array.isArray(job?.result_urls)?job.result_urls[0]:undefined;
  return <div className={`creation-workspace ${modality}-workspace`}><div className="workspace-heading"><div><div className="kicker">{modality} studio</div><h1>{title}</h1></div><div className="workspace-context">{projectId?"Project connected":"Personal workspace"}</div></div>
    {modality==="audio"&&<div className="workspace-modes" role="tablist"><button type="button" className={audioMode==="music"?"active":""} onClick={()=>setAudioMode("music")}>Music</button><button type="button" className={audioMode==="sfx"?"active":""} onClick={()=>setAudioMode("sfx")}>Sound effects</button></div>}
    <div className="studio-layout creation-studio-layout">
      <form className="studio-panel inspector-panel" onSubmit={submit}>
        <label className="label">Model<PremiumSelect value={modelId} onChange={value=>{setModelId(value);setConfirmed(false)}} options={models.map(m=>({value:m.id,label:`${m.name} · ${m.tier}`}))} /></label>
        {model&&<div className="soft-card small" style={{padding:12}}><b>{model.name}</b><div className="muted" style={{marginTop:4}}>{model.description}</div></div>}
        {(modality==="image"||modality==="video")&&<div className="label">Reference image <span className="muted small">optional · enables editing/image-to-video where supported</span><input className="input" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading||referenceFileIds.length>=10} onChange={e=>{const f=e.target.files?.[0];if(f)uploadReference(f);e.currentTarget.value="";}}/>{referenceFileIds.length>0&&<div className="small muted" style={{marginTop:6}}>{referenceFileIds.length} reference image{referenceFileIds.length===1?"":"s"} ready. <button type="button" className="link-button" onClick={()=>setReferenceFileIds([])}>Clear</button></div>}</div>}
        <label className="label">Prompt<textarea className="textarea prompt-editor" placeholder={modality==="image"?"Describe the image you want…":modality==="video"?"Describe the scene, motion and camera…":"Describe the sound or music…"} value={prompt} onChange={e=>setPrompt(e.target.value)} required/></label>
        <div className="prompt-suggestions" aria-label="Prompt starters">{(modality==="image"?["Editorial product shot","Cinematic landscape","Character portrait"]:modality==="video"?["Slow camera push-in","Product reveal","Atmospheric city scene"]:["Warm ambient loop","Cinematic sound design","Bright percussion bed"]).map(example=><button type="button" className="prompt-chip" key={example} onClick={()=>setPrompt(example)}>{example}</button>)}</div>
        <details className="advanced-controls" open={advanced} onToggle={e=>setAdvanced(e.currentTarget.open)}><summary>Advanced controls <span>{advanced?"−":"+"}</span></summary><div className="advanced-grid">{modality==="video"&&<><label className="label">Duration{veoFixed?<div className="soft-card small" style={{padding:10}}>8 seconds · fixed by this model</div>:<PremiumSelect value={String(duration)} onChange={value=>{setDuration(Number(value));setConfirmed(false)}} options={[5,8,10,15].map(value=>({value:String(value),label:`${value} seconds`}))} />}</label><label className="label">Resolution<div className="soft-card small" style={{padding:10}}>{veoFixed?"1080p":"720p"}</div></label></>}{modality!=="audio"&&<label className="label">Aspect ratio<PremiumSelect value={aspect} onChange={setAspect} options={["16:9","9:16","1:1","4:3","3:4"].map(value=>({value,label:value}))} /></label>}{modality==="audio"&&<label className="label">Duration<input className="input" type="number" min={3} max={audioMode==="music"?60:10} step={1} value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label>}</div></details>
        <div className="confirm-box"><b>Estimated usage: {estimate.toFixed(2)} Credits{model?.retail.perSecondCredits?` for ${duration}s`:""}</b><br/>1 Credit = PKR 1. Provider-specific options can change actual cost; the server reserves a small safety buffer and never allows a negative wallet.</div>
        {expensive&&<label style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:13,color:"var(--muted)"}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I understand this is a higher-cost generation and authorize the displayed estimated usage.</span></label>}
        <button className="btn btn-primary" disabled={busy||!modelId||!prompt.trim()||(expensive&&!confirmed)}>{busy?"Submitting…":`Generate ${modality}`}</button>
        {error&&<div className="soft-card small" style={{padding:12,color:"var(--danger)"}}>{error}</div>}
      </form>
      <section className="studio-panel studio-result creation-canvas">
        {!job&&<div className="studio-empty"><div className="studio-empty-glyph">{modality==="image"?"▧":modality==="video"?"▶":"♫"}</div><h2>{modality==="video"?"Bring an idea—or a frame—to life.":audioMode==="music"?"Give your story a soundtrack.":"Create a sound from words."}</h2><p>{subtitle}</p><span>Model → Prompt → Generate</span></div>}
        {job&&job.status!=="completed"&&job.status!=="failed"&&<div className="generation-status"><div className="generation-skeleton" aria-hidden="true"><span /><span /><span /></div><div className="kicker">{job.status === "queued" ? "Queued" : "Processing"}</div><h3>{job.status === "queued" ? "Your generation is queued" : "Creating your result"}</h3><p className="muted small">Job {job.public_id||job.id}</p><p className="muted small">You can leave this page open while the provider finishes.</p></div>}
        {job?.status==="failed"&&<div><h3 style={{color:"var(--danger)"}}>Generation failed</h3><p className="muted">{job.error_message||"Provider returned a failure."}</p><p className="small">Eligible reserved credits are released automatically.</p></div>}
        {job?.status==="completed"&&<div className="studio-output">{modality==="image"&&resultUrl?<Image src={resultUrl} alt="Generated result" width={1024} height={1024} unoptimized/>:modality==="video"&&resultUrl?<video controls src={resultUrl}/>:resultUrl?<audio controls src={resultUrl}/>:<p>Generation completed. Open the result from your Library.</p>}<div className="result-meta">Ready · Charged {Number(job.charged_credits||job.estimated_credits||0).toFixed(2)} Credits</div>{resultUrl&&<div className="generation-actions"><a className="btn btn-primary" href={resultUrl} download>Download</a>{modality==="video"&&<LinkButton href={`/images?reference=${job?.id||""}`} label="Send frame → Image"/>}{modality==="audio"&&<LinkButton href={`/video?audio=${job?.id||""}`} label="Use in Video"/>}<button className="btn" type="button" onClick={async () => { await navigator.clipboard?.writeText(resultUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}>{copied ? "Copied" : "Copy link"}</button><button className="btn" type="button" onClick={() => { setJob(null); setError(""); }}>Variation</button></div>}</div>}
      </section>
    </div>
  </div>;
}

function LinkButton({href,label}:{href:string;label:string}){return <a className="btn" href={href}>{label}</a>}


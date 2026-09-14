"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowClockwise, CaretDown, CheckCircle, DownloadSimple, LinkSimple, MagicWand, MusicNote, PaperPlaneTilt, VideoCamera } from "@phosphor-icons/react";
import { PremiumSelect } from "@/components/premium-select";

type Modality = "image"|"video"|"audio";
type Retail = { flatCredits?: number; perSecondCredits?: number };
type UiSchema = {inputModes?:string[];aspectRatios?:string[];durationOptions?:number[];resolutionOptions?:string[];audioModes?:Array<"music"|"sfx">;maxReferences?:number;nativeAudio?:boolean};
type Model = {id:string;name:string;tier:string;modality:string;description:string;retail:Retail;capabilities:string[];uiSchema?:UiSchema};

type Props = { modality: Modality; title:string; subtitle:string; embedded?:boolean; initialAudioMode?:"music"|"sfx"; hideAudioModeTabs?:boolean };

// These models require dedicated source/structured-input workflows. Keep them
// visible in the catalog without presenting an incompatible prompt-only form.
const CATALOG_ONLY_MODEL_IDS = new Set([
  "real-esrgan",
  "flashvsr",
  "eleven-dialogue",
  "eleven-dubbing",
  "eleven-isolator"
]);

const videoStarters = [
  { label: "Product reveal", prompt: "Cinematic product reveal, slow camera push-in, sculpted studio light, refined material detail" },
  { label: "Moving portrait", prompt: "Expressive portrait with subtle natural movement, shallow depth of field, gentle handheld camera motion" },
  { label: "Atmospheric scene", prompt: "Rainy city at blue hour, reflective streets, slow dolly movement, atmospheric cinematic light" }
];

export function MediaStudio({modality,title,subtitle,embedded=false,initialAudioMode="music",hideAudioModeTabs=false}:Props){
  const qs=useSearchParams();
  const [models,setModels]=useState<Model[]>([]);
  const [modelId,setModelId]=useState("");
  const [prompt,setPrompt]=useState(qs.get("prompt") || "");
  const [duration,setDuration]=useState(5);
  const [resolution,setResolution]=useState(modality==="video"?"720p":"");
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
  const [audioMode,setAudioMode]=useState<"music"|"sfx">(initialAudioMode);

  useEffect(()=>{fetch("/api/models").then(r=>r.json()).then(d=>{const list=(d.models||[]).filter((m:Model)=>m.modality===modality && !(modality==="audio"&&m.capabilities.includes("tts")) && !CATALOG_ONLY_MODEL_IDS.has(m.id));setModels(list);const requested=qs.get("model");const chosen=requested&&list.some((m:Model)=>m.id===requested)?requested:list[0]?.id;if(chosen)setModelId(chosen)}).catch(()=>undefined)},[modality,qs]);
  useEffect(()=>{const sync=()=>setProjectId(window.localStorage.getItem("amh-active-project")||"");sync();const listener=(event:Event)=>setProjectId((event as CustomEvent<string>).detail||"");window.addEventListener("amh-project-change",listener);return()=>window.removeEventListener("amh-project-change",listener)},[]);
  const model=models.find(m=>m.id===modelId);
  const schema=model?.uiSchema||{};
  const audioModes=useMemo(()=>{
    const supported=new Set(models.flatMap(item=>item.uiSchema?.audioModes||[]));
    const available=(['music','sfx'] as const).filter(mode=>supported.has(mode));
    return available.length?available:(['music','sfx'] as const);
  },[models]);
  const compatibleModels=useMemo(()=>modality==="audio"
    ?models.filter(item=>(item.uiSchema?.audioModes||[]).includes(audioMode))
    :models,[audioMode,modality,models]);
  const durationOptions=schema.durationOptions?.length?schema.durationOptions:(modality==="video"?[5,8,10,15]:modality==="audio"?[3,5,10]:[]);
  const aspectOptions=schema.aspectRatios?.length?schema.aspectRatios:["16:9","9:16","1:1","4:3","3:4"];
  const resolutionOptions=schema.resolutionOptions?.length?schema.resolutionOptions:(modality==="video"?["720p"] : []);
  const maxReferences=Math.max(0,schema.maxReferences??(model?.capabilities.includes("image-to-video")?1:0));
  const effectiveDuration = durationOptions.length===1 ? durationOptions[0] : duration;
  const estimate=useMemo(()=>{if(!model)return 0;if(model.retail.flatCredits)return Number(model.retail.flatCredits);if(model.retail.perSecondCredits)return Number(model.retail.perSecondCredits)*effectiveDuration;return 0},[model,effectiveDuration]);
  // Model selection is the synchronization boundary for its capability defaults.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{if(!model)return;const timer=window.setTimeout(()=>{const nextDuration=durationOptions[0];if(nextDuration&&!durationOptions.includes(duration))setDuration(nextDuration);const nextAspect=aspectOptions[0];if(nextAspect&&!aspectOptions.includes(aspect))setAspect(nextAspect);const nextResolution=resolutionOptions[0]||"";if(!resolutionOptions.includes(resolution))setResolution(nextResolution);if(schema.audioModes?.length&&!schema.audioModes.includes(audioMode))setAudioMode(schema.audioModes[0]);setReferenceFileIds(ids=>ids.slice(0,maxReferences));setConfirmed(false)},0);return()=>window.clearTimeout(timer)},[modelId]);
  const expensive=modality==="video"||estimate>=50;

  function selectAudioMode(nextMode:"music"|"sfx"){
    setAudioMode(nextMode);
    if(!(schema.audioModes||[]).includes(nextMode)){
      const nextModel=models.find(item=>(item.uiSchema?.audioModes||[]).includes(nextMode));
      if(nextModel)setModelId(nextModel.id);
    }
    setConfirmed(false);
    setError("");
  }

  function retryWithSameSettings(){setJob(null);setError("");setConfirmed(false)}

  async function uploadReference(file:File){setUploading(true);setError("");try{if(!file.type.startsWith("image/"))throw new Error("Reference files must be images.");if(maxReferences<1)throw new Error(`${model?.name||"This model"} does not support image references.`);const form=new FormData();form.set("file",file);const r=await fetch("/api/files",{method:"POST",body:form});const d=await r.json().catch(()=>({}));if(!r.ok||!d.file?.id)throw new Error(d.error||"Reference upload failed.");setReferenceFileIds(ids=>[...ids,d.file.id].slice(0,maxReferences));}catch(err){setError(err instanceof Error?err.message:"Reference upload failed.");}finally{setUploading(false);}}

  async function submit(e:FormEvent){e.preventDefault();if(expensive&&!confirmed){setError("Confirm the estimated maximum cost before generating.");return;}setBusy(true);setError("");setJob(null);const r=await fetch(`/api/generations/${modality}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:crypto.randomUUID(),projectId:projectId||undefined,modelId,prompt,duration:modality==="video"?effectiveDuration:modality==="audio"?duration:undefined,resolution:resolution||undefined,aspectRatio:aspect||undefined,imageFileIds:referenceFileIds,audioMode:modality==="audio"?audioMode:undefined,confirmedCost:confirmed||!expensive})});const d=await r.json().catch(()=>({}));setBusy(false);if(!r.ok){setError(d.error||"Generation request failed.");return;}setJob(d.job);poll(d.job.id);}

  async function poll(id:string){for(let attempt=0;attempt<120;attempt++){await new Promise(r=>setTimeout(r,modality==="video"?7000:3000));const res=await fetch(`/api/jobs/${id}`);if(!res.ok)continue;const d=await res.json();if(d.job){setJob(d.job);if(["completed","failed","cancelled","expired"].includes(d.job.status))return;}}setError("This generation is still running. You can track it safely in the Generation Center.")}

  const resultUrl=Array.isArray(job?.result_urls)?job.result_urls[0]:undefined;
  const terminalFailure=job?.status&&["failed","cancelled","expired"].includes(job.status);
  const activeJob=job&&!job.status?.includes("completed")&&!terminalFailure;
  const statusCopy=getGenerationStatus(job?.status);
  const studioIcon=modality==="video"?<VideoCamera weight="fill" aria-hidden="true"/>:modality==="audio"?<MusicNote weight="fill" aria-hidden="true"/>:<MagicWand weight="fill" aria-hidden="true"/>;
  return <div className={`creation-workspace ${modality}-workspace ${embedded?"embedded-workspace":""}`}>{!embedded&&<div className="workspace-heading"><div className="media-studio-heading"><span className="media-studio-mark">{studioIcon}</span><span><span className="kicker">{modality} studio</span><h1>{title}</h1></span></div>{modality==="video"?<div className="video-workflow-guide" aria-label="Video creation steps"><span className="active"><b>1</b>Set up</span><i/><span><b>2</b>Generate</span><i/><span><b>3</b>Download</span></div>:<div className="workspace-context">{projectId?"Project connected":"Personal workspace"}</div>}</div>}
    {modality==="audio"&&!hideAudioModeTabs&&<div className="workspace-modes" role="tablist" aria-label="Audio creation mode">{audioModes.map(mode=><button key={mode} type="button" role="tab" aria-selected={audioMode===mode} className={audioMode===mode?"active":""} onClick={()=>selectAudioMode(mode)}>{mode==="music"?"Music":"Sound effects"}</button>)}</div>}
    <div className="studio-layout creation-studio-layout">
      <form className="studio-panel inspector-panel" onSubmit={submit}>
        <div className="studio-control-head"><span><small>Video setup</small><strong>Create your scene</strong></span><i>01</i></div>
        {modality==="video"&&<div className="video-panel-scroll-hint"><span><b>Complete the setup</b><small>Model → frame → prompt → settings → generate</small></span><span>Scroll for every control <CaretDown weight="bold" /></span></div>}
        <label className="label">AI video model <span className="control-hint">Choose speed and quality</span><PremiumSelect value={modelId} onChange={value=>{setModelId(value);setConfirmed(false)}} options={compatibleModels.map(m=>({value:m.id,label:`${m.name} · ${m.tier}`}))} /></label>
        {model&&<div className="video-selected-model"><span><CheckCircle weight="fill" /></span><div><small>Selected model · ready</small><b>{model.name}</b><p>{model.description}</p>{schema.inputModes?.length?<em>Accepts {schema.inputModes.join(" + ")}</em>:null}</div></div>}
        {(modality==="image"||modality==="video")&&maxReferences>0&&<div className="label">Starting frame <span className="control-hint">Optional image to animate</span><input className="input" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading||referenceFileIds.length>=maxReferences} onChange={e=>{const f=e.target.files?.[0];if(f)uploadReference(f);e.currentTarget.value="";}}/>{referenceFileIds.length>0&&<div className="small muted" style={{marginTop:6}}>{referenceFileIds.length} reference image{referenceFileIds.length===1?"":"s"} ready. <button type="button" className="link-button" onClick={()=>setReferenceFileIds([])}>Clear</button></div>}</div>}
        <label className="label">Describe the video <span className="control-hint">Scene, movement, camera and mood</span><textarea className="textarea prompt-editor" placeholder={modality==="image"?"Describe the image you want…":modality==="video"&&referenceFileIds.length?"Describe how this frame should move…":modality==="video"?"A cinematic scene with slow camera movement…":audioMode==="music"?"Describe the music, mood and instruments…":"Describe the sound effect and timing…"} value={prompt} onChange={e=>setPrompt(e.target.value)} required/></label>
        <div className="prompt-suggestions" aria-label="Prompt starters">{modality==="video"?videoStarters.map(starter=><button type="button" className="prompt-chip" key={starter.label} onClick={()=>setPrompt(starter.prompt)}>{starter.label}</button>):(modality==="image"?["Editorial product shot","Cinematic landscape","Character portrait"]:["Warm ambient loop","Cinematic sound design","Bright percussion bed"]).map(example=><button type="button" className="prompt-chip" key={example} onClick={()=>setPrompt(example)}>{example}</button>)}</div>
        <details className="advanced-controls" open={advanced} onToggle={e=>setAdvanced(e.currentTarget.open)}><summary><span>{modality==="video"?"Video settings":"Advanced controls"}<small>{modality==="video"?`${effectiveDuration}s · ${resolution||"Auto"} · ${aspect}`:""}</small></span><b>{advanced?"Hide":"Customize"}</b></summary><div className="advanced-grid">{durationOptions.length>0&&<label className="label">Duration{durationOptions.length===1?<div className="soft-card small" style={{padding:10}}>{durationOptions[0]} seconds · fixed by this model</div>:<PremiumSelect value={String(duration)} onChange={value=>{setDuration(Number(value));setConfirmed(false)}} options={durationOptions.map(value=>({value:String(value),label:`${value} seconds`}))} />}</label>}{resolutionOptions.length>0&&<label className="label">Resolution{resolutionOptions.length===1?<div className="soft-card small" style={{padding:10}}>{resolutionOptions[0]}</div>:<PremiumSelect value={resolution} onChange={setResolution} options={resolutionOptions.map(value=>({value,label:value}))}/>}</label>}{aspectOptions.length>0&&modality!=="audio"&&<label className="label">Aspect ratio<PremiumSelect value={aspect} onChange={setAspect} options={aspectOptions.map(value=>({value,label:value}))} /></label>}{schema.nativeAudio&&<div className="soft-card small" style={{padding:10}}>This model can generate native audio with video.</div>}</div></details>
        <div className="confirm-box"><b>Estimated usage: {estimate.toFixed(2)} Credits{model?.retail.perSecondCredits?` for ${effectiveDuration}s`:""}</b><br/>1 Credit = PKR 1. Provider-specific options can change actual cost; the server reserves a small safety buffer and never allows a negative wallet.</div>
        {expensive&&<label style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:13,color:"var(--muted)"}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I understand this is a higher-cost generation and authorize the displayed estimated usage.</span></label>}
        <button className="btn btn-primary media-submit" disabled={busy||!modelId||!prompt.trim()||(expensive&&!confirmed)}><PaperPlaneTilt weight="fill" aria-hidden="true" />{busy?"Submitting…":`Generate ${modality}`}</button>
        {error&&<div className="soft-card small" style={{padding:12,color:"var(--danger)"}}>{error}</div>}
      </form>
      <section className="studio-panel studio-result creation-canvas">
        <div className="studio-stage-label"><span className={activeJob?"live":""}/><b>{job?.status==="completed"?"Result ready":activeJob?"Generating now":"Preview stage"}</b><small>{model?.name||"Choose a model"}</small></div>
        {!job&&<div className="studio-empty"><div className="studio-empty-glyph">{studioIcon}</div><h2>{modality==="video"?"Create your first video":audioMode==="music"?"Give your story a soundtrack.":"Create a sound from words."}</h2><p>{modality==="video"?"Start from words or animate an image. Choose the model, describe the motion, and review the cost before creating.":subtitle}</p>{modality==="video"?<div className="video-stage-features"><span>Text to video</span><span>Image to video</span><span>Flexible canvas</span></div>:<span>Model → Prompt → Generate</span>}</div>}
        {activeJob&&<div className="generation-status"><div className="generation-skeleton" aria-hidden="true"><span /><span /><span /></div><div className="kicker">{statusCopy.label}</div><h3>{statusCopy.title}</h3><p className="muted small">{statusCopy.detail}</p><p className="muted small">Job {job.public_id||job.id}</p><p className="muted small">You can move to another workspace while this finishes. Progress remains available in the Generation Center.</p></div>}
        {terminalFailure&&<div><h3 style={{color:"var(--danger)"}}>{job?.status==="cancelled"?"Generation cancelled":job?.status==="expired"?"Generation expired":"Generation failed"}</h3><p className="muted">{job?.error_message||"The provider could not complete this generation."}</p><p className="small">Eligible reserved credits are released automatically. Your prompt and settings are preserved.</p><button className="btn btn-primary media-submit" type="button" onClick={retryWithSameSettings}><ArrowClockwise aria-hidden="true" />Retry with same settings</button></div>}
        {job?.status==="completed"&&<div className="studio-output">{modality==="image"&&resultUrl?<Image src={resultUrl} alt="Generated result" width={1024} height={1024} unoptimized/>:modality==="video"&&resultUrl?<video controls playsInline src={resultUrl}/>:resultUrl?<audio controls src={resultUrl}/>:<p>Generation completed. Open the result from your Library.</p>}<div className="result-meta">Ready · Charged {Number(job.charged_credits||job.estimated_credits||0).toFixed(2)} Credits</div>{resultUrl&&<div className="generation-actions"><a className="btn btn-primary media-submit" href={resultUrl} download><DownloadSimple aria-hidden="true" />Download</a>{modality==="video"&&<a className="btn media-submit" href={resultUrl} target="_blank" rel="noreferrer">Open video</a>}<button className="btn media-submit" type="button" onClick={async () => { await navigator.clipboard?.writeText(resultUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}><LinkSimple aria-hidden="true" />{copied ? "Copied" : "Copy link"}</button><button className="btn media-submit" type="button" onClick={() => { setJob(null); setError(""); }}><ArrowClockwise aria-hidden="true" />Variation</button></div>}</div>}
      </section>
    </div>
  </div>;
}

function getGenerationStatus(status?:string){
  if(status==="queued")return {label:"Queued",title:"Your generation is queued",detail:"Waiting for provider capacity."};
  if(status==="submitted")return {label:"Starting model",title:"The provider accepted your request",detail:"Preparing the selected model and inputs."};
  if(status==="settling")return {label:"Processing result",title:"Securing your finished output",detail:"Saving the result and finalizing the exact credit charge."};
  return {label:"Generating",title:"Creating your result",detail:"The selected model is working on your request."};
}


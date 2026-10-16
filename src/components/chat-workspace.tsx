"use client";

import { ArrowUp, CaretDown, ChartBar, ChatCircle, ImageSquare, MagicWand, Microphone, Paperclip, Plus, SlidersHorizontal, Sparkle, Stop, VideoCamera, X } from "@phosphor-icons/react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { memo, useEffect, useRef, useState, type Dispatch, type SetStateAction, type RefObject, type FormEvent, type KeyboardEvent } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./chat-workspace.css";
import { chatComposerKeyAction } from "@/lib/chat-composer-events";
import { useWorkspaceOverlay } from "./use-workspace-overlay";
import { ModelPicker, PickerModel } from "@/components/model-picker";
import { ModelBrand } from "@/components/model-brand";
import { PremiumSelect } from "@/components/premium-select";


export type Mode = "auto" | "budget" | "balanced" | "premium" | "flagship";
export type ChatMessage = { id?: string; role: "user" | "assistant"; content: string; meta?: string; credits?: number; interrupted?: boolean };
export type Project = { id: string; name: string };
export type Model = PickerModel & { modality: string };
export type UserFile = { id: string; name: string; size_bytes: number; extraction_status: string; project_id?: string | null };
type Setter<T> = Dispatch<SetStateAction<T>>;
export type ChatWorkspaceProps = {
 messages: ChatMessage[]; busy:boolean; activeModelName:string; exact?:Model; popularModels:Model[]; models:Model[];
 modelId:string; setModelId:Setter<string>; mode:Mode; setMode:Setter<Mode>; focusComposer:(prompt?:string)=>void;
 pickerOpen:boolean; setPickerOpen:Setter<boolean>; dragActive:boolean; setDragActive:Setter<boolean>;
 uploadFiles:(files:FileList|File[]|null)=>Promise<void>; input:string;setInput:Setter<string>;
 pastedContext:string;setPastedContext:Setter<string>;attachmentIds:string[];setAttachmentIds:Setter<string[]>;files:UserFile[];
 textareaRef:RefObject<HTMLTextAreaElement|null>;fileInputRef:RefObject<HTMLInputElement|null>;
 submit:(event?:FormEvent)=>void;handlePaste:(event:React.ClipboardEvent<HTMLTextAreaElement>)=>void;handleComposerKeyDown:(event:KeyboardEvent<HTMLTextAreaElement>)=>void;
 voiceActive:boolean;voiceSeconds:number;startVoiceInput:()=>void;cancelVoiceInput:()=>void;
 projectId:string;setProjectId:Setter<string>;projects:Project[];supportsReasoning:boolean;deepThink:boolean;setDeepThink:Setter<boolean>;
 features:{private_chat?:boolean;prompt_enhancer?:boolean};privateMode:boolean;setPrivateMode:Setter<boolean>;setConversationId:Setter<string>;
 enhancePrompt:()=>Promise<void>;enhancing:boolean;selectedProject?:Project;error:string;processingSeconds:number;copiedKey:string;
 copyMessage:(content:string,key:string)=>Promise<void>;editPrompt:(index:number)=>void;regenerate:(index:number)=>void;branchAt:(index:number)=>void;
 stopGeneration:()=>void;conversationKey:string;
};
export function ChatWorkspace({messages,busy,activeModelName,exact,popularModels,modelId,setModelId,setMode,focusComposer,pickerOpen,setPickerOpen,dragActive,setDragActive,uploadFiles,input,setInput,pastedContext,setPastedContext,attachmentIds,setAttachmentIds,files,textareaRef,fileInputRef,submit,handlePaste,handleComposerKeyDown,voiceActive,voiceSeconds,startVoiceInput,cancelVoiceInput,projectId,setProjectId,projects,mode,supportsReasoning,deepThink,setDeepThink,features,privateMode,setPrivateMode,setConversationId,enhancePrompt,enhancing,selectedProject,error,processingSeconds,copiedKey,copyMessage,editPrompt,regenerate,branchAt,models,stopGeneration,conversationKey}:ChatWorkspaceProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);
  const lastFollowTop = useRef(0);
  const previousConversation = useRef(conversationKey);
  const [showScrollButton,setShowScrollButton] = useState(false);
  const [controlsOpen,setControlsOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  useWorkspaceOverlay(controlsOpen,controlsRef,()=>setControlsOpen(false));

  useEffect(() => {
    const root=rootRef.current;
    const frame=root?.closest<HTMLElement>(".responsive-workspace");
    if(!frame)return;
    const viewport=window.visualViewport;
    const resize=()=>{
      if(viewport && viewport.scale===1)frame.style.setProperty("--chat-visible-height",`${viewport.height}px`);
      else frame.style.removeProperty("--chat-visible-height");
    };
    resize();viewport?.addEventListener("resize",resize);
    root?.setAttribute("data-ready","true");
    return()=>{viewport?.removeEventListener("resize",resize);frame.style.removeProperty("--chat-visible-height")};
  },[]);
  useEffect(() => {
    const body=scrollRef.current;if(!body)return;
    if(previousConversation.current!==conversationKey){followRef.current=true;lastFollowTop.current=0;previousConversation.current=conversationKey;}
    if(body.scrollTop < lastFollowTop.current-2)followRef.current=false;
    if(!messages.length){body.scrollTop=0;lastFollowTop.current=0;}
    else if(followRef.current){body.scrollTop=body.scrollHeight;lastFollowTop.current=body.scrollTop;}
  },[messages,busy,conversationKey]);
  useEffect(() => {
    const field=textareaRef.current;if(!field)return;
    const resize=()=>{
      field.style.height="auto";
      const style=getComputedStyle(field), min=parseFloat(style.minHeight)||44,max=parseFloat(style.maxHeight)||144;
      field.style.height=`${Math.min(Math.max(field.scrollHeight,min),max)}px`;
      field.style.overflowY=field.scrollHeight>max?"auto":"hidden";
    };
    resize();window.addEventListener("resize",resize);
    return()=>window.removeEventListener("resize",resize);
  },[input,textareaRef]);
  useEffect(()=>{
    const root=rootRef.current,body=scrollRef.current,composer=root?.querySelector<HTMLElement>(".composer-wrap");
    if(!root||!body||!composer)return;
    const resize=()=>{root.style.setProperty("--chat-composer-height",`${composer.offsetHeight}px`);if(body.scrollTop<lastFollowTop.current-2)followRef.current=false;if(followRef.current&&!root.classList.contains("is-welcome")){body.scrollTop=body.scrollHeight;lastFollowTop.current=body.scrollTop;}};
    const observer=new ResizeObserver(resize);observer.observe(composer);observer.observe(body);resize();
    return()=>observer.disconnect();
  },[]);
  const scrollLatest=()=>{const body=scrollRef.current;if(body){followRef.current=true;body.scrollTop=body.scrollHeight;lastFollowTop.current=body.scrollTop;setShowScrollButton(false)}};
  return <div ref={rootRef} aria-label="Chat workspace" className={`chat-workspace ${messages.length > 0 ? "has-messages" : "is-welcome"} ${pickerOpen ? "picker-open" : ""} ${dragActive ? "is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }} onDrop={(event) => { event.preventDefault(); setDragActive(false); void uploadFiles(event.dataTransfer.files); }}>
    {dragActive && <div className="chat-drop-overlay"><strong>Drop files to add them</strong><span>Documents and images will stay with this prompt.</span></div>}

    <div ref={scrollRef} className="chat-layout-body" role="region" aria-label="Conversation" tabIndex={0} onWheel={event=>{if(event.deltaY<0)followRef.current=false}} onTouchStart={()=>{followRef.current=false}} onScroll={(event) => { const element = event.currentTarget; const distance=element.scrollHeight-element.scrollTop-element.clientHeight; followRef.current=distance<80;if(followRef.current)lastFollowTop.current=element.scrollTop;setShowScrollButton(messages.length>0&&distance>160); }}>
      <div className="chat-messages premium-messages">
        {messages.length === 0 ? <div className="chat-home">
          <nav className="popular-models" aria-label="Popular AI models">
            <span className="popular-models-label">Popular models</span>
            <div className="popular-model-list"><div className="popular-model-track">
              {[0, 1].map((copy) => <div className="popular-model-set" aria-hidden={copy === 1 ? "true" : undefined} key={copy}>
                {popularModels.map((model) => <button type="button" tabIndex={copy === 1 ? -1 : undefined} className={modelId === model.id ? "active" : ""} key={model.id} onClick={() => { setModelId(model.id); setMode("auto"); focusComposer(); }} aria-label={model.name} aria-pressed={modelId === model.id}>
                  <ModelBrand modelName={model.name} provider={model.providerFamily} compact /><b>{model.name}</b>
                </button>)}
                <button type="button" tabIndex={copy === 1 ? -1 : undefined} className="popular-more" onClick={(event) => {event.currentTarget.focus();setPickerOpen(true)}}><Plus size={15} weight="bold" aria-hidden="true" /><b>More</b></button>
              </div>)}
            </div></div>
          </nav>
          <section className="chat-home-hero" aria-labelledby="chat-home-title">
            <span className="empty-kicker">One prompt. Endless possibilities.</span>
            <h1 className="empty-title" id="chat-home-title">What will you <span>create</span> today?<i aria-hidden="true" /></h1>
            <p className="empty-subtitle">Chat, create, analyze, and be more productive with the world&apos;s most advanced AI models.<br />All in one place.</p>
            <div className="creation-paths">
              <button type="button" className="creation-path answers" onClick={() => focusComposer()}><span><ChatCircle size={25} weight="fill" aria-hidden="true" /></span><strong>Get Answers</strong><small>Ask anything and get smart, reliable responses.</small></button>
              <Link className="creation-path images" href="/images"><span><ImageSquare size={25} weight="fill" aria-hidden="true" /></span><strong>Create Images</strong><small>Turn your ideas into stunning visuals.</small></Link>
              <Link className="creation-path videos" href="/video"><span><VideoCamera size={25} weight="fill" aria-hidden="true" /></span><strong>Make Videos</strong><small>Create videos from text in seconds.</small></Link>
              <button type="button" className="creation-path analyze" onClick={() => focusComposer("Help me analyze and plan ")}><span><ChartBar size={25} weight="fill" aria-hidden="true" /></span><strong>Analyze &amp; Plan</strong><small>Summarize, analyze, and get insights.</small></button>
            </div>
          </section>
        </div> : messages.map((message, index) => {
          const key = message.id || `${message.role}-${index}`;
          return <article className={`chat-row ${message.role}${message.interrupted ? " is-interrupted" : ""}`} key={key}><div className="avatar" aria-hidden="true">{message.role === "user" ? "You" : "AI"}</div><div className="chat-message-box"><div className="message-author">{message.role === "user" ? "You" : activeModelName || exact?.name || "Models Suite"}</div><div className="chat-content">{message.role === "assistant" ? <ChatMarkdown content={message.content} /> : message.content}</div>{busy && message.id?.startsWith("pending-") && !message.content && <div className="thinking-state" aria-live="off"><div className="thinking-orbit" aria-hidden="true"><Sparkle weight="fill" /><i /><i /></div><div className="thinking-copy"><strong>{processingSeconds < 2 ? "Understanding your request" : activeModelName ? `${activeModelName} is responding` : "Choosing the best model"}</strong><span>Working live · {processingSeconds}s</span><div className="thinking-progress" aria-hidden="true"><i /></div></div></div>}<div className="chat-actions"><button type="button" onClick={() => void copyMessage(message.content, key)} disabled={!message.content}>{copiedKey === key ? "Copied" : "Copy"}</button>{message.role === "user" && <button type="button" onClick={() => editPrompt(index)}>Edit prompt</button>}{message.role === "assistant" && <><button type="button" onClick={() => regenerate(index)}>Retry</button><button type="button" onClick={() => branchAt(index)}>Branch</button></>}{message.meta && <span className="chat-meta">{message.meta}</span>}</div></div></article>;
        })}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>
      {showScrollButton && <button type="button" className="scroll-latest" onClick={scrollLatest}>Latest</button>}
    </div>

    <div className="composer-wrap premium-composer-wrap">
      <form className="glass composer premium-composer" onSubmit={event=>{followRef.current=true;lastFollowTop.current=0;submit(event)}}>
        {(pastedContext || attachmentIds.length > 0) && <div className="attachment-strip" role="region" aria-label="Prompt attachments" tabIndex={0}>
          {pastedContext && <div className="attachment-card"><span className="attachment-type">TXT</span><div><strong>Pasted text</strong><small>{pastedContext.length.toLocaleString()} characters</small></div><button type="button" onClick={() => setPastedContext("")} aria-label="Remove pasted text"><X size={14} /></button></div>}
          {attachmentIds.map((id) => { const file = files.find((item) => item.id === id); return file ? <div className="attachment-card" key={id}><span className="attachment-type">FILE</span><div><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size_bytes / 1024)).toLocaleString()} KB</small></div><button type="button" onClick={() => setAttachmentIds((current) => current.filter((item) => item !== id))} aria-label={`Remove ${file.name}`}><X size={14} /></button></div> : null; })}
        </div>}
        <textarea ref={textareaRef} className="textarea chat-input" value={input} rows={1} onPaste={handlePaste} onKeyDown={event=>{if(chatComposerKeyAction({key:event.key,shiftKey:event.shiftKey,isComposing:event.nativeEvent.isComposing},busy)==="send"){followRef.current=true;lastFollowTop.current=0;}handleComposerKeyDown(event)}} onChange={(event) => setInput(event.target.value)} placeholder="Ask anything…" aria-label="Message" aria-describedby="chat-composer-hint" />
        <div className="composer-footer"><div className="composer-tools">
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.doc,.docx,image/*" hidden onChange={(event) => void uploadFiles(event.target.files)} />
            <button type="button" className="composer-icon-button" onClick={() => fileInputRef.current?.click()} aria-label="Attach files" title="Attach files"><Paperclip size={18} aria-hidden="true" /></button>
            <button type="button" className={`composer-icon-button voice-input-button ${voiceActive ? "is-recording" : ""}`} onClick={startVoiceInput} aria-label={voiceActive ? "Stop voice typing" : "Start voice typing"} title={voiceActive ? "Stop voice typing" : "Voice typing"}><Microphone size={18} weight={voiceActive ? "fill" : "regular"} aria-hidden="true" /></button>
            {voiceActive && <div className="voice-recording-status" role="status"><i/><span>Listening</span><time>{Math.floor(voiceSeconds / 60)}:{String(voiceSeconds % 60).padStart(2,"0")}</time><button type="button" onClick={cancelVoiceInput}>Cancel</button></div>}
            <button type="button" className="composer-model-button model-selector-button" onClick={(event) => {event.currentTarget.focus();setPickerOpen(true)}} aria-label={`Choose AI model. Current selection: ${exact?.name || "Auto-select best model"}`} title="Choose AI model">
              <ModelBrand modelName={exact?.name || "Auto"} provider={exact?.providerFamily} compact /><span className="model-selector-copy"><small>Choose AI model</small><strong>{exact?.name || "Auto (best match)"}</strong></span><CaretDown size={13} weight="bold" aria-hidden="true" />
            </button>
          <div className="composer-settings"><button type="button" className="chat-controls-trigger" aria-haspopup="dialog" aria-expanded={controlsOpen} onClick={(event)=>{event.currentTarget.focus();setControlsOpen(true)}} aria-label="Chat controls: project, routing and privacy"><SlidersHorizontal size={16} aria-hidden="true" /><span>Controls</span></button>{controlsOpen && createPortal(<div className="chat-workspace-controls"><button type="button" className="chat-controls-scrim" aria-label="Close chat controls" onClick={()=>setControlsOpen(false)} /><div ref={controlsRef} tabIndex={-1} className="composer-settings-panel" role="dialog" aria-modal="true" aria-label="Chat controls"><header><h2>Chat controls</h2><button type="button" className="chat-controls-close" aria-label="Close chat controls" onClick={()=>setControlsOpen(false)}><X size={18}/></button></header>
            <label><span>Project</span><PremiumSelect aria-label="Project" value={projectId} onChange={setProjectId} options={[{ value: "", label: "No project" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} /></label>
            <label><span>Routing tier</span><PremiumSelect aria-label="Routing tier" value={mode} onChange={(value) => { setMode(value as Mode); if (value !== "auto") setModelId(""); }} options={["auto", "budget", "balanced", "premium", "flagship"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} /></label>
            {supportsReasoning && <div className="setting-toggle-row"><span><strong>Reasoning</strong><small>Use a larger response budget</small></span><button type="button" role="switch" aria-label="Reasoning" aria-checked={deepThink} className={deepThink ? "active" : ""} onClick={() => setDeepThink((value) => !value)}>{deepThink ? "On" : "Off"}</button></div>}
            {exact && <div className="model-control-summary"><span>Model inputs</span><strong>{exact.uiSchema?.inputModes?.join(" · ") || "text"}</strong></div>}
            {features.private_chat !== false && <div className="setting-toggle-row"><span><strong>Private chat</strong><small>Do not save this conversation</small></span><button type="button" role="switch" aria-label="Private chat" aria-checked={privateMode} className={privateMode ? "active" : ""} onClick={() => { setPrivateMode((value) => !value); setConversationId(""); }}>{privateMode ? "On" : "Off"}</button></div>}
            {features.prompt_enhancer !== false && <button type="button" className="chat-enhance-action" onClick={()=>{void enhancePrompt();setControlsOpen(false)}} disabled={enhancing || !input.trim()}><MagicWand size={16} aria-hidden="true" />{enhancing ? "Improving…" : "Improve prompt"}</button>}
          </div></div>,document.body)}</div>
          {features.prompt_enhancer !== false && <button type="button" className="quiet-tool" onClick={enhancePrompt} disabled={enhancing || !input.trim()} title={enhancing ? "Improving prompt" : "Improve prompt"} aria-label={enhancing ? "Improving prompt" : "Improve prompt"}><MagicWand size={16} aria-hidden="true" /><span>{enhancing ? "Improving…" : "Improve prompt"}</span></button>}
        </div><div className="composer-submit-area">{selectedProject && <span className="active-project" title={selectedProject.name}>{selectedProject.name}</span>}{busy ? <button type="button" className="composer-send stop" onClick={() => stopGeneration()} aria-label="Stop generation"><Stop size={14} weight="fill" /></button> : <button type="submit" className="composer-send" disabled={!input.trim() && !pastedContext} aria-label="Send message"><ArrowUp size={17} weight="bold" /></button>}</div></div>
      </form>
      <div className="chat-response-status" role="status" aria-live="polite">{busy ? "Responding — use Stop to cancel." : privateMode ? "Private chat · conversation is not saved" : ""}</div>
      <p id="chat-composer-hint" className="composer-hint">Enter to send · Shift + Enter for a new line · Esc to stop</p>
      {error && <div className="soft-card small error-box" role="alert"><strong>Request not completed.</strong> {error} <span>Your prompt is still here.</span></div>}
    </div>
    <ModelPicker models={models} value={modelId} onChange={(value) => { setModelId(value); if (value) setMode("auto"); }} open={pickerOpen} onOpenChange={setPickerOpen} />
  </div>;
}

const ChatMarkdown = memo(function ChatMarkdown({content}:{content:string}) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    pre:({children})=><div className="chat-rich-scroll" role="region" aria-label="Code block" tabIndex={0}><pre>{children}</pre></div>,
    table:({children})=><div className="chat-rich-scroll" role="region" aria-label="Message table" tabIndex={0}><table>{children}</table></div>
  }}>{content}</ReactMarkdown>;
});

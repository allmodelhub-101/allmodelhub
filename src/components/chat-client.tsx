"use client";

import { ArrowUp, CaretDown, ChartBar, ChatCircle, DotsThree, ImageSquare, MagicWand, Microphone, Paperclip, Plus, SlidersHorizontal, Sparkle, Stop, VideoCamera, X } from "@phosphor-icons/react";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ModelPicker, PickerModel } from "@/components/model-picker";
import { PremiumSelect } from "@/components/premium-select";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

type Mode = "auto" | "budget" | "balanced" | "premium" | "flagship";
type ChatMessage = { id?: string; role: "user" | "assistant"; content: string; meta?: string; credits?: number; interrupted?: boolean };
type Project = { id: string; name: string };
type Model = PickerModel & { modality: string };
type UserFile = { id: string; name: string; size_bytes: number; extraction_status: string; project_id?: string | null };
type ConversationMessage = { id?: string; role: "user" | "assistant" | "system"; content: string; credits_charged?: number | null; model_id?: string | null };
type StreamEvent = { type?: string; conversationId?: string; text?: string; messageId?: string; credits?: number; model?: string; modelName?: string; error?: string };
type FeatureFlags = { private_chat?: boolean; prompt_enhancer?: boolean };
type VoiceResult = { isFinal: boolean; 0: { transcript: string } };
type VoiceRecognition = { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; abort(): void; onresult: ((event: { resultIndex: number; results: ArrayLike<VoiceResult> }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null };

export function ChatClient() {
  const qs = useSearchParams();
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceRef = useRef<VoiceRecognition | null>(null);
  const voiceCommittedRef = useRef("");
  const voiceStartDraftRef = useRef("");
  const loadedConversationRef = useRef("");
  const [mode, setMode] = useState<Mode>("auto");
  const [modelId, setModelId] = useState(qs.get("model") || "");
  const [models, setModels] = useState<Model[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(qs.get("project") || "");
  const [files, setFiles] = useState<UserFile[]>([]);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(qs.get("template") || "");
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [conversationId, setConversationId] = useState(qs.get("conversation") || "");
  const [deepThink, setDeepThink] = useState(false);
  const [privateMode, setPrivateMode] = useState(false);
  const [error, setError] = useState("");
  const [pastedContext, setPastedContext] = useState("");
  const [features, setFeatures] = useState<FeatureFlags>({ private_chat: true, prompt_enhancer: true });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const [activeModelName, setActiveModelName] = useState("");
  const draftKey = `amh-chat-draft:${conversationId || "new"}`;

  useEffect(() => {
    if (qs.get("template") || privateMode) return;
    const saved = window.sessionStorage.getItem(draftKey);
    if (!saved) return;
    const timer = window.setTimeout(() => setInput(saved), 0);
    return () => window.clearTimeout(timer);
  }, [draftKey, privateMode, qs]);

  useEffect(() => {
    if (privateMode) return;
    if (input) window.sessionStorage.setItem(draftKey, input);
    else window.sessionStorage.removeItem(draftKey);
  }, [draftKey, input, privateMode]);

  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(Math.max(field.scrollHeight, 44), 184)}px`;
    field.style.overflowY = field.scrollHeight > 184 ? "auto" : "hidden";
  }, [input]);

  useEffect(() => {
    if (!voiceActive) return;
    const timer = window.setInterval(() => setVoiceSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [voiceActive]);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setProcessingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => () => voiceRef.current?.abort(), []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: busy ? "auto" : "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    function globalShortcut(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPickerOpen(true);
      }
      if (event.key === "Escape" && busy) abortRef.current?.abort();
    }
    document.addEventListener("keydown", globalShortcut);
    return () => document.removeEventListener("keydown", globalShortcut);
  }, [busy]);

  useEffect(() => {
    Promise.all([
      fetch("/api/models").then((response) => response.json()), fetch("/api/projects").then((response) => response.json()),
      fetch("/api/files").then((response) => response.json()), fetch("/api/settings").then((response) => response.json())
    ]).then(([modelData, projectData, fileData, settingsData]) => {
      setModels((modelData.models || []).filter((model: Model) => model.modality === "text"));
      setProjects(projectData.projects || []);
      setFiles((fileData.files || []).filter((file: UserFile) => file.extraction_status === "ready"));
      setFeatures(settingsData.features || { private_chat: true, prompt_enhancer: true });
      if (!qs.get("model") && !qs.get("conversation") && settingsData.profile?.default_tier) setMode(settingsData.profile.default_tier as Mode);
    }).catch(() => setError("Could not load workspace data."));
  }, [qs]);

  useEffect(() => {
    if (!conversationId || busy || loadedConversationRef.current === conversationId) return;
    loadedConversationRef.current = conversationId;
    fetch(`/api/conversations?id=${conversationId}`).then((response) => response.json()).then((data) => {
      if (data.messages) setMessages(data.messages.filter((message: ConversationMessage) => message.role !== "system").map((message: ConversationMessage) => ({
        id: message.id, role: message.role, content: message.content,
        credits: message.credits_charged == null ? undefined : Number(message.credits_charged),
        meta: message.credits_charged == null ? undefined : `${message.model_id || "AI"} · ${Number(message.credits_charged).toFixed(4)} credits`
      })));
      if (data.conversation?.mode) setMode(data.conversation.mode as Mode);
      if (data.conversation?.project_id) setProjectId(data.conversation.project_id);
      if (data.conversation?.preferred_model) setModelId(data.conversation.preferred_model);
    }).catch(() => setError("Could not load this conversation."));
  }, [busy, conversationId]);

  const exact = useMemo(() => models.find((model) => model.id === modelId), [models, modelId]);
  const popularModels = useMemo(() => {
    const preferred = ["gpt", "claude", "gemini", "llama", "mistral", "deepseek"];
    return [...models].sort((left, right) => {
      const leftIndex = preferred.findIndex((name) => left.name.toLowerCase().includes(name));
      const rightIndex = preferred.findIndex((name) => right.name.toLowerCase().includes(name));
      return (leftIndex < 0 ? preferred.length : leftIndex) - (rightIndex < 0 ? preferred.length : rightIndex);
    }).slice(0, 6);
  }, [models]);
  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId), [projectId, projects]);
  const supportsReasoning = !exact || Boolean(exact.capabilities?.includes("reasoning"));

  useEffect(() => {
    const timer=window.setTimeout(()=>{if (!supportsReasoning) setDeepThink(false)},0);
    return()=>window.clearTimeout(timer);
  }, [supportsReasoning]);

  async function enhancePrompt() {
    if (!input.trim() || enhancing || busy) return;
    setEnhancing(true); setError("");
    try {
      const response = await fetch("/api/prompt-enhance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), prompt: input.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Prompt enhancement failed.");
      setInput(data.prompt || input);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Prompt enhancement failed."); }
    finally { setEnhancing(false); }
  }

  function startVoiceInput() {
    if (voiceActive) { stopVoiceInput(); return; }
    const speechWindow = window as typeof window & { SpeechRecognition?: new () => VoiceRecognition; webkitSpeechRecognition?: new () => VoiceRecognition };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setError("Voice typing is not supported in this browser. Try the latest Chrome or Edge."); return; }
    const recognition = new Recognition();
    voiceStartDraftRef.current = input;
    voiceCommittedRef.current = input.trim();
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]; const transcript = result[0]?.transcript?.trim() || "";
        if (!transcript) continue;
        if (result.isFinal) voiceCommittedRef.current = `${voiceCommittedRef.current}${voiceCommittedRef.current ? " " : ""}${transcript}`;
        else interim += `${interim ? " " : ""}${transcript}`;
      }
      setInput(`${voiceCommittedRef.current}${interim ? `${voiceCommittedRef.current ? " " : ""}${interim}` : ""}`);
    };
    recognition.onerror = (event) => { setVoiceActive(false); setError(event.error === "not-allowed" ? "Microphone access was blocked. Allow microphone access in your browser and try again." : "Voice typing stopped. Please try again."); };
    recognition.onend = () => { setVoiceActive(false); setVoiceSeconds(0); setInput(voiceCommittedRef.current); voiceRef.current = null; window.setTimeout(() => textareaRef.current?.focus(), 0); };
    voiceRef.current = recognition; setError(""); setVoiceSeconds(0); setVoiceActive(true);
    try { recognition.start(); } catch { setVoiceActive(false); setError("Voice typing could not start. Please try again."); }
  }

  function stopVoiceInput() {
    const recognition = voiceRef.current;
    voiceCommittedRef.current = input.trim();
    if (recognition) { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); }
    voiceRef.current = null; setVoiceActive(false); setVoiceSeconds(0); setInput(voiceCommittedRef.current); window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function cancelVoiceInput() {
    const recognition = voiceRef.current; voiceCommittedRef.current = voiceStartDraftRef.current;
    if (recognition) { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); }
    voiceRef.current = null; setVoiceActive(false); setVoiceSeconds(0); setInput(voiceStartDraftRef.current); window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function sendPrompt(prompt: string, history: ChatMessage[] = messages, recovery?: { input: string; pasted: string }) {
    if (!prompt.trim() || busy) return;
    const recoveryDraft = recovery || { input, pasted: pastedContext };
    setError(""); setProcessingSeconds(0); setBusy(true);
    const controller = new AbortController(); abortRef.current = controller;
    const working = [...history, { role: "user" as const, content: prompt.trim() }];
    const pendingId = `pending-${crypto.randomUUID()}`;
    setActiveModelName(exact?.name || "");
    setMessages([...working, { id: pendingId, role: "assistant", content: "" }]);
    setInput(""); setPastedContext("");
    try {
      const payload = {
          requestId: crypto.randomUUID(), messages: working.map(({ role, content }) => ({ role, content })), tier: mode,
          modelId: modelId || undefined, conversationId: privateMode ? undefined : conversationId || undefined,
          projectId: projectId || undefined, attachmentIds, maxTokens: deepThink ? 4096 : 2048, deepThink, private: privateMode
      };
      const requestChat = () => fetch("/api/chat", { method: "POST", signal: controller.signal, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      let response = await requestChat();
      if (response.status === 401) {
        const { error: refreshError } = await createBrowserSupabaseClient().auth.refreshSession();
        if (!refreshError) response = await requestChat();
      }
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Chat request failed.");
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n"); buffer = frames.pop() || "";
        for (const frame of frames) {
          const line = frame.split("\n").find((item) => item.startsWith("data:")); if (!line) continue;
          let streamEvent: StreamEvent; try { streamEvent = JSON.parse(line.slice(5).trim()) as StreamEvent; } catch { continue; }
          if (streamEvent.type === "meta") {
            if (streamEvent.modelName) setActiveModelName(streamEvent.modelName);
            if (streamEvent.conversationId && !privateMode) {
              loadedConversationRef.current = streamEvent.conversationId;
              setConversationId(streamEvent.conversationId); window.history.replaceState(null, "", `/chat?conversation=${streamEvent.conversationId}`);
            }
          }
          if (streamEvent.type === "delta") setMessages((current) => {
            return current.map((message) => message.id === pendingId ? { ...message, content: message.content + (streamEvent.text || "") } : message);
          });
          if (streamEvent.type === "usage") {
            setMessages((current) => {
              return current.map((message) => message.id === pendingId ? { ...message, id: streamEvent.messageId || message.id, credits: Number(streamEvent.credits), meta: `${streamEvent.model} · ${Number(streamEvent.credits).toFixed(4)} credits` } : message);
            });
          }
          if (streamEvent.type === "error") throw new Error(streamEvent.error || "Generation failed.");
        }
      }
      setAttachmentIds([]); window.sessionStorage.removeItem(draftKey);
    } catch (caught) {
      const stopped = (caught as Error)?.name === "AbortError";
      if (!stopped) {
        setError(caught instanceof Error ? caught.message : "Chat request failed.");
        setInput((current) => current || recoveryDraft.input); setPastedContext((current) => current || recoveryDraft.pasted);
      }
      setMessages((current) => current.map((message) => message.id === pendingId ? { ...message, interrupted: true, meta: message.content ? "Response interrupted · Retry available" : "Request not completed · Retry available" } : message));
    } finally { setBusy(false); setProcessingSeconds(0); setActiveModelName(""); abortRef.current = null; }
  }

  const uploadFiles = useCallback(async (selected: FileList | File[] | null) => {
    if (!selected || selected.length === 0) return;
    setError("");
    for (const file of Array.from(selected)) {
      const form = new FormData(); form.append("file", file); if (projectId) form.append("projectId", projectId);
      try {
        const response = await fetch("/api/files", { method: "POST", body: form }); const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.file) throw new Error(data.error || `Could not upload ${file.name}.`);
        setFiles((current) => [data.file, ...current.filter((item) => item.id !== data.file.id)]);
        setAttachmentIds((current) => current.includes(data.file.id) ? current : [...current, data.file.id]);
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not upload file."); }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [projectId]);

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData("text");
    if (text.length > 1200) { event.preventDefault(); setPastedContext(text); }
  }
  function submit(event?: FormEvent) {
    event?.preventDefault();
    const prompt = pastedContext ? `${input.trim() || "Use the attached context to help me."}\n\n[Pasted context]\n${pastedContext}` : input;
    void sendPrompt(prompt, messages, { input, pasted: pastedContext });
  }
  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
    if (event.key === "Escape" && busy) abortRef.current?.abort();
  }
  function newChat() {
    setMessages([]); setConversationId(""); loadedConversationRef.current = ""; setAttachmentIds([]); setPastedContext(""); setError("");
    window.history.replaceState(null, "", "/chat"); window.setTimeout(() => textareaRef.current?.focus(), 0);
  }
  function branchAt(index: number) { setMessages(messages.slice(0, index + 1)); setConversationId(""); window.history.replaceState(null, "", "/chat"); }
  function editPrompt(index: number) {
    setInput(messages[index].content); setMessages(messages.slice(0, index)); setConversationId("");
    window.history.replaceState(null, "", "/chat"); window.setTimeout(() => textareaRef.current?.focus(), 0);
  }
  function regenerate(index: number) {
    const previous = messages.slice(0, index).filter((message) => message.content);
    const lastUserIndex = [...previous].map((message) => message.role).lastIndexOf("user"); if (lastUserIndex < 0) return;
    void sendPrompt(previous[lastUserIndex].content, previous.slice(0, lastUserIndex), { input: previous[lastUserIndex].content, pasted: "" });
  }
  async function copyMessage(content: string, key: string) {
    await navigator.clipboard.writeText(content); setCopiedKey(key); window.setTimeout(() => setCopiedKey(""), 1400);
  }
  function exportChat() {
    const content = messages.map((message) => `## ${message.role === "user" ? "You" : "All Model Hub"}\n\n${message.content}\n`).join("\n");
    const blob = new Blob([content], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "all-model-hub-chat.md"; anchor.click(); URL.revokeObjectURL(url);
  }

  function focusComposer(nextPrompt?: string) {
    if (nextPrompt) setInput(nextPrompt);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  return <div className={`chat-page premium-chat-page ${dragActive ? "is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }} onDrop={(event) => { event.preventDefault(); setDragActive(false); void uploadFiles(event.dataTransfer.files); }}>
    {dragActive && <div className="chat-drop-overlay"><strong>Drop files to add them</strong><span>Documents and images will stay with this prompt.</span></div>}
    {messages.length > 0 && <header className="chat-toolbar premium-toolbar">
      <div className="workspace-identity"><span className="eyebrow">AI Creation Workspace</span><strong>{conversationId ? "Current conversation" : "New conversation"}</strong></div>
      <div className="chat-toolbar-actions">
        {conversationId && <button className="toolbar-new-chat" type="button" onClick={newChat} title="Start a fresh conversation"><Plus size={15} weight="bold" aria-hidden="true" /><span>New chat</span></button>}
        <details className="chat-more"><summary aria-label="Open conversation actions" title="Conversation actions"><DotsThree size={19} weight="bold" aria-hidden="true" /><span>Actions</span><small>Export &amp; manage</small></summary><div className="chat-more-menu premium-menu"><Link href="/battle">Compare models</Link><button type="button" onClick={exportChat} disabled={messages.length === 0}>Export conversation</button><button type="button" onClick={newChat}>Start new conversation</button></div></details>
      </div>
    </header>}

    <div className="chat-layout-body" onScroll={(event) => { const element = event.currentTarget; setShowScrollButton(element.scrollHeight - element.scrollTop - element.clientHeight > 220); }}>
      <div className="chat-messages premium-messages">
        {messages.length === 0 ? <div className="chat-home">
          <nav className="popular-models" aria-label="Popular AI models">
            <span className="popular-models-label">Popular models</span>
            <div className="popular-model-list">
              {popularModels.map((model, index) => <button type="button" className={modelId === model.id ? "active" : ""} key={model.id} onClick={() => { setModelId(model.id); setMode("auto"); focusComposer(); }} aria-pressed={modelId === model.id}>
                <span className={`model-monogram tone-${index % 6}`} aria-hidden="true">{model.name.slice(0, 1).toUpperCase()}</span><b>{model.name}</b>
              </button>)}
              <button type="button" className="popular-more" onClick={() => setPickerOpen(true)}><Plus size={15} weight="bold" aria-hidden="true" /><b>More</b></button>
            </div>
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
          return <article className={`chat-row ${message.role}${message.interrupted ? " is-interrupted" : ""}`} key={key}><div className="avatar" aria-hidden="true">{message.role === "user" ? "You" : "AI"}</div><div className="chat-message-box"><div className="message-author">{message.role === "user" ? "You" : activeModelName || exact?.name || "All Model Hub"}</div><div className="chat-content">{message.role === "assistant" ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown> : message.content}</div>{busy && message.id?.startsWith("pending-") && !message.content && <div className="thinking-state" role="status" aria-live="polite"><div className="thinking-orbit" aria-hidden="true"><Sparkle weight="fill" /><i /><i /></div><div className="thinking-copy"><strong>{processingSeconds < 2 ? "Understanding your request" : activeModelName ? `${activeModelName} is responding` : "Choosing the best model"}</strong><span>Working live · {processingSeconds}s</span><div className="thinking-progress" aria-hidden="true"><i /></div></div></div>}<div className="chat-actions"><button type="button" onClick={() => void copyMessage(message.content, key)} disabled={!message.content}>{copiedKey === key ? "Copied" : "Copy"}</button>{message.role === "user" && <button type="button" onClick={() => editPrompt(index)}>Edit prompt</button>}{message.role === "assistant" && <><button type="button" onClick={() => regenerate(index)}>Retry</button><button type="button" onClick={() => branchAt(index)}>Branch</button></>}{message.meta && <span className="chat-meta">{message.meta}</span>}</div></div></article>;
        })}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>
      {showScrollButton && <button type="button" className="scroll-latest" onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}>Latest</button>}
    </div>

    <div className="composer-wrap premium-composer-wrap">
      <form className="glass composer premium-composer" onSubmit={submit}>
        {(pastedContext || attachmentIds.length > 0) && <div className="attachment-strip">
          {pastedContext && <div className="attachment-card"><span className="attachment-type">TXT</span><div><strong>Pasted text</strong><small>{pastedContext.length.toLocaleString()} characters</small></div><button type="button" onClick={() => setPastedContext("")} aria-label="Remove pasted text"><X size={14} /></button></div>}
          {attachmentIds.map((id) => { const file = files.find((item) => item.id === id); return file ? <div className="attachment-card" key={id}><span className="attachment-type">FILE</span><div><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size_bytes / 1024)).toLocaleString()} KB</small></div><button type="button" onClick={() => setAttachmentIds((current) => current.filter((item) => item !== id))} aria-label={`Remove ${file.name}`}><X size={14} /></button></div> : null; })}
        </div>}
        <textarea ref={textareaRef} className="textarea chat-input" value={input} rows={1} onPaste={handlePaste} onKeyDown={handleComposerKeyDown} onChange={(event) => setInput(event.target.value)} placeholder="Ask anything…" aria-label="Message" />
        <div className="composer-footer"><div className="composer-tools">
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.doc,.docx,image/*" hidden onChange={(event) => void uploadFiles(event.target.files)} />
            <button type="button" className="composer-icon-button" onClick={() => fileInputRef.current?.click()} aria-label="Attach files" title="Attach files"><Paperclip size={18} aria-hidden="true" /></button>
            <button type="button" className={`composer-icon-button voice-input-button ${voiceActive ? "is-recording" : ""}`} onClick={startVoiceInput} aria-label={voiceActive ? "Stop voice typing" : "Start voice typing"} title={voiceActive ? "Stop voice typing" : "Voice typing"}><Microphone size={18} weight={voiceActive ? "fill" : "regular"} aria-hidden="true" /></button>
            {voiceActive && <div className="voice-recording-status" role="status"><i/><span>Listening</span><time>{Math.floor(voiceSeconds / 60)}:{String(voiceSeconds % 60).padStart(2,"0")}</time><button type="button" onClick={cancelVoiceInput}>Cancel</button></div>}
            <button type="button" className="composer-model-button model-selector-button" onClick={() => setPickerOpen(true)} aria-label={`Choose AI model. Current selection: ${exact?.name || "Auto-select best model"}`} title="Choose AI model">
              <span className="model-selector-copy"><small>Choose AI model</small><strong>{exact?.name || "Auto (best match)"}</strong></span><CaretDown size={13} weight="bold" aria-hidden="true" />
            </button>
          <details className="composer-settings"><summary title="Open generation controls"><SlidersHorizontal size={15} aria-hidden="true" /><span>Controls</span><small>Project, mode &amp; privacy</small></summary><div className="composer-settings-panel">
            <label><span>Project</span><PremiumSelect aria-label="Project" value={projectId} onChange={setProjectId} options={[{ value: "", label: "No project" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} /></label>
            <label><span>Routing tier</span><PremiumSelect aria-label="Routing tier" value={mode} onChange={(value) => { setMode(value as Mode); if (value !== "auto") setModelId(""); }} options={["auto", "budget", "balanced", "premium", "flagship"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} /></label>
            {supportsReasoning && <div className="setting-toggle-row"><span><strong>Reasoning</strong><small>Use a larger response budget</small></span><button type="button" role="switch" aria-checked={deepThink} className={deepThink ? "active" : ""} onClick={() => setDeepThink((value) => !value)}>{deepThink ? "On" : "Off"}</button></div>}
            {exact && <div className="model-control-summary"><span>Model inputs</span><strong>{exact.uiSchema?.inputModes?.join(" · ") || "text"}</strong></div>}
            {features.private_chat !== false && <div className="setting-toggle-row"><span><strong>Private chat</strong><small>Do not save this conversation</small></span><button type="button" role="switch" aria-checked={privateMode} className={privateMode ? "active" : ""} onClick={() => { setPrivateMode((value) => !value); setConversationId(""); }}>{privateMode ? "On" : "Off"}</button></div>}
          </div></details>
          {features.prompt_enhancer !== false && <button type="button" className="quiet-tool" onClick={enhancePrompt} disabled={enhancing || !input.trim()}><MagicWand size={15} aria-hidden="true" />{enhancing ? "Improving…" : "Improve prompt"}</button>}
        </div><div className="composer-submit-area">{selectedProject && <span className="active-project" title={selectedProject.name}>{selectedProject.name}</span>}{busy ? <button type="button" className="composer-send stop" onClick={() => abortRef.current?.abort()} aria-label="Stop generation"><Stop size={14} weight="fill" /></button> : <button type="submit" className="composer-send" disabled={!input.trim() && !pastedContext} aria-label="Send message"><ArrowUp size={17} weight="bold" /></button>}</div></div>
      </form>
      <p className="composer-hint">Enter to send · Shift + Enter for a new line · Esc to stop</p>
      {error && <div className="soft-card small error-box" role="alert"><strong>Request not completed.</strong> {error} <span>Your prompt is still here.</span></div>}
    </div>
    <ModelPicker models={models} value={modelId} onChange={(value) => { setModelId(value); if (value) setMode("auto"); }} open={pickerOpen} onOpenChange={setPickerOpen} />
  </div>;
}


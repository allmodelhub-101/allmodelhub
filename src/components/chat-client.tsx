"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PremiumSelect } from "@/components/premium-select";

type Mode = "auto" | "budget" | "balanced" | "premium" | "flagship";
type ChatMessage = { id?: string; role: "user" | "assistant"; content: string; meta?: string; credits?: number };
type Project = { id: string; name: string };
type Model = { id: string; name: string; modality: string; tier: string; description?: string };
type UserFile = { id: string; name: string; size_bytes: number; extraction_status: string; project_id?: string | null };
type ConversationMessage = { id?: string; role: "user" | "assistant" | "system"; content: string; credits_charged?: number | null; model_id?: string | null };
type StreamEvent = { type?: string; conversationId?: string; text?: string; messageId?: string; credits?: number; model?: string; error?: string };

export function ChatClient() {
  const qs = useSearchParams();
  const abortRef = useRef<AbortController | null>(null);
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
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/models").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/files").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json())
    ]).then(([modelData, projectData, fileData, settingsData]) => {
      setModels((modelData.models || []).filter((m: Model) => m.modality === "text"));
      setProjects(projectData.projects || []);
      setFiles((fileData.files || []).filter((f: UserFile) => f.extraction_status === "ready"));
      if (!qs.get("model") && !qs.get("conversation") && settingsData.profile?.default_tier) setMode(settingsData.profile.default_tier as Mode);
    }).catch(() => setError("Could not load workspace data."));
  }, [qs]);

  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/conversations?id=${conversationId}`).then((r) => r.json()).then((data) => {
      if (data.messages) setMessages(data.messages.filter((m: ConversationMessage) => m.role !== "system").map((m: ConversationMessage) => ({
        id: m.id, role: m.role, content: m.content,
        credits: m.credits_charged == null ? undefined : Number(m.credits_charged),
        meta: m.credits_charged == null ? undefined : `${m.model_id || "AI"} · ${Number(m.credits_charged).toFixed(4)} Credits`
      })));
      if (data.conversation?.mode) setMode(data.conversation.mode as Mode);
      if (data.conversation?.project_id) setProjectId(data.conversation.project_id);
      if (data.conversation?.preferred_model) setModelId(data.conversation.preferred_model);
    }).catch(() => setError("Could not load this conversation."));
  }, [conversationId]);

  const exact = useMemo(() => models.find((m) => m.id === modelId), [models, modelId]);

  async function enhancePrompt() {
    if (!input.trim() || enhancing || busy) return;
    setEnhancing(true); setError("");
    try {
      const response = await fetch("/api/prompt-enhance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), prompt: input.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Prompt enhancement failed.");
      setInput(data.prompt || input);
    } catch (e) { setError(e instanceof Error ? e.message : "Prompt enhancement failed."); }
    finally { setEnhancing(false); }
  }

  async function sendPrompt(prompt: string, history: ChatMessage[] = messages) {
    if (!prompt.trim() || busy) return;
    setError(""); setBusy(true);
    const controller = new AbortController(); abortRef.current = controller;
    const userMessage: ChatMessage = { role: "user", content: prompt.trim() };
    const working = [...history, userMessage];
    setMessages([...working, { role: "assistant", content: "" }]);
    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(), messages: working.map(({ role, content }) => ({ role, content })), tier: mode,
          modelId: modelId || undefined, conversationId: privateMode ? undefined : conversationId || undefined,
          projectId: projectId || undefined, attachmentIds, maxTokens: deepThink ? 4096 : 2048,
          deepThink, private: privateMode
        })
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Chat request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n"); buffer = frames.pop() || "";
        for (const frame of frames) {
          const line = frame.split("\n").find((x) => x.startsWith("data:")); if (!line) continue;
          let evt: StreamEvent; try { evt = JSON.parse(line.slice(5).trim()) as StreamEvent; } catch { continue; }
          if (evt.type === "meta" && evt.conversationId && !privateMode) {
            setConversationId(evt.conversationId);
            window.history.replaceState(null, "", `/chat?conversation=${evt.conversationId}`);
          }
          if (evt.type === "delta") setMessages((current) => {
            const copy = [...current]; const last = copy[copy.length - 1]; copy[copy.length - 1] = { ...last, content: last.content + evt.text }; return copy;
          });
          if (evt.type === "usage") setMessages((current) => {
            const copy = [...current]; const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, id: evt.messageId || last.id, credits: Number(evt.credits), meta: `${evt.model} · ${Number(evt.credits).toFixed(4)} Credits` };
            return copy;
          });
          if (evt.type === "error") throw new Error(evt.error || "Generation failed.");
        }
      }
      setAttachmentIds([]);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setError(e instanceof Error ? e.message : "Chat request failed.");
      setMessages((current) => current.filter((m, i) => !(i === current.length - 1 && m.role === "assistant" && !m.content)));
    } finally { setBusy(false); abortRef.current = null; }
  }

  function submit(event?: FormEvent) { event?.preventDefault(); void sendPrompt(input); }
  function stop() { abortRef.current?.abort(); }
  function newChat() { setMessages([]); setConversationId(""); setAttachmentIds([]); setError(""); window.history.replaceState(null, "", "/chat"); }
  function branchAt(index: number) { setMessages(messages.slice(0, index + 1)); setConversationId(""); window.history.replaceState(null, "", "/chat"); }
  function regenerate(index: number) {
    const previous = messages.slice(0, index).filter((m) => m.content);
    const lastUserIndex = [...previous].map((m) => m.role).lastIndexOf("user");
    if (lastUserIndex < 0) return;
    const prompt = previous[lastUserIndex].content;
    void sendPrompt(prompt, previous.slice(0, lastUserIndex));
  }
  function exportChat() {
    const content = messages.map((m) => `## ${m.role === "user" ? "You" : "All Model Hub"}\n\n${m.content}\n`).join("\n");
    const blob = new Blob([content], { type: "text/markdown" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "all-model-hub-chat.md"; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="chat-page">
    <header className="chat-toolbar">
      <div className="chat-toolbar-brand"><span className="chat-brand-mark">AM</span><div><strong>Workspace</strong><span>{exact?.name || "All Model Hub"}</span></div></div>
      <div className="chat-toolbar-controls">
        <button className="toolbar-new" onClick={newChat}>＋ New chat</button>
        <PremiumSelect className="mini-select model-select" aria-label="Select model" value={modelId} onChange={setModelId} options={[{ value: "", label: "Auto model" }, ...models.map((m) => ({ value: m.id, label: `${m.name} · ${m.tier}` }))]} />
        <select className="mini-select mode-select" aria-label="Reasoning mode" value={deepThink ? "deep" : mode} onChange={(e) => e.target.value === "deep" ? setDeepThink(true) : (setDeepThink(false), setMode(e.target.value as Mode))}><option value="auto">Fast · Auto</option><option value="balanced">Balanced</option><option value="premium">Deep think</option><option value="budget">Economy</option></select>
        {projects.length > 0 && <PremiumSelect className="mini-select project-select" aria-label="Project" value={projectId} onChange={(value) => { setProjectId(value); setAttachmentIds([]); }} options={[{ value: "", label: "No project" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />}
        <button className={`toolbar-icon ${privateMode ? "active" : ""}`} aria-label="Toggle private mode" title="Private mode" onClick={() => { setPrivateMode((v) => !v); setConversationId(""); }}>◈</button>
        <details className="chat-more"><summary aria-label="More chat options">•••</summary><div className="chat-more-menu"><button onClick={enhancePrompt} disabled={enhancing || !input.trim()}>{enhancing ? "Improving…" : "Improve prompt"}</button>{messages.length > 0 && <button onClick={exportChat}>Export chat</button>}<span>{privateMode ? "Private · not saved" : "Saved to workspace"}</span></div></details>
      </div>
    </header>

    <div className="chat-messages">
      {messages.length === 0 ? <div className="chat-empty"><div><div className="kicker">All Model Hub {exact ? `· ${exact.name}` : "Auto"}</div><h1>What are we creating?</h1><p>Chat, reason, analyze files and switch models without leaving one PKR workspace. Auto Best can choose the right intelligence for the task.</p></div></div> : messages.map((m, i) => <div className="chat-row" key={`${m.id || i}-${m.role}`}>
        <div className="avatar">{m.role === "user" ? "YOU" : "AI"}</div>
        <div className="chat-message-box">
          <div className="chat-content">{m.role === "assistant" ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || (busy && i === messages.length - 1 ? "Thinking…" : "")}</ReactMarkdown> : m.content}</div>
          <div className="chat-actions">
            <button onClick={() => navigator.clipboard.writeText(m.content)}>Copy</button>
            {m.role === "user" && <button onClick={() => { setInput(m.content); setMessages(messages.slice(0, i)); setConversationId(""); window.history.replaceState(null, "", "/chat"); }}>Edit</button>}
            {m.role === "user" && <button onClick={() => branchAt(i)}>Branch</button>}
            {m.role === "assistant" && <button onClick={() => regenerate(i)}>Regenerate</button>}
            {m.meta && <span className="chat-meta">{m.meta}</span>}
          </div>
        </div>
      </div>)}
    </div>

    <div className="composer-wrap">
      <form className="glass composer" onSubmit={submit}>
        <textarea className="textarea chat-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.nativeEvent.isComposing || e.keyCode === 229) return; if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} placeholder="Message All Model Hub…" aria-label="Message All Model Hub" />
        <div className="composer-footer">
          <div className="composer-tools"><button type="button" className="composer-attach" onClick={() => setShowOptions((v) => !v)} aria-expanded={showOptions}>＋ <span>Attach</span></button><span className="composer-context">{privateMode ? "Private" : projectId ? "Project context" : "Protected workspace"}</span><span className="composer-context credit-indicator">● Credits protected</span></div>
          {busy ? <button type="button" className="btn btn-danger send-button" onClick={stop}>Stop</button> : <button className="btn btn-primary send-button" disabled={!input.trim()} aria-label="Send message">Send <span>↑</span></button>}
        </div>
        {showOptions && files.length > 0 && <div className="composer-options"><span className="options-label">Attach ready files</span>{files.filter((f) => !projectId || !f.project_id || f.project_id === projectId).map((file) => <label key={file.id}><input type="checkbox" checked={attachmentIds.includes(file.id)} onChange={(e) => setAttachmentIds((current) => e.target.checked ? [...current, file.id] : current.filter((id) => id !== file.id))} /> {file.name}</label>)}</div>}
      </form>
      {error && <div className="soft-card small error-box">{error}</div>}
    </div>
  </div>;
}

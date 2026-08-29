"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Mode = "auto" | "budget" | "balanced" | "premium" | "flagship";
type ChatMessage = { id?: string; role: "user" | "assistant"; content: string; meta?: string; credits?: number };
type Project = { id: string; name: string };
type Model = { id: string; name: string; modality: string; tier: string; description?: string };
type UserFile = { id: string; name: string; size_bytes: number; extraction_status: string; project_id?: string | null };

const modes: Array<[Mode, string]> = [
  ["auto", "Auto Best"], ["budget", "Budget"], ["balanced", "Balanced"], ["premium", "Premium"], ["flagship", "Flagship"]
];

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
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/conversations?id=${conversationId}`).then((r) => r.json()).then((data) => {
      if (data.messages) setMessages(data.messages.filter((m: any) => m.role !== "system").map((m: any) => ({
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
          let evt: any; try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
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
    <div className="chat-toolbar">
      <button className="mode-pill" onClick={newChat}>＋ New</button>
      {modes.map(([id, label]) => <button key={id} className={`mode-pill ${mode === id && !modelId ? "active" : ""}`} onClick={() => { setMode(id); setModelId(""); }}>{label}</button>)}
      <select className="select mini-select" aria-label="Exact model" value={modelId} onChange={(e) => setModelId(e.target.value)}>
        <option value="">Exact model…</option>{models.map((m) => <option value={m.id} key={m.id}>{m.name} · {m.tier}</option>)}
      </select>
      {projects.length > 0 && <select className="select mini-select" aria-label="Project" value={projectId} onChange={(e) => { setProjectId(e.target.value); setAttachmentIds([]); }}><option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      <button className={`mode-pill ${deepThink ? "active" : ""}`} onClick={() => setDeepThink((v) => !v)}>Deep Think</button>
      <button className={`mode-pill ${privateMode ? "active" : ""}`} onClick={() => { setPrivateMode((v) => !v); setConversationId(""); }}>Private</button>
      {messages.length > 0 && <button className="mode-pill" onClick={exportChat}>Export</button>}
    </div>

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
        {files.length > 0 && <details className="attachment-picker"><summary>＋ Attach files {attachmentIds.length ? `(${attachmentIds.length})` : ""}</summary><div className="attachment-list">{files.filter((f) => !projectId || !f.project_id || f.project_id === projectId).map((file) => <label key={file.id}><input type="checkbox" checked={attachmentIds.includes(file.id)} onChange={(e) => setAttachmentIds((current) => e.target.checked ? [...current, file.id] : current.filter((id) => id !== file.id))} /> {file.name}</label>)}</div></details>}
        <textarea className="textarea" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} placeholder="Ask anything, write, reason, plan, code, or analyze your files…" />
        <div className="composer-footer">
          <div className="composer-tools">
            <button type="button" className="tool-btn" disabled={enhancing || !input.trim()} onClick={enhancePrompt}>{enhancing ? "Improving…" : "✨ Improve Prompt"}</button>
            <span className="tool-btn">{privateMode ? "Private · not saved" : projectId ? "Project context on" : "PKR wallet protected"}</span>
            <span className="tool-btn">{modelId ? exact?.name : mode}{deepThink ? " · Deep Think" : ""}</span>
          </div>
          {busy ? <button type="button" className="btn btn-danger" onClick={stop}>Stop</button> : <button className="btn btn-primary" disabled={!input.trim()}>Send ↑</button>}
        </div>
      </form>
      {error && <div className="soft-card small error-box">{error}</div>}
    </div>
  </div>;
}

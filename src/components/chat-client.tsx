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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: busy ? "auto" : "smooth", block: "end" });
  }, [messages, busy]);

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
    setPastedContext("");

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

  async function uploadFiles(selected: FileList | null) {
    if (!selected?.length) return;
    setError("");
    for (const file of Array.from(selected)) {
      const form = new FormData();
      form.append("file", file);
      if (projectId) form.append("projectId", projectId);
      try {
        const response = await fetch("/api/files", { method: "POST", body: form });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.file) throw new Error(data.error || `Could not upload ${file.name}.`);
        setFiles((current) => [data.file, ...current.filter((item) => item.id !== data.file.id)]);
        setAttachmentIds((current) => current.includes(data.file.id) ? current : [...current, data.file.id]);
      } catch (e) { setError(e instanceof Error ? e.message : "Could not upload file."); }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData("text");
    if (text.length > 1200) {
      event.preventDefault();
      setPastedContext(text);
    }
  }
  function submit(event?: FormEvent) { event?.preventDefault(); void sendPrompt(pastedContext ? `${input.trim() || "Use the attached context to help me."}\n\n[Pasted context]\n${pastedContext}` : input); }
  function stop() { abortRef.current?.abort(); }
  function newChat() { setMessages([]); setConversationId(""); setAttachmentIds([]); setPastedContext(""); setError(""); window.history.replaceState(null, "", "/chat"); }
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

  return (<button 
  className="model-pill"
  type="button"
>
  <span className="model-icon">
    🧠
  </span>

  <strong>
    {exact?.name || "Auto AI"}
  </strong>

  <span className="dropdown-arrow">
    ⌄
  </span>

</button>


  <div className="toolbar-actions">

    <span className="credit-pill">
      ⚡ 842
    </span>


    <details className="chat-more">
      <summary aria-label="Advanced settings">
        ⋯
      </summary>
            <div className="chat-more-menu premium-menu">
              <button onClick={() => setProjectId(projectId ? "" : projectId)}>
                📁 Project
              </button>

              <button onClick={() => setDeepThink((v) => !v)}>
                🧠 {deepThink ? "Deep Think" : "Reasoning"}
              </button>

              <button onClick={() => {
                setPrivateMode((v) => !v);
                setConversationId("");
              }}>
                🔒 {privateMode ? "Private On" : "Private Off"}
              </button>

              <button onClick={enhancePrompt} disabled={enhancing || !input.trim()}>
                ✨ {enhancing ? "Enhancing" : "Improve Prompt"}
              </button>

              <button onClick={exportChat}>
                📤 Export
              </button>

              <button onClick={newChat}>
                ＋ New Chat
              </button>
            </div>
          </details>
        </div>
      </header>

      <div className="chat-layout-body">
        <div className="chat-messages premium-messages">
          {messages.length === 0 ? (
            <div className="chat-empty premium-empty">

  <h1 className="empty-title">
    Start creating with AI
  </h1>

  <p className="empty-subtitle">
    Chat, analyze files, write content, and explore AI models.
  </p>

  <div className="quick-actions">

    <button onClick={() => setInput("Analyze this document")}>
      📄 Analyze
    </button>

    <button onClick={() => setInput("Help me write content")}>
      ✍ Write
    </button>

    <button onClick={() => setInput("Create an image idea")}>
      🎨 Create
    </button>

    <button onClick={() => setInput("Help me brainstorm ideas")}>
      💡 Ideas
    </button>

  </div>

</div>
          ) : (
            messages.map((m, i) => (
              <div className="chat-row" key={`${m.id || i}-${m.role}`}>
                <div className="avatar">
                  {m.role === "user" ? "YOU" : "AI"}
                </div>

                <div className="chat-message-box">
                  <div className="chat-content">
                    {m.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content || (busy && i === messages.length - 1 ? "Thinking…" : "")}
                      </ReactMarkdown>
                    ) : (
                      m.content
                    )}
                  </div>

                  <div className="chat-actions">
                    <button onClick={() => navigator.clipboard.writeText(m.content)}>Copy</button>

                    {m.role === "assistant" && (
                      <button onClick={() => regenerate(i)}>Regenerate</button>
                    )}

                    {m.meta && (
                      <span className="chat-meta">{m.meta}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          <div ref={messagesEndRef} aria-hidden="true" />
        </div>
      </div>

      <div className="composer-wrap premium-composer-wrap">
        <form className="glass composer premium-composer" onSubmit={submit}>
          {(pastedContext || attachmentIds.length > 0) && (
            <div className="attachment-strip">
              {pastedContext && (
                <div className="attachment-card">
                  📄 Pasted text
                  <button type="button" onClick={() => setPastedContext("")}>×</button>
                </div>
              )}

              {attachmentIds.map((id) => {
                const file = files.find((item) => item.id === id);
                return file ? (
                  <div className="attachment-card" key={id}>
                    📎 {file.name}
                    <button type="button" onClick={() => setAttachmentIds((c) => c.filter((x) => x !== id))}>
                      ×
                    </button>
                  </div>
                ) : null;
              })}
            </div>
          )}

          <textarea
            className="textarea chat-input"
            value={input}
            onPaste={handlePaste}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
          />

          <div className="composer-footer">
            <div className="composer-tools">
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                multiple
                accept=".pdf,.txt,.doc,.docx,image/*"
                onChange={(e) => void uploadFiles(e.target.files)}
              />

              <button type="button" onClick={() => fileInputRef.current?.click()}>
                📎
              </button>

              <button type="button" onClick={enhancePrompt}>
                ✨
              </button>

              <span>
                {privateMode ? "🔒 Private" : "🔒 Secure"}
              </span>

              {projectId && <span>📁 Project</span>}
            </div>

            {busy ? (
              <button type="button" className="btn btn-danger send-button" onClick={stop}>
                Stop
              </button>
            ) : (
              <button className="btn btn-primary send-button" disabled={!input.trim() && !pastedContext}>
                ↑
              </button>
            )}
          </div>
        </form>

        {error && <div className="soft-card small error-box">{error}</div>}
      </div>
    </div>
    );
}

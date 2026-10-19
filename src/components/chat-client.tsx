"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { chatComposerKeyAction, chatPromptWithContext, pastedChatContext } from "@/lib/chat-composer-events";
import { ChatWorkspace } from "./chat-workspace";
import { useChatGenerationActivity } from "./use-chat-generation-activity";

import { PickerModel } from "@/components/model-picker";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

type Mode = "auto" | "budget" | "balanced" | "premium" | "flagship";
type ChatMessage = { id?: string; role: "user" | "assistant"; content: string; meta?: string; credits?: number; interrupted?: boolean };
type Project = { id: string; name: string };
type Model = PickerModel & { modality: string };
type UserFile = { id: string; name: string; size_bytes: number; extraction_status: string; project_id?: string | null };
type ConversationMessage = { id?: string; role: "user" | "assistant" | "system"; content: string; credits_charged?: number | null; model_id?: string | null; metadata?: { billingStatus?: string } | null };
type StreamEvent = { type?: string; conversationId?: string; text?: string; messageId?: string; billingQuoteId?: string; credits?: number; billingStatus?: string; model?: string; modelName?: string; error?: string };
type SettlementResponse = { billingStatus?: "pending" | "settled" | "released" | "authorization_shortfall"; chargeCredits?: string; receiptId?: string; quoteStatus?: string };
type FeatureFlags = { private_chat?: boolean; prompt_enhancer?: boolean };
type VoiceResult = { isFinal: boolean; 0: { transcript: string } };
type VoiceRecognition = { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; abort(): void; onresult: ((event: { resultIndex: number; results: ArrayLike<VoiceResult> }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null };

export function ChatClient({ initialModels = [] }: { initialModels?: Model[] }) {
  const qs = useSearchParams();
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceRef = useRef<VoiceRecognition | null>(null);
  const voiceCommittedRef = useRef("");
  const voiceStartDraftRef = useRef("");
  const loadedConversationRef = useRef("");
  const conversationQueryRef = useRef(qs.get("conversation") || "");
  const [mode, setMode] = useState<Mode>("auto");
  const [modelId, setModelId] = useState(qs.get("model") || "");
  const [models, setModels] = useState<Model[]>(initialModels);
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

  async function pollPendingBilling(input: { pendingId: string; messageId?: string; quoteId?: string; model?: string }) {
    for (const delay of [2_000, 3_000, 5_000, 8_000, 13_000, 20_000]) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      const identifier = input.messageId ? { messageId: input.messageId } : input.quoteId ? { quoteId: input.quoteId } : null;
      if (!identifier) return;
      const response = await fetch("/api/billing/settle-pending", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(identifier),
      }).catch(() => null);
      if (!response?.ok) continue;
      const result = await response.json() as SettlementResponse;
      if (!result.billingStatus || result.billingStatus === "pending") continue;
      const targetId = input.messageId ?? input.pendingId;
      setMessages((current) => current.map((message) => message.id === targetId || message.id === input.pendingId ? {
        ...message,
        credits: result.billingStatus === "settled" && result.chargeCredits != null ? Number(result.chargeCredits) : undefined,
        meta: result.billingStatus === "settled"
          ? `${input.model || "AI"} · ${Number(result.chargeCredits || 0).toFixed(4)} credits`
          : result.billingStatus === "released" ? `${input.model || "AI"} · No charge`
          : `${input.model || "AI"} · Billing authorization requires review`,
      } : message));
      window.dispatchEvent(new Event("amh-wallet-refresh"));
      return;
    }
  }
  const [copiedKey, setCopiedKey] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [processingSeconds, setProcessingSeconds] = useState(0);
  const [activeModelName, setActiveModelName] = useState("");
  const draftKey = `amh-chat-draft:${conversationId || "new"}`;

  useEffect(() => {
    const nextConversation = qs.get("conversation") || "";
    if (conversationQueryRef.current === nextConversation) return;
    conversationQueryRef.current = nextConversation;
    // Streaming records its new conversation before updating the URL.
    // Keep that live response intact; only navigation should reset the chat.
    if (nextConversation && loadedConversationRef.current === nextConversation) return;
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      loadedConversationRef.current = "";
      setConversationId(nextConversation);
      setMessages([]);
      setAttachmentIds([]);
      setPastedContext("");
      setError("");
      setInput(qs.get("template") || "");
      textareaRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [qs]);

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
    function globalShortcut(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPickerOpen(true);
      }
      if (event.key === "Escape" && busy && !event.defaultPrevented && !(event.target instanceof Element && event.target.closest('[role="dialog"]'))) abortRef.current?.abort();
    }
    document.addEventListener("keydown", globalShortcut);
    return () => document.removeEventListener("keydown", globalShortcut);
  }, [busy]);

  useEffect(() => {
    Promise.all([
      fetch("/api/models", { cache: "no-store" }).then((response) => response.json()), fetch("/api/projects").then((response) => response.json()),
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
        credits: message.metadata?.billingStatus === "pending_reconciliation" || message.credits_charged == null ? undefined : Number(message.credits_charged),
        meta: message.metadata?.billingStatus === "pending_reconciliation" ? `${message.model_id || "AI"} · Billing pending`
          : message.credits_charged == null ? undefined : `${message.model_id || "AI"} · ${Number(message.credits_charged).toFixed(4)} credits`
      })));
      if (data.conversation?.mode) setMode(data.conversation.mode as Mode);
      if (data.conversation?.project_id) setProjectId(data.conversation.project_id);
      if (data.conversation?.preferred_model) setModelId(data.conversation.preferred_model);
    }).catch(() => setError("Could not load this conversation."));
  }, [busy, conversationId]);

  const exact = useMemo(() => models.find((model) => model.id === modelId), [models, modelId]);
  const popularModels = useMemo(() => {
    const preferred = ["gpt", "claude", "gemini", "llama", "mistral", "deepseek"];
    return models.filter((model) => model.available !== false).sort((left, right) => {
      const leftIndex = preferred.findIndex((name) => left.name.toLowerCase().includes(name));
      const rightIndex = preferred.findIndex((name) => right.name.toLowerCase().includes(name));
      return (leftIndex < 0 ? preferred.length : leftIndex) - (rightIndex < 0 ? preferred.length : rightIndex);
    }).slice(0, 6);
  }, [models]);
  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId), [projectId, projects]);
  useChatGenerationActivity({ busy, messages, modelName: activeModelName || exact?.name || "", conversationId, privateMode, error });
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
    // Failed requests leave a visible retry card. Never send its empty assistant
    // placeholder back to the API as conversation history.
    const validHistory = history.filter((message) => message.content.trim().length > 0);
    const working = [...validHistory, { role: "user" as const, content: prompt.trim() }];
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
              const pendingBilling = streamEvent.billingStatus === "pending_reconciliation";
              return current.map((message) => message.id === pendingId ? { ...message, id: streamEvent.messageId || message.id,
                credits: pendingBilling || streamEvent.credits == null ? undefined : Number(streamEvent.credits),
                meta: pendingBilling ? `${streamEvent.model} · Billing pending` : `${streamEvent.model} · ${Number(streamEvent.credits).toFixed(4)} credits` } : message);
            });
            if (streamEvent.billingStatus === "pending_reconciliation") {
              void pollPendingBilling({ pendingId, messageId: streamEvent.messageId, quoteId: streamEvent.billingQuoteId, model: streamEvent.model });
            }
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
    const context = pastedChatContext(text);
    if (context !== null) { event.preventDefault(); setPastedContext(context); }
  }
  function submit(event?: FormEvent) {
    event?.preventDefault();
    const prompt = chatPromptWithContext(input, pastedContext);
    void sendPrompt(prompt, messages, { input, pasted: pastedContext });
  }
  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const action = chatComposerKeyAction({key:event.key,shiftKey:event.shiftKey,isComposing:event.nativeEvent.isComposing},busy);
    if (action === "send") { event.preventDefault(); submit(); }
    if (action === "stop") abortRef.current?.abort();
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

  function focusComposer(nextPrompt?: string) {
    if (nextPrompt) setInput(nextPrompt);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  return <ChatWorkspace {...{messages,busy,activeModelName,exact,popularModels,modelId,setModelId,setMode,focusComposer,pickerOpen,setPickerOpen,dragActive,setDragActive,uploadFiles,input,setInput,pastedContext,setPastedContext,attachmentIds,setAttachmentIds,files,textareaRef,fileInputRef,submit,handlePaste,handleComposerKeyDown,voiceActive,voiceSeconds,startVoiceInput,cancelVoiceInput,projectId,setProjectId,projects,mode,supportsReasoning,deepThink,setDeepThink,features,privateMode,setPrivateMode,setConversationId,enhancePrompt,enhancing,selectedProject,error,processingSeconds,copiedKey,copyMessage,editPrompt,regenerate,branchAt,models}} stopGeneration={() => abortRef.current?.abort()} conversationKey={conversationId} />;
}

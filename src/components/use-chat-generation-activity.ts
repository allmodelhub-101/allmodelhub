"use client";

import { useEffect, useId, useRef } from "react";
import { chatActivity } from "@/lib/chat-generation-activity";
import type { GenerationCenterJob } from "@/lib/generation-center";

type Message = { id?: string; role: string; content: string; interrupted?: boolean; credits?: number; meta?: string };

/** Observe the existing controller; never submit, abort, retry or settle a request. */
export function useChatGenerationActivity({ busy, messages, modelName, conversationId, privateMode, error }: {
  busy: boolean; messages: Message[]; modelName: string; conversationId: string; privateMode: boolean; error: string;
}) {
  const owner = useId();
  const sequence = useRef(0);
  const current = useRef<{ job: GenerationCenterJob; assistantId?: string; finished: boolean; privateRun: boolean } | null>(null);
  const tail = messages.at(-1);
  const assistantId = tail?.role === "assistant" ? tail.id : undefined;
  const interrupted = tail?.role === "assistant" && Boolean(tail.interrupted);
  const credits = tail?.role === "assistant" ? tail.credits : undefined;
  const billingPending = tail?.role === "assistant" && Boolean(tail.meta?.includes("Billing pending"));
  const prompt = privateMode ? "Private chat" : [...messages].reverse().find(message => message.role === "user")?.content.slice(0, 58) || "Chat response";

  useEffect(() => {
    if (busy) {
      if (!current.current || current.current.finished) {
        const id = `chat-session:${owner}:${++sequence.current}`;
        current.current = { job: { id, public_id: id, modality: "text", source: "chat-session", model_id: modelName || "Auto", status: "processing", created_at: new Date().toISOString() }, finished: false, privateRun: privateMode };
      }
      const run = current.current;
      run.privateRun ||= privateMode;
      run.assistantId = assistantId;
      run.job = { ...run.job, prompt: run.privateRun ? "Private chat" : prompt, conversation_id: run.privateRun ? undefined : conversationId || undefined, model_id: modelName || run.job.model_id, updated_at: new Date().toISOString() };
      chatActivity.publish(owner, run.job);
    } else if (current.current) {
      const run = current.current;
      if (run.finished && (!assistantId || assistantId !== run.assistantId)) return;
      if (!run.finished) {
        run.finished = true;
        run.assistantId = assistantId;
        run.job = { ...run.job, status: error ? "failed" : interrupted ? "cancelled" : "completed", error_message: error || undefined, conversation_id: run.privateRun ? undefined : conversationId || run.job.conversation_id, completed_at: new Date().toISOString() };
      }
      run.job = { ...run.job, charged_credits: credits, billing_pending: billingPending, updated_at: new Date().toISOString() };
      chatActivity.publish(owner, run.job);
    }
  }, [busy, assistantId, interrupted, credits, billingPending, prompt, modelName, conversationId, privateMode, error, owner]);

  useEffect(() => () => { chatActivity.removeOwner(owner); current.current = null; }, [owner]);
}

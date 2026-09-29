import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ModelTier } from "@/lib/models";
import { chooseRuntimeTextModel, getRuntimeModel } from "@/lib/model-store";
import { mergeProviderUsage, normalizeProviderChunk } from "@/lib/providers/stream-normalizer";
import type { NormalizedProviderUsage } from "@/lib/providers/types";
import { enforceRateLimit } from "@/lib/rate-limit";
import { claimRequest, finalizeRequest } from "@/lib/idempotency";
import { logServerError } from "@/lib/public-error";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { beginTextBillingAttempt, cancelTextBillingAttempt, settleTextBillingAttempt, settleTextBillingInBackground, type TextBillingAttempt } from "@/lib/billing/text-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  requestId: z.string().uuid(),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string().min(1).max(200_000) })).min(1).max(80),
  tier: z.enum(["auto", "budget", "balanced", "premium", "flagship"]).default("auto"),
  modelId: z.string().optional(),
  conversationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  attachmentIds: z.array(z.string().uuid()).max(8).default([]),
  maxTokens: z.number().int().min(128).max(16_384).default(2048),
  deepThink: z.boolean().default(false),
  private: z.boolean().default(false),
  responseStyle: z.enum(["simple", "professional", "academic", "creative", "concise", "detailed"]).optional(),
  language: z.enum(["auto", "en", "ur", "roman-ur"]).optional()
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function safeSseJson(line: string) {
  const data = line.slice(5).trim();
  if (!data || data === "[DONE]") return null;
  try { return JSON.parse(data); } catch { return null; }
}

function languageInstruction(language: "auto" | "en" | "ur" | "roman-ur", userText: string) {
  if (language === "ur") return "LANGUAGE REQUIREMENT (highest priority): Write the entire answer in natural Urdu using Urdu script. Do not answer in English or Roman Urdu, except for code, URLs, product names, and technical identifiers that must remain unchanged. Use clear Pakistani Urdu. If the user explicitly asks for a different language in their latest message, follow that latest explicit request.";
  if (language === "roman-ur") return "LANGUAGE REQUIREMENT (highest priority): Write the entire answer in natural Roman Urdu using the Latin alphabet. Do not use Urdu/Arabic script and do not answer in English, except for code, URLs, product names, and technical identifiers that must remain unchanged. Use familiar Pakistani Roman Urdu wording. If the user explicitly asks for a different language in their latest message, follow that latest explicit request.";
  if (language === "en") return "LANGUAGE REQUIREMENT (highest priority): Write the answer in clear English, unless the user explicitly asks for a different language in their latest message.";
  const containsUrduScript = /[\u0600-\u06FF]/.test(userText);
  return containsUrduScript
    ? "The user wrote in Urdu script. Reply naturally in Urdu script unless their latest message requests another language."
    : "Match the language used in the user's latest message. When it is ambiguous, reply in clear English.";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) {
    if (authError) logServerError("chat-auth", authError, { requestPath: "/api/chat" });
    return NextResponse.json({ error: "Your session expired. Please sign in again to continue.", code: "AUTH_SESSION_EXPIRED" }, { status: 401 });
  }

  const limit = await enforceRateLimit(`chat:${user.id}`, "chat");
  if (limit.unavailable) return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 });
  if (!limit.success) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });

  const rawBody = await request.json().catch(() => null);
  const sanitizedBody = rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    ? {
        ...rawBody,
        messages: Array.isArray((rawBody as Record<string, unknown>).messages)
          ? ((rawBody as Record<string, unknown>).messages as unknown[]).filter((message) => {
              if (!message || typeof message !== "object" || Array.isArray(message)) return true;
              const content = (message as Record<string, unknown>).content;
              return typeof content !== "string" || content.trim().length > 0;
            })
          : (rawBody as Record<string, unknown>).messages,
      }
    : rawBody;
  const parsed = bodySchema.safeParse(sanitizedBody);
  if (!parsed.success) return NextResponse.json({ error: "Invalid chat request", details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  if (body.private && !(await isFeatureEnabled("private_chat"))) {
    return NextResponse.json({ error: "Private chat is currently unavailable." }, { status: 403 });
  }
  const totalInputLength = body.messages.reduce((total, message) => total + message.content.length, 0);
  if (totalInputLength > 400_000) return NextResponse.json({ error: "Chat input is too large." }, { status: 413 });
  const claim = await claimRequest(user.id, "chat", body.requestId);
  if (!claim.claimed) return NextResponse.json({ error: "This chat request was already submitted." }, { status: 409 });
  const claimId = claim.id;
  const admin = createAdminClient();
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  if (!lastUser) { await finalizeRequest(claimId, "failed"); return NextResponse.json({ error: "A user message is required." }, { status: 400 }); }

  const { data: profile } = await admin.from("profiles").select("default_language,default_tier,custom_instructions").eq("id", user.id).maybeSingle();
  const effectiveTier = body.tier === "auto" && body.deepThink ? "premium" : body.tier;
  const selected = body.modelId
    ? await getRuntimeModel(body.modelId)
    : await chooseRuntimeTextModel({ tier: effectiveTier as ModelTier | "auto", prompt: lastUser.content, hasAttachments: body.attachmentIds.length > 0, deepThink: body.deepThink });
  if (!selected || selected.modality !== "text") { await finalizeRequest(claimId, "failed"); return NextResponse.json({ error: "Selected text model is not available." }, { status: 400 }); }

  const systemParts: string[] = [
    "You are responding inside All Model Hub. Follow the user's request precisely, be useful, accurate and concise unless more detail is requested."
  ];
  if (profile?.custom_instructions) systemParts.push(`User custom instructions:\n${profile.custom_instructions}`);
  const language = body.language && body.language !== "auto" ? body.language : profile?.default_language || "auto";
  if (body.responseStyle) systemParts.push(`Preferred response style: ${body.responseStyle}.`);
  if (body.deepThink) systemParts.push("Use deeper reasoning internally and give a carefully checked final answer. Do not expose hidden chain-of-thought.");

  if (body.projectId) {
    const { data: project } = await admin.from("projects").select("name,instructions,preferred_language").eq("id", body.projectId).eq("user_id", user.id).maybeSingle();
    if (!project) { await finalizeRequest(claimId, "failed"); return NextResponse.json({ error: "Project not found." }, { status: 404 }); }
    systemParts.push(`Project: ${project.name}${project.instructions ? `\nProject instructions:\n${project.instructions}` : ""}${project.preferred_language && project.preferred_language !== "auto" ? `\nProject language: ${project.preferred_language}` : ""}`);
  }

  if (body.attachmentIds.length) {
    let attachmentQuery = admin.from("user_files").select("id,name,extracted_text,extraction_status,project_id").eq("user_id", user.id).in("id", body.attachmentIds);
    if (body.projectId) attachmentQuery = attachmentQuery.eq("project_id", body.projectId);
    const { data: files, error } = await attachmentQuery;
    if (error) { await finalizeRequest(claimId, "failed"); return NextResponse.json({ error: "Could not load attachments." }, { status: 500 }); }
    if ((files ?? []).length !== body.attachmentIds.length) { await finalizeRequest(claimId, "failed"); return NextResponse.json({ error: "One or more attachments are not available for this project." }, { status: 404 }); }
    const fileContext = (files ?? []).filter((f) => f.extraction_status === "ready" && f.extracted_text).map((f) => `### File: ${f.name}\n${String(f.extracted_text).slice(0, 45_000)}`).join("\n\n").slice(0, 120_000);
    if (fileContext) systemParts.push(`Use these user-provided files as context. If the answer is not supported by them, say so rather than inventing file content.\n\n${fileContext}`);
  }

  // Keep the user's language contract last so project and file context cannot dilute it.
  systemParts.push(languageInstruction(language, lastUser.content));

  const effectiveMessages = [{ role: "system" as const, content: systemParts.join("\n\n") }, ...body.messages.filter((m) => m.role !== "system")];
  const combinedInput = effectiveMessages.map((m) => `${m.role}:${m.content}`).join("\n");
  const maxTokens = body.deepThink ? Math.max(body.maxTokens, 4096) : body.maxTokens;
  const billingInput = {
    userId: user.id,
    parentRequestId: claimId,
    modelId: selected.id,
    textForReservation: combinedInput,
    inputOverheadTokens: selected.inputOverheadTokens,
    maxOutputTokens: maxTokens,
    messages: effectiveMessages,
    deepThink: body.deepThink,
    allowFallback: true,
    operation: "chat" as const,
    options: { deepThink: body.deepThink, private: body.private },
    metadata: { conversation_id: body.conversationId ?? null },
  };
  let billingAttempt: TextBillingAttempt;
  try {
    billingAttempt = await beginTextBillingAttempt(billingInput);
  } catch (error) {
    const message = errorMessage(error);
    const insufficient = message.includes("INSUFFICIENT_CREDITS");
    const safety = message.includes("SPEND_LIMIT");
    await finalizeRequest(claimId, "failed");
    if (!insufficient && !safety) logServerError("chat-wallet", error, { userId: user.id, modelId: selected.id });
    return NextResponse.json({ error: insufficient ? "Insufficient credits. Add credits to continue." : safety ? "This request exceeds your spending safety limit. Update it in Settings to continue." : "Chat provider is temporarily unavailable." }, { status: insufficient ? 402 : safety ? 403 : 503 });
  }

  let conversationId: string | null = body.private ? null : (body.conversationId ?? null);
  let userMessageId: string | null = null;
  try {
    if (!body.private) {
      if (!conversationId) {
        const title = lastUser.content.replace(/\s+/g, " ").slice(0, 72) || "New chat";
        const { data, error } = await admin.from("conversations").insert({ user_id: user.id, project_id: body.projectId || null, title, mode: body.tier, preferred_model: selected.id, private: false }).select("id").single();
        if (error) throw error;
        conversationId = data.id;
      } else {
        const { data } = await admin.from("conversations").select("id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
        if (!data) throw new Error("Conversation not found.");
      }
      const { data: inserted, error } = await admin.from("messages").insert({ conversation_id: conversationId, user_id: user.id, role: "user", content: lastUser.content, model_id: selected.id }).select("id").single();
      if (error) throw error;
      userMessageId = inserted.id;
      if (body.attachmentIds.length) {
        await admin.from("message_attachments").insert(body.attachmentIds.map((fileId) => ({ user_id: user.id, conversation_id: conversationId, message_id: userMessageId, file_id: fileId })));
      }
    }
  } catch (error) {
    await billingAttempt.upstream.response.body?.cancel().catch(() => undefined);
    await cancelTextBillingAttempt(billingAttempt, "conversation_persistence_failed");
    await finalizeRequest(claimId, "failed");
    logServerError("chat-persistence", error, { userId: user.id, conversationId });
    return NextResponse.json({ error: "Could not save chat conversation." }, { status: 500 });
  }

  const encoder = new TextEncoder();
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      let providerUsage: NormalizedProviderUsage = { providerRequestId: billingAttempt.upstream.providerRequestId };
      let finalized = false;
      let assistantMessageId: string | null = null;
      const emit = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      const consumeAttempt = async (attempt: typeof billingAttempt) => {
        const decoder = new TextDecoder();
        const reader = attempt.upstream.response.body!.getReader();
        activeReader = reader;
        let buffer = "";
        const consumeLine = (rawLine: string) => {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) return;
          const chunk = safeSseJson(line);
          if (!chunk) return;
          for (const event of normalizeProviderChunk(chunk, attempt.upstream.protocol)) {
            if (event.type === "delta") { assistantText += event.text; emit({ type: "delta", text: event.text }); }
            if (event.type === "usage") providerUsage = mergeProviderUsage(providerUsage, event);
          }
        };
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            lines.forEach(consumeLine);
          }
          buffer += decoder.decode();
          if (buffer.trim()) buffer.split("\n").forEach(consumeLine);
        } finally {
          reader.releaseLock();
          if (activeReader === reader) activeReader = null;
        }
      };

      try {
        emit({ type: "meta", conversationId, model: selected.id, modelName: selected.name, provider: billingAttempt.upstream.provider, tier: selected.tier, private: body.private });
        await consumeAttempt(billingAttempt);
        if (!assistantText.trim()) {
          throw new Error("Provider stream completed without response text; authoritative billing reconciliation is pending.");
        }

        if (!body.private && conversationId) {
          const { data: assistant, error: assistantError } = await admin.from("messages").insert({
            conversation_id: conversationId, user_id: user.id, role: "assistant", content: assistantText,
            model_id: selected.id, provider_key: billingAttempt.upstream.provider,
            input_tokens: Number(providerUsage.inputTokens), output_tokens: Number(providerUsage.outputTokens),
            credits_charged: 0,
            supplier_cost_usd: 0,
            internal_cost_pkr: 0,
            metadata: {
              deepThink: body.deepThink,
              billingQuoteId: billingAttempt.authorization.quoteId,
              billingStatus: "pending_reconciliation",
            },
          }).select("id").single();
          if (assistantError) throw assistantError;
          assistantMessageId = assistant?.id ?? null;
          await admin.from("conversations").update({ updated_at: new Date().toISOString(), preferred_model: selected.id }).eq("id", conversationId);
        }
        const settlement = await settleTextBillingAttempt({
          attempt: billingAttempt,
          usage: providerUsage,
          messageId: assistantMessageId,
          rawUsage: { protocol: billingAttempt.upstream.protocol, normalized: providerUsage },
          metadata: { operation: "chat", conversation_id: conversationId, private: body.private },
        });
        if (settlement.billingStatus === "pending_reconciliation") {
          const backgroundAttempt = billingAttempt;
          after(async () => {
            await settleTextBillingInBackground({
              attempt: backgroundAttempt,
              usage: providerUsage,
              messageId: assistantMessageId,
              rawUsage: { protocol: backgroundAttempt.upstream.protocol, normalized: providerUsage },
              metadata: { operation: "chat", conversation_id: conversationId, private: body.private },
            });
          });
        }
        finalized = true;
        const transactionId = settlement.walletTransactionId;
        const credits = settlement.billingStatus === "settled" ? Number(settlement.chargeCredits) : undefined;
        await finalizeRequest(claimId, "completed", { resourceId: assistantMessageId ?? conversationId, response: { credits, model: selected.id, transactionId } });
        emit({ type: "usage", credits, billingStatus: settlement.billingStatus, inputTokens: Number(providerUsage.inputTokens), outputTokens: Number(providerUsage.outputTokens), model: selected.name, transactionId, messageId: assistantMessageId });
        emit({ type: "done" });
      } catch (error) {
        if (!finalized) await cancelTextBillingAttempt(billingAttempt, "chat_stream_failed");
        await finalizeRequest(claimId, "failed").catch(() => undefined);
        logServerError("chat-stream", error, { userId: user.id, modelId: selected.id, conversationId });
        emit({ type: "error", error: "Chat stream interrupted. Please try again." });
      } finally {
        controller.close();
      }
    },
    async cancel() {
      await activeReader?.cancel().catch(() => undefined);
      await cancelTextBillingAttempt(billingAttempt, "client_cancelled");
      await finalizeRequest(claimId, "failed").catch(() => undefined);
    }
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", ...(conversationId ? { "X-Conversation-Id": conversationId } : {}) } });
}


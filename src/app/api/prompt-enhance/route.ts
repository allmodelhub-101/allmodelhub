import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { chooseRuntimeTextModel } from "@/lib/model-store";
import { mergeProviderUsage, normalizeProviderChunk } from "@/lib/providers/stream-normalizer";
import type { NormalizedProviderUsage } from "@/lib/providers/types";
import { enforceRateLimit } from "@/lib/rate-limit";
import { claimRequest, finalizeRequest } from "@/lib/idempotency";
import { logServerError } from "@/lib/public-error";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { beginTextBillingAttempt, cancelTextBillingAttempt, settleTextBillingAttempt, settleTextBillingInBackground } from "@/lib/billing/text-billing";

const schema = z.object({ requestId: z.string().uuid(), prompt: z.string().min(3).max(20_000) });
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isFeatureEnabled("prompt_enhancer"))) {
    return NextResponse.json({ error: "Prompt enhancement is currently unavailable." }, { status: 503 });
  }

  const rate = await enforceRateLimit(`enhance:${data.user.id}`, "prompt");
  if (rate.unavailable) return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 });
  if (!rate.success) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a prompt first." }, { status: 400 });

  const claim = await claimRequest(data.user.id, "prompt-enhance", parsed.data.requestId);
  if (!claim.claimed) return NextResponse.json({ error: "This prompt-enhancement request was already submitted." }, { status: 409 });
  const claimId = claim.id;

  const model = await chooseRuntimeTextModel({ tier: "budget", prompt: parsed.data.prompt });
  if (!model) {
    await finalizeRequest(claimId, "failed");
    return NextResponse.json({ error: "Prompt enhancement is temporarily unavailable." }, { status: 503 });
  }
  const messages = [
    {
      role: "system" as const,
      content:
        "Rewrite the user's prompt into a clearer, more specific, high-quality prompt. Preserve intent and factual details. Return only the improved prompt, no commentary."
    },
    { role: "user" as const, content: parsed.data.prompt }
  ];
  const joined = messages.map((message) => message.content).join("\n");
  let billingAttempt;
  try {
    billingAttempt = await beginTextBillingAttempt({
      userId: data.user.id, parentRequestId: claimId, modelId: model.id,
      textForReservation: joined, inputOverheadTokens: model.inputOverheadTokens,
      maxOutputTokens: 900, messages, allowFallback: true, operation: "prompt_enhancer",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Billing unavailable";
    await finalizeRequest(claimId, "failed");
    const insufficient = message.includes("INSUFFICIENT_CREDITS");
    const safety = message.includes("SPEND_LIMIT");
    if (!insufficient && !safety) logServerError("prompt-enhance-billing", error, { userId: data.user.id, modelId: model.id });
    return NextResponse.json({ error: insufficient ? "Insufficient credits." : safety ? "This request exceeds your spending safety limit." : "Prompt enhancement is temporarily unavailable." }, { status: insufficient ? 402 : safety ? 403 : 503 });
  }

  try {
    const upstream = billingAttempt.upstream;

    const reader = upstream.response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let usage: NormalizedProviderUsage = { providerRequestId: upstream.providerRequestId };
    const consumeLine = (raw: string) => {
      const line = raw.trim();
      if (!line.startsWith("data:")) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") return;
      let chunk: unknown;
      try { chunk = JSON.parse(payload); } catch { return; }
      for (const event of normalizeProviderChunk(chunk, upstream.protocol)) {
        if (event.type === "delta") text += event.text;
        if (event.type === "usage") usage = mergeProviderUsage(usage, event);
      }
    };

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

    if (!text.trim()) throw new Error("Prompt enhancer provider returned no text.");
    const settlement = await settleTextBillingAttempt({ attempt: billingAttempt, usage, rawUsage: { protocol: upstream.protocol, normalized: usage }, metadata: { operation: "prompt_enhancer" } });
    if (settlement.billingStatus === "pending_reconciliation") {
      const backgroundAttempt = billingAttempt;
      after(() => settleTextBillingInBackground({
        attempt: backgroundAttempt,
        usage,
        rawUsage: { protocol: upstream.protocol, normalized: usage },
        metadata: { operation: "prompt_enhancer" },
      }));
    }
    const credits = settlement.billingStatus === "settled" ? Number(settlement.chargeCredits) : undefined;
    await finalizeRequest(claimId, "completed", { resourceId: settlement.receiptId, response: { credits, model: model.id } });
    return NextResponse.json({ prompt: text.trim(), credits, billingStatus: settlement.billingStatus });
  } catch (error) {
    await cancelTextBillingAttempt(billingAttempt, "prompt_enhancer_failed");
    await finalizeRequest(claimId, "failed").catch(() => undefined);
    logServerError("prompt-enhance-provider", error, { userId: data.user.id, modelId: model.id });
    return NextResponse.json(
      { error: "Prompt enhancement is temporarily unavailable." },
      { status: 503 }
    );
  }
}


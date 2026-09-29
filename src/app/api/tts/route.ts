import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRuntimeModel } from "@/lib/model-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { claimRequest, finalizeRequest } from "@/lib/idempotency";
import { logServerError } from "@/lib/public-error";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { beginTtsBillingAttempt, cancelTtsBillingAttempt, settleTtsBillingAttempt } from "@/lib/billing/tts-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  requestId: z.string().uuid(),
  text: z.string().min(1).max(10_000),
  voiceId: z.string().min(2).max(120).default("EXAVITQu4vr4xnSDxMaL"),
  modelId: z.string().min(1).max(120).default("eleven-tts-flash"),
  confirmedCost: z.boolean().default(false)
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isFeatureEnabled("audio_studio"))) {
    return NextResponse.json({ error: "Audio generation is currently unavailable." }, { status: 503 });
  }

  const limit = await enforceRateLimit(`tts:${user.id}`, "tts");
  if (limit.unavailable) return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 });
  if (!limit.success) return NextResponse.json({ error: "Too many TTS requests." }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid TTS request." }, { status: 400 });
  const input = parsed.data;

  const claim = await claimRequest(user.id, "tts", input.requestId);
  if (!claim.claimed) return NextResponse.json({ error: "This voice request was already submitted." }, { status: 409 });
  const claimId = claim.id;

  const model = await getRuntimeModel(input.modelId);
  if (!model || model.modality !== "audio" || !model.capabilities.includes("tts")) {
    await finalizeRequest(claimId, "failed");
    return NextResponse.json({ error: "TTS model is unavailable." }, { status: 400 });
  }

  let billingAttempt;
  try {
    billingAttempt = await beginTtsBillingAttempt({ userId: user.id, parentRequestId: claimId, modelId: model.id, text: input.text, voiceId: input.voiceId, confirmedCost: input.confirmedCost });
    if (billingAttempt.engine === "v3_provider_authoritative") {
      const v3Attempt = billingAttempt;
      const source = v3Attempt.response.body!;
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const reader = source.getReader();
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            await settleTtsBillingAttempt({ attempt: v3Attempt, text: input.text });
            await finalizeRequest(claimId, "completed", {
              resourceId: v3Attempt.authorization.quoteId,
              response: { billingStatus: "provider_authoritative" },
            });
            controller.close();
          } catch (streamError) {
            await cancelTtsBillingAttempt(v3Attempt, "tts_stream_or_settlement_pending");
            logServerError("tts-v3-stream", streamError, { userId: user.id, modelId: model.id });
            controller.error(streamError);
          } finally {
            reader.releaseLock();
          }
        },
        async cancel() {
          await source.cancel().catch(() => undefined);
          await cancelTtsBillingAttempt(v3Attempt, "tts_client_cancelled");
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": v3Attempt.response.headers.get("content-type") || "audio/mpeg",
          "Cache-Control": "private, no-store",
          "X-AMH-Billing-Status": "provider-authoritative",
          "Content-Disposition": 'inline; filename="all-model-hub-voice.mp3"',
        },
      });
    }
    const settlement = await settleTtsBillingAttempt({ attempt: billingAttempt, text: input.text });
    const credits = Number(settlement.chargeCredits);
    await finalizeRequest(claimId, "completed", { resourceId: settlement.receiptId, response: { credits, transactionId: settlement.walletTransactionId } });
    const responseHeaders: Record<string, string> = {
      "Content-Type": billingAttempt.response.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "private, no-store",
      "X-AMH-Credits": credits.toString(),
      "Content-Disposition": 'inline; filename="all-model-hub-voice.mp3"',
    };
    if (settlement.receiptId) responseHeaders["X-AMH-Billing-Receipt"] = settlement.receiptId;
    return new Response(billingAttempt.response.body, {
      headers: responseHeaders,
    });
  } catch (error) {
    if (billingAttempt) await cancelTtsBillingAttempt(billingAttempt, "tts_exception");
    await finalizeRequest(claimId, "failed").catch(() => undefined);
    const message = error instanceof Error ? error.message : "TTS failed";
    if (message.startsWith("COST_CONFIRMATION_REQUIRED:")) {
      return NextResponse.json({ error: "Explicit cost confirmation is required for this voice generation.", estimatedCredits: Number(message.split(":")[1]) }, { status: 409 });
    }
    const insufficient = message.includes("INSUFFICIENT_CREDITS");
    const safety = message.includes("SPEND_LIMIT");
    if (!insufficient && !safety) logServerError("tts-request", error, { userId: user.id, modelId: model.id });
    return NextResponse.json({ error: insufficient ? "Insufficient credits." : safety ? "This request exceeds your spending safety limit." : "Voice generation is temporarily unavailable." }, { status: insufficient ? 402 : safety ? 403 : 500 });
  }
}


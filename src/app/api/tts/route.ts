import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRuntimeModel } from "@/lib/model-store";
import { estimateMediaCredits, getInternalUsdPkr } from "@/lib/pricing";
import { createWalletHold, captureWalletHold, releaseWalletHold } from "@/lib/wallet";
import { apimodelsTtsStream } from "@/lib/providers/apimodels";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSpendingAllowed } from "@/lib/spending";
import { claimRequest, finalizeRequest } from "@/lib/idempotency";
import { logServerError } from "@/lib/public-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  requestId: z.string().uuid(),
  text: z.string().min(1).max(10_000),
  voiceId: z.string().min(2).max(120).default("EXAVITQu4vr4xnSDxMaL"),
  modelId: z.literal("eleven-tts-flash").default("eleven-tts-flash"),
  confirmedCost: z.boolean().default(false)
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await enforceRateLimit(`tts:${user.id}`);
  if (!limit.success) return NextResponse.json({ error: "Too many TTS requests." }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid TTS request." }, { status: 400 });
  const input = parsed.data;

  const claim = await claimRequest(user.id, "tts", input.requestId);
  if (!claim.claimed) return NextResponse.json({ error: "This voice request was already submitted." }, { status: 409 });
  const claimId = claim.id;

  const model = await getRuntimeModel(input.modelId);
  if (!model || model.modality !== "audio") {
    await finalizeRequest(claimId, "failed");
    return NextResponse.json({ error: "TTS model is unavailable." }, { status: 400 });
  }

  const fxRate = await getInternalUsdPkr();
  const estimated = estimateMediaCredits(model, { textLength: input.text.length }, fxRate);
  if (estimated >= 50 && !input.confirmedCost) {
    await finalizeRequest(claimId, "failed");
    return NextResponse.json({ error: "Explicit cost confirmation is required for this voice generation.", estimatedCredits: estimated }, { status: 409 });
  }
  const reserve = Number((estimated * 1.05).toFixed(6));
  let holdId: string | null = null;

  try {
    await assertSpendingAllowed(user.id, reserve);
    holdId = await createWalletHold(user.id, reserve, `tts-hold:${user.id}:${input.requestId}`, { model_id: model.id, request_id: input.requestId });
    const response = await apimodelsTtsStream({ model: model.upstreamModel, text: input.text, voice_id: input.voiceId });
    if (!response.ok || !response.body) {
      await releaseWalletHold(holdId, `tts_http_${response.status}`);
      await finalizeRequest(claimId, "failed");
      return NextResponse.json({ error: "TTS provider request failed." }, { status: response.status >= 500 ? 502 : 400 });
    }

    const transactionId = await captureWalletHold(holdId, estimated, `tts-capture:${user.id}:${input.requestId}`, { model_id: model.id, characters: input.text.length });
    await finalizeRequest(claimId, "completed", { resourceId: transactionId, response: { credits: estimated } });
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "audio/mpeg",
        "Cache-Control": "private, no-store",
        "X-AMH-Credits": estimated.toString(),
        "Content-Disposition": 'inline; filename="all-model-hub-voice.mp3"'
      }
    });
  } catch (error) {
    if (holdId) await releaseWalletHold(holdId, "tts_exception").catch(() => undefined);
    await finalizeRequest(claimId, "failed").catch(() => undefined);
    const message = error instanceof Error ? error.message : "TTS failed";
    const insufficient = message.includes("INSUFFICIENT_CREDITS");
    const safety = message.includes("SPEND_LIMIT");
    if (!insufficient && !safety) logServerError("tts-request", error, { userId: user.id, modelId: model.id });
    return NextResponse.json({ error: insufficient ? "Insufficient credits." : safety ? "This request exceeds your spending safety limit." : "Voice generation is temporarily unavailable." }, { status: insufficient ? 402 : safety ? 403 : 500 });
  }
}

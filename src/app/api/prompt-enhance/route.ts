import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { chooseRuntimeTextModel } from "@/lib/model-store";
import { estimateTextHold, actualTextCredits, getInternalUsdPkr } from "@/lib/pricing";
import { providerChatStream } from "@/lib/providers";
import { normalizeProviderChunk } from "@/lib/providers/stream-normalizer";
import { createWalletHold, captureWalletHold, releaseWalletHold } from "@/lib/wallet";
import { createIdempotencyKey } from "@/lib/security/ids";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSpendingAllowed } from "@/lib/spending";
import { claimRequest, finalizeRequest } from "@/lib/idempotency";
import { logServerError } from "@/lib/public-error";

const schema = z.object({ requestId: z.string().uuid(), prompt: z.string().min(3).max(20_000) });
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await enforceRateLimit(`enhance:${data.user.id}`);
  if (!rate.success) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a prompt first." }, { status: 400 });

  const claim = await claimRequest(data.user.id, "prompt-enhance", parsed.data.requestId);
  if (!claim.claimed) return NextResponse.json({ error: "This prompt-enhancement request was already submitted." }, { status: 409 });
  const claimId = claim.id;

  const model = await chooseRuntimeTextModel({ tier: "budget", prompt: parsed.data.prompt });
  const messages = [
    {
      role: "system" as const,
      content:
        "Rewrite the user's prompt into a clearer, more specific, high-quality prompt. Preserve intent and factual details. Return only the improved prompt, no commentary."
    },
    { role: "user" as const, content: parsed.data.prompt }
  ];
  const joined = messages.map((message) => message.content).join("\n");
  const fxRate = await getInternalUsdPkr();
  const hold = estimateTextHold(model, joined, 900, fxRate);

  try {
    await assertSpendingAllowed(data.user.id, hold);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spending limit exceeded";
    await finalizeRequest(claimId, "failed");
    return NextResponse.json(
      {
        error: message.includes("DAILY_SPEND_LIMIT")
          ? "Prompt enhancement would exceed your daily spending limit."
          : "Prompt enhancement exceeds your single-generation spending limit."
      },
      { status: 403 }
    );
  }

  let holdId: string;
  try {
    holdId = await createWalletHold(
      data.user.id,
      hold,
      createIdempotencyKey("enhance-hold", data.user.id),
      { kind: "prompt_enhancer", model_id: model.id }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet error";
    await finalizeRequest(claimId, "failed");
    logServerError("prompt-enhance-wallet", error, { userId: data.user.id, modelId: model.id });
    const insufficient = message.includes("INSUFFICIENT_CREDITS");
    return NextResponse.json(
      { error: insufficient ? "Insufficient credits." : "Could not reserve credits." },
      { status: insufficient ? 402 : 500 }
    );
  }

  try {
    const upstream = await providerChatStream({
      modelId: model.id,
      upstreamModel: model.upstreamModel,
      messages,
      maxTokens: 900,
      allowFallback: true
    });
    if (!upstream.response.ok || !upstream.response.body) {
      throw new Error("Prompt enhancer provider unavailable.");
    }

    const reader = upstream.response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let chunk: unknown;
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }
        for (const event of normalizeProviderChunk(chunk, upstream.protocol)) {
          if (event.type === "delta") text += event.text;
          if (event.type === "usage") {
            if (event.inputTokens) inputTokens = event.inputTokens;
            if (event.outputTokens) outputTokens = event.outputTokens;
          }
        }
      }
    }

    if (!inputTokens) inputTokens = Math.ceil(joined.length / 3.4);
    if (!outputTokens) outputTokens = Math.max(1, Math.ceil(text.length / 3.4));
    const credits = Math.min(hold, actualTextCredits(model, inputTokens, outputTokens, fxRate));
    await captureWalletHold(
      holdId,
      credits,
      createIdempotencyKey("enhance-capture", data.user.id),
      { kind: "prompt_enhancer", model_id: model.id }
    );
    await finalizeRequest(claimId, "completed", { response: { credits, model: model.id } });
    return NextResponse.json({ prompt: text.trim(), credits });
  } catch (error) {
    await releaseWalletHold(holdId, "prompt_enhancer_failed").catch(() => undefined);
    await finalizeRequest(claimId, "failed").catch(() => undefined);
    logServerError("prompt-enhance-provider", error, { userId: data.user.id, modelId: model.id });
    return NextResponse.json(
      { error: "Prompt enhancement is temporarily unavailable." },
      { status: 503 }
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRuntimeModel } from "@/lib/model-store";
import { estimateMediaCredits, getInternalUsdPkr, mediaSupplierUsd } from "@/lib/pricing";
import { createWalletHold, releaseWalletHold } from "@/lib/wallet";
import { createIdempotencyKey, createPublicId } from "@/lib/security/ids";
import { providerCreateTask } from "@/lib/providers";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSpendingAllowed } from "@/lib/spending";
import { signedFileUrl } from "@/lib/file-extract";
import { claimRequest, finalizeRequest } from "@/lib/idempotency";
import { logServerError } from "@/lib/public-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  requestId: z.string().uuid(),
  modelId: z.string().min(1),
  prompt: z.string().min(1).max(20_000),
  duration: z.number().min(1).max(30).optional(),
  resolution: z.string().max(20).optional(),
  aspectRatio: z.string().max(20).optional(),
  imageFileIds: z.array(z.string().uuid()).max(10).default([]),
  mode: z.string().max(40).optional(),
  confirmedCost: z.boolean().default(false)
});

export async function POST(request: Request, context: { params: Promise<{ modality: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { modality } = await context.params;
  if (!["image", "video", "audio"].includes(modality)) return NextResponse.json({ error: "Invalid modality." }, { status: 404 });

  const limit = await enforceRateLimit(`generation:${modality}:${user.id}`);
  if (limit.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503 });
  if (!limit.success) return NextResponse.json({ error: "Too many generation requests." }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid generation request", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const claim = await claimRequest(user.id, `media:${modality}`, input.requestId);
  if (!claim.claimed) {
    return NextResponse.json({ error: "This generation request was already submitted.", existing: claim.existing }, { status: 409 });
  }
  const claimId = claim.id;
  const model = await getRuntimeModel(input.modelId);
  if (!model || model.modality !== modality) { await finalizeRequest(claimId, "failed"); return NextResponse.json({ error: "Model is not available for this studio." }, { status: 400 }); }

  if (modality === "audio" && model.id === "eleven-tts-flash") {
    await finalizeRequest(claimId, "failed");
    return NextResponse.json({ error: "Use the Text to Speech endpoint for Eleven Flash." }, { status: 400 });
  }

  const fxRate = await getInternalUsdPkr();
  const supplierCostUsd = mediaSupplierUsd(model, { duration: input.duration, textLength: input.prompt.length });
  const internalCostPkr = Number((supplierCostUsd * fxRate).toFixed(6));
  const estimated = estimateMediaCredits(model, { duration: input.duration, textLength: input.prompt.length }, fxRate);
  const requiresCostConfirmation = modality === "video" || estimated >= 50;
  if (requiresCostConfirmation && !input.confirmedCost) {
    await finalizeRequest(claimId, "failed");
    return NextResponse.json({ error: "Explicit cost confirmation is required for this generation.", estimatedCredits: estimated }, { status: 409 });
  }
  const reserve = Number((estimated * 1.08).toFixed(6));
  try { await assertSpendingAllowed(user.id, reserve); } catch (error) {
    const message = error instanceof Error ? error.message : "Spending limit exceeded";
    await finalizeRequest(claimId, "failed");
    return NextResponse.json({ error: message.includes("DAILY_SPEND_LIMIT") ? "This generation would exceed your daily spending limit." : "This generation exceeds your single-generation spending limit." }, { status: 403 });
  }

  const holdKey = createIdempotencyKey(`${modality}-hold`, user.id);
  let holdId: string;
  try {
    holdId = await createWalletHold(user.id, reserve, holdKey, { model_id: model.id, modality, estimated_credits: estimated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet error";
    await finalizeRequest(claimId, "failed");
    const insufficient = message.includes("INSUFFICIENT_CREDITS");
    if (!insufficient) logServerError("generation-wallet", error, { userId: user.id, modelId: model.id, modality });
    return NextResponse.json({ error: insufficient ? "Insufficient credits for this generation." : "Could not reserve credits for this generation." }, { status: insufficient ? 402 : 500 });
  }

  const admin = createAdminClient();
  let referenceImages: string[] = [];
  if (input.imageFileIds.length) {
    const { data: files, error: filesError } = await admin.from("user_files").select("id,storage_path,mime_type").eq("user_id", user.id).in("id", input.imageFileIds);
    if (filesError || (files ?? []).length !== input.imageFileIds.length) {
      await releaseWalletHold(holdId, "invalid_reference_files").catch(() => undefined);
      await finalizeRequest(claimId, "failed");
      return NextResponse.json({ error: "One or more reference images are unavailable." }, { status: 400 });
    }
    const imageFiles = (files ?? []).filter((file) => String(file.mime_type).startsWith("image/"));
    if (imageFiles.length !== (files ?? []).length) {
      await releaseWalletHold(holdId, "invalid_reference_file_type").catch(() => undefined);
      await finalizeRequest(claimId, "failed");
      return NextResponse.json({ error: "Reference files must be images." }, { status: 400 });
    }
    referenceImages = await Promise.all(imageFiles.map((file) => signedFileUrl(admin, file.storage_path)));
}

const baseUrl = (
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://allmodelhub-eta.vercel.app"
).replace(/\/+$/, "");
  
const callbackUrl = process.env.CALLBACK_SECRET
  ? `${baseUrl}/api/provider-callback/apimodels/${process.env.CALLBACK_SECRET}`
  : undefined;

console.info("[generation] callback url", callbackUrl);

const publicId = createPublicId("AMH-GEN");
  
  const providerBody: Record<string, unknown> = {
    model: model.upstreamModel,
    prompt: input.prompt,
    ...(input.duration ? { duration: input.duration } : {}),
    ...(input.resolution ? { resolution: input.resolution } : {}),
    ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
    ...(referenceImages.length ? { images: referenceImages } : {}),
    ...(callbackUrl ? { callback_url: callbackUrl } : {})
  };

  const { data: job, error: insertError } = await admin.from("generation_jobs").insert({
    public_id: publicId,
    user_id: user.id,
    modality,
    model_id: model.id,
    provider_key: "apimodels",
    status: "queued",
    prompt: input.prompt,
    request_json: providerBody,
    estimated_credits: estimated,
    reserved_credits: reserve,
    supplier_cost_usd: supplierCostUsd,
    internal_cost_pkr: internalCostPkr,
    hold_id: holdId
  }).select("id,public_id,status,estimated_credits,reserved_credits").single();

  if (insertError) {
    await releaseWalletHold(holdId, "job_insert_failed").catch(() => undefined);
    await finalizeRequest(claimId, "failed");
    logServerError("generation-job-insert", insertError, { userId: user.id, modelId: model.id, modality });
    return NextResponse.json({ error: "Could not create generation job." }, { status: 500 });
  }

  try {
    if (modality === "audio") throw new Error("Audio generation uses the TTS endpoint.");
    const result = await providerCreateTask({ modelId: model.id, modality: modality as "image" | "video", body: providerBody, allowFallback: true });
    const task = result.task;
    const { error: providerUpdateError } = await admin.from("generation_jobs").update({ provider_key: result.provider, provider_task_id: task.taskId, status: task.state === "processing" ? "processing" : "submitted", result_urls: task.resultUrls ?? [], result_json: task.raw, updated_at: new Date().toISOString() }).eq("id", job.id);
    console.info("[v0] generation provider request", JSON.stringify({ jobId: job.id, provider: result.provider, modality, taskId: task.taskId, state: task.state, outputUrlCount: task.resultUrls?.length ?? 0, databaseUpdateOk: !providerUpdateError, databaseError: providerUpdateError?.message }));
    if (providerUpdateError) throw providerUpdateError;
    await finalizeRequest(claimId, "completed", { resourceId: job.id, response: { publicId: job.public_id, status: task.state } });
    return NextResponse.json({ job: { ...job, status: "submitted", provider_key: result.provider, provider_task_id: task.taskId, providerTaskId: task.taskId, result_urls: task.resultUrls ?? [], result_json: task.raw }, requiresConfirmation: requiresCostConfirmation }, { status: 202 });
  } catch (error) {
    await releaseWalletHold(holdId, "provider_create_failed").catch(() => undefined);
    logServerError("generation-provider-create", error, { userId: user.id, modelId: model.id, modality, jobId: job.id });
    await admin.from("generation_jobs").update({ status: "failed", error_message: "Provider request failed", updated_at: new Date().toISOString() }).eq("id", job.id);
    await finalizeRequest(claimId, "failed", { resourceId: job.id });
    return NextResponse.json({ error: "Generation provider is temporarily unavailable." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelBillingQuoteReservation } from "@/lib/billing/quote-reservation";
import { mediaUsageFromRequest } from "@/lib/billing/media-job-billing-core";
import { resolveBillingProviderRoutes } from "@/lib/billing/provider-route";
import { signedFileUrl } from "@/lib/file-extract";
import { isFeatureEnabled, type FeatureKey } from "@/lib/feature-flags";
import { claimRequest, finalizeRequest } from "@/lib/idempotency";
import { getRuntimeModel } from "@/lib/model-store";
import { providerCreateTaskExact } from "@/lib/providers";
import { logServerError } from "@/lib/public-error";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createPublicId } from "@/lib/security/ids";
import { assertSpendingAllowed } from "@/lib/spending";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createProviderAuthorization } from "@/lib/billing/authorization";
import { markProviderSettlementPending, recordProviderBillingAnomaly } from "@/lib/billing/provider-authoritative-settlement";
import { getMediaExecutionContract, mediaProviderOptionPayload, referencePayload, validateMediaContractRequest } from "@/lib/media-execution-contract";
import { classifyMediaRuntimeFailure } from "@/lib/media-runtime-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  requestId: z.string().uuid(), projectId: z.string().uuid().optional(), modelId: z.string().min(1),
  prompt: z.string().min(1).max(20_000), duration: z.number().positive().max(600).optional(),
  inputDuration: z.number().nonnegative().max(3600).optional(), outputDuration: z.number().positive().max(3600).optional(),
  resolution: z.string().max(40).optional(), quality: z.string().max(40).optional(), fps: z.number().positive().max(240).optional(),
  imageCount: z.number().int().positive().max(20).default(1), aspectRatio: z.string().max(40).optional(),
  imageFileIds: z.array(z.string().uuid()).max(10).default([]), mode: z.string().max(40).optional(),
  nativeAudio: z.boolean().optional(), audioMode: z.string().max(40).optional(),
  voiceId: z.string().min(2).max(120).optional(), languageCode: z.string().min(2).max(12).optional(),
  voiceSpeed: z.number().min(0.7).max(2).optional(), confirmedCost: z.boolean().default(false),
});

const catalogOnlyModels = new Set(["real-esrgan", "flashvsr", "eleven-dialogue", "eleven-dubbing", "eleven-isolator"]);
const terminalFinancialError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("INSUFFICIENT_CREDITS") || message.includes("SPEND_LIMIT");
};

export async function POST(request: Request, context: { params: Promise<{ modality: string }> }) {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { modality } = await context.params;
  if (!["image", "video", "audio"].includes(modality)) return NextResponse.json({ error: "Invalid modality." }, { status: 404 });
  if (!(await isFeatureEnabled(`${modality}_studio` as FeatureKey))) return NextResponse.json({ error: `${modality} generation is currently unavailable.` }, { status: 503 });
  const limit = await enforceRateLimit(`generation:${modality}:${user.id}`, modality as "image" | "video" | "audio");
  if (limit.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503 });
  if (!limit.success) return NextResponse.json({ error: "Too many generation requests." }, { status: 429 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid generation request", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const claim = await claimRequest(user.id, `media:${modality}`, input.requestId);
  if (!claim.claimed) return NextResponse.json({ error: "This generation request was already submitted.", existing: claim.existing }, { status: 409 });
  const model = await getRuntimeModel(input.modelId);
  const modelContract = model ? getMediaExecutionContract(model.id) : undefined;
  const asyncTts = modality === "audio" && modelContract?.strategy === "apimodels_audio_async";
  if (!model || model.modality !== modality || catalogOnlyModels.has(model.id) || (modality === "audio" && model.capabilities.includes("tts") && !asyncTts)) {
    await finalizeRequest(claim.id, "failed");
    return NextResponse.json({ error: "Model is not available for this studio." }, { status: 400 });
  }
  if (model.id === "kling-tts" && Array.from(input.prompt).length > 1000) {
    await finalizeRequest(claim.id, "failed");
    return NextResponse.json({ error: "Kling TTS supports up to 1,000 characters." }, { status: 400 });
  }
  const admin = createAdminClient();
  if (input.projectId) {
    const { data: project } = await admin.from("projects").select("id").eq("id", input.projectId).eq("user_id", user.id).maybeSingle();
    if (!project) { await finalizeRequest(claim.id, "failed"); return NextResponse.json({ error: "Project is unavailable." }, { status: 400 }); }
  }
  let referenceImages: string[] = [];
  if (input.imageFileIds.length) {
    const { data: files, error } = await admin.from("user_files").select("id,storage_path,mime_type").eq("user_id", user.id).in("id", input.imageFileIds);
    if (error || (files ?? []).length !== input.imageFileIds.length || (files ?? []).some((file) => !String(file.mime_type).startsWith("image/"))) {
      await finalizeRequest(claim.id, "failed");
      return NextResponse.json({ error: "One or more reference images are unavailable or invalid." }, { status: 400 });
    }
    referenceImages = await Promise.all((files ?? []).map((file) => signedFileUrl(admin, file.storage_path)));
  }
  const mode = input.mode ?? input.audioMode;
  const aspectRatio = modality === "audio" ? undefined : input.aspectRatio;
  const contract = modelContract;
  if (!contract || contract.modality !== modality) {
    await finalizeRequest(claim.id, "failed");
    return NextResponse.json({ error: "This model workflow is not supported yet." }, { status: 400 });
  }
  const effectiveQuality = input.quality ?? contract.defaultQuality;
  try {
    validateMediaContractRequest(contract, { referenceCount: referenceImages.length, resolution: input.resolution,
      quality: effectiveQuality, duration: input.duration, aspectRatio, nativeAudio: input.nativeAudio });
  } catch {
    await finalizeRequest(claim.id, "failed");
    return NextResponse.json({ error: "One or more selected model options are unsupported." }, { status: 400 });
  }
  const providerAspectRatio = contract.aspectRatios?.length ? aspectRatio : undefined;
  const pricingMode = modality === "video" && contract.nativeAudio ? (input.nativeAudio ? "native_audio" : "silent") : mode;
  const usage = {
    ...mediaUsageFromRequest({ ...input, quality: effectiveQuality, imageCount: modality === "audio" ? 0 : input.imageCount,
      aspectRatio: providerAspectRatio, mode: modality === "image" ? undefined : pricingMode, referenceCount: input.imageFileIds.length }),
    inputType: (referenceImages.length ? "image" : "text") as "image" | "text",
  };
  const dimensions = { resolution: input.resolution, quality: effectiveQuality, mode: pricingMode, inputType: referenceImages.length ? "image" : "text" };
  const storedRequest = { ...input, imageCount: modality === "audio" ? 0 : input.imageCount,
    aspectRatio: providerAspectRatio, mode, referenceCount: input.imageFileIds.length };
  const publicId = createPublicId("AMH-GEN");
  const { data: job, error: insertError } = await admin.from("generation_jobs").insert({
    public_id: publicId, user_id: user.id, project_id: input.projectId ?? null, modality, model_id: model.id,
    status: "queued", prompt: input.prompt, request_json: storedRequest,
  }).select("id,public_id,status,estimated_credits,reserved_credits").single();
  if (insertError || !job) { await finalizeRequest(claim.id, "failed"); return NextResponse.json({ error: "Could not create generation job." }, { status: 500 }); }

  let lastError: unknown = new Error("No billable provider route is available.");
  let providerSubmissionPending = false;
  try {
    for (const route of await resolveBillingProviderRoutes(model.id)) {
      const attemptClaim = await claimRequest(user.id, `billing-v3:media:${claim.id}`, route.routeId);
      if (!attemptClaim.claimed) continue;
      let authorization: Awaited<ReturnType<typeof createProviderAuthorization>> | null = null;
      let providerStarted = false;
      let providerTaskId: string | undefined;
      try {
        authorization = await createProviderAuthorization({
          userId: user.id, requestIdempotencyId: attemptClaim.id, route, modality,
          usageEnvelope: usage, dimensions, options: storedRequest,
          metadata: { operation: `${modality}_generation`, parent_request_id: claim.id, generation_job_id: job.id },
        });
        const authorizationCredits = authorization.authorizationCredits;
        const estimated = 0;
        const requiresConfirmation = modality === "video" || Number(authorizationCredits) >= 50;
        if (requiresConfirmation && !input.confirmedCost) {
          await cancelBillingQuoteReservation(authorization.quoteId, "cost_confirmation_required");
          await finalizeRequest(attemptClaim.id, "failed"); await finalizeRequest(claim.id, "failed", { resourceId: job.id });
          await admin.from("generation_jobs").update({ status: "failed", error_message: "Cost confirmation required" }).eq("id", job.id);
          return NextResponse.json({ error: "Explicit cost confirmation is required for this generation.", estimatedCredits: estimated }, { status: 409 });
        }
        await assertSpendingAllowed(user.id, authorizationCredits);
        await admin.from("generation_jobs").update({
          provider_key: route.providerKey, billing_quote_id: authorization.quoteId,
          hold_id: authorization.walletHoldId,
          estimated_credits: estimated, reserved_credits: Number(authorizationCredits),
          supplier_cost_usd: 0,
          internal_cost_pkr: 0,
        }).eq("id", job.id);
        const callbackBase = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
        const isApiModels = route.providerKey.toLowerCase().replace(/[-_.]/g, "") === "apimodels";
        const callbackUrl = isApiModels && process.env.CALLBACK_SECRET ? `${callbackBase}/api/provider-callback/apimodels/${process.env.CALLBACK_SECRET}` : undefined;
        const providerBody: Record<string, unknown> = {
          prompt: input.prompt,
          ...(input.inputDuration !== undefined ? { input_duration: input.inputDuration } : {}), ...(input.outputDuration !== undefined ? { output_duration: input.outputDuration } : {}),
          ...(effectiveQuality ? { quality: effectiveQuality } : {}), ...(input.fps ? { fps: input.fps } : {}),
          ...(input.imageCount !== 1 ? { n: input.imageCount } : {}),
          ...mediaProviderOptionPayload(contract, { duration: input.duration, resolution: input.resolution,
            aspectRatio: providerAspectRatio, nativeAudio: input.nativeAudio }),
          ...(modality === "audio" && mode ? { mode } : {}),
          ...referencePayload(contract, referenceImages), ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        };
        if (model.id === "kling-tts") {
          if (!input.voiceId || !input.languageCode) throw new Error("MEDIA_OPTION_UNSUPPORTED:voice");
          delete providerBody.prompt;
          Object.assign(providerBody, { text: input.prompt, voice_id: input.voiceId,
            voice_language: input.languageCode, voice_speed: input.voiceSpeed ?? 1 });
        }
        const task = (await providerCreateTaskExact(route, modality as "image" | "video" | "audio", providerBody)).task;
        providerTaskId = task.taskId;
        if (!task.taskId) throw new Error("BILLING_V3_PROVIDER_TASK_ID_MISSING");
        providerStarted = true;
        providerSubmissionPending = true;
        await markProviderSettlementPending({ quoteId: authorization.quoteId,
          providerTaskId: task.taskId, source: "response_header", links: { generationJobId: job.id } });
        const status = task.state === "processing" ? "processing" : "submitted";
        await admin.from("generation_jobs").update({ provider_task_id: task.taskId, status, result_json: { provider_state: task.state, result_url_count: task.resultUrls?.length ?? 0 }, updated_at: new Date().toISOString() }).eq("id", job.id);
        await finalizeRequest(attemptClaim.id, "completed", { resourceId: job.id,
          response: { quoteId: authorization.quoteId, billingStatus: "pending_reconciliation" } });
        await finalizeRequest(claim.id, "completed", { resourceId: job.id, response: { publicId: job.public_id, status } });
        return NextResponse.json({ job: { ...job, status, estimated_credits: estimated,
          reserved_credits: Number(authorizationCredits) }, requiresConfirmation }, { status: 202 });
      } catch (error) {
        lastError = error;
        if (authorization && providerStarted) {
          if (providerTaskId) {
            await markProviderSettlementPending({ quoteId: authorization.quoteId,
              providerTaskId, source: "response_header", links: { generationJobId: job.id } }).catch(() => undefined);
          } else {
            await recordProviderBillingAnomaly({ quoteId: authorization.quoteId,
              anomalyType: "provider_record_missing_identifier",
              details: { operation: `${modality}_generation`, generation_job_id: job.id, hold_retained: true } }).catch(() => undefined);
          }
        }
        if (!providerStarted) {
          if (authorization) await cancelBillingQuoteReservation(authorization.quoteId, "media_provider_attempt_failed").catch(() => undefined);
        }
        await finalizeRequest(attemptClaim.id, providerStarted ? "completed" : "failed", providerStarted
          ? { resourceId: job.id, response: { billingStatus: "pending_reconciliation" } } : undefined).catch(() => undefined);
        if (providerStarted) throw error;
        if (terminalFinancialError(error)) throw error;
      }
    }
    throw lastError;
  } catch (error) {
    const publicFailure = classifyMediaRuntimeFailure(error, providerSubmissionPending);
    await admin.from("generation_jobs").update(providerSubmissionPending
      ? { status: "processing", error_message: "Provider billing reconciliation pending.",
          reconciliation_required: true, reconciliation_state: "due", next_reconcile_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      : { status: "failed", error_message: publicFailure.message, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    await finalizeRequest(claim.id, providerSubmissionPending ? "completed" : "failed", { resourceId: job.id,
      response: providerSubmissionPending ? { billingStatus: "pending_reconciliation" } : undefined }).catch(() => undefined);
    if (!["insufficient_credits", "spending_limit"].includes(publicFailure.category)) {
      logServerError("generation-billing-v3", error, { userId: user.id, modelId: model.id, modality, jobId: job.id,
        failureCategory: publicFailure.category });
    }
    return NextResponse.json({ error: publicFailure.message }, { status: publicFailure.status });
  }
}

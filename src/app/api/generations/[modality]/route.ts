import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptBillingQuote, cancelBillingQuoteReservation, createAndReserveBillingQuote } from "@/lib/billing/quote-reservation";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  requestId: z.string().uuid(), projectId: z.string().uuid().optional(), modelId: z.string().min(1),
  prompt: z.string().min(1).max(20_000), duration: z.number().positive().max(600).optional(),
  inputDuration: z.number().nonnegative().max(3600).optional(), outputDuration: z.number().positive().max(3600).optional(),
  resolution: z.string().max(40).optional(), quality: z.string().max(40).optional(), fps: z.number().positive().max(240).optional(),
  imageCount: z.number().int().positive().max(20).default(1), aspectRatio: z.string().max(40).optional(),
  imageFileIds: z.array(z.string().uuid()).max(10).default([]), mode: z.string().max(40).optional(),
  nativeAudio: z.boolean().optional(), audioMode: z.string().max(40).optional(), confirmedCost: z.boolean().default(false),
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
  if (!model || model.modality !== modality || catalogOnlyModels.has(model.id) || (modality === "audio" && model.capabilities.includes("tts"))) {
    await finalizeRequest(claim.id, "failed");
    return NextResponse.json({ error: "Model is not available for this studio." }, { status: 400 });
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
  const usage = mediaUsageFromRequest({ ...input, mode, referenceCount: input.imageFileIds.length });
  const dimensions = { resolution: input.resolution, quality: input.quality, mode, inputType: referenceImages.length ? "image" : "text" };
  const storedRequest = { ...input, mode, referenceCount: input.imageFileIds.length };
  const publicId = createPublicId("AMH-GEN");
  const { data: job, error: insertError } = await admin.from("generation_jobs").insert({
    public_id: publicId, user_id: user.id, project_id: input.projectId ?? null, modality, model_id: model.id,
    status: "queued", prompt: input.prompt, request_json: storedRequest,
  }).select("id,public_id,status,estimated_credits,reserved_credits").single();
  if (insertError || !job) { await finalizeRequest(claim.id, "failed"); return NextResponse.json({ error: "Could not create generation job." }, { status: 500 }); }

  let lastError: unknown = new Error("No billable provider route is available.");
  try {
    for (const route of await resolveBillingProviderRoutes(model.id)) {
      const attemptClaim = await claimRequest(user.id, `billing-v2:media:${claim.id}`, route.routeId);
      if (!attemptClaim.claimed) continue;
      let quote: Awaited<ReturnType<typeof createAndReserveBillingQuote>> | null = null;
      try {
        quote = await createAndReserveBillingQuote({
          userId: user.id, requestIdempotencyId: attemptClaim.id, modelId: model.id, providerKey: route.providerKey,
          kind: "deterministic", estimatedUsage: usage, dimensions, options: storedRequest,
          metadata: { operation: `${modality}_generation`, parent_request_id: claim.id, generation_job_id: job.id },
        });
        const estimated = Number(quote.estimatedCustomerChargeCredits);
        const requiresConfirmation = modality === "video" || estimated >= 50;
        if (requiresConfirmation && !input.confirmedCost) {
          await cancelBillingQuoteReservation(quote.quoteId, "cost_confirmation_required");
          await finalizeRequest(attemptClaim.id, "failed"); await finalizeRequest(claim.id, "failed", { resourceId: job.id });
          await admin.from("generation_jobs").update({ status: "failed", error_message: "Cost confirmation required" }).eq("id", job.id);
          return NextResponse.json({ error: "Explicit cost confirmation is required for this generation.", estimatedCredits: estimated }, { status: 409 });
        }
        await assertSpendingAllowed(user.id, quote.reservationCredits);
        await acceptBillingQuote(quote.quoteId);
        await admin.from("generation_jobs").update({
          provider_key: route.providerKey, billing_quote_id: quote.quoteId, hold_id: quote.walletHoldId,
          estimated_credits: estimated, reserved_credits: Number(quote.reservationCredits), supplier_cost_usd: Number(quote.estimatedProviderCostUsd),
          internal_cost_pkr: Number(quote.estimatedProviderCostUsd) * Number(quote.pricing.internalUsdPkrRate),
        }).eq("id", job.id);
        const callbackBase = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
        const isApiModels = route.providerKey.toLowerCase().replace(/[-_.]/g, "") === "apimodels";
        const callbackUrl = isApiModels && process.env.CALLBACK_SECRET ? `${callbackBase}/api/provider-callback/apimodels/${process.env.CALLBACK_SECRET}` : undefined;
        const providerBody: Record<string, unknown> = {
          prompt: input.prompt, ...(input.duration ? { duration: input.duration } : {}),
          ...(input.inputDuration !== undefined ? { input_duration: input.inputDuration } : {}), ...(input.outputDuration !== undefined ? { output_duration: input.outputDuration } : {}),
          ...(input.resolution ? { resolution: input.resolution } : {}), ...(input.quality ? { quality: input.quality } : {}), ...(input.fps ? { fps: input.fps } : {}),
          ...(input.imageCount !== 1 ? { n: input.imageCount } : {}), ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
          ...(mode ? { mode } : {}), ...(input.nativeAudio !== undefined ? { native_audio: input.nativeAudio } : {}),
          ...(referenceImages.length ? { images: referenceImages } : {}), ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        };
        const task = (await providerCreateTaskExact(route, modality as "image" | "video" | "audio", providerBody)).task;
        const status = task.state === "processing" ? "processing" : "submitted";
        await admin.from("generation_jobs").update({ provider_task_id: task.taskId, status, result_json: { provider_state: task.state, result_url_count: task.resultUrls?.length ?? 0 }, updated_at: new Date().toISOString() }).eq("id", job.id);
        await finalizeRequest(attemptClaim.id, "completed", { resourceId: job.id, response: { quoteId: quote.quoteId } });
        await finalizeRequest(claim.id, "completed", { resourceId: job.id, response: { publicId: job.public_id, status } });
        return NextResponse.json({ job: { ...job, status, estimated_credits: estimated, reserved_credits: Number(quote.reservationCredits) }, requiresConfirmation }, { status: 202 });
      } catch (error) {
        lastError = error;
        if (quote) await cancelBillingQuoteReservation(quote.quoteId, "media_provider_attempt_failed").catch(() => undefined);
        await finalizeRequest(attemptClaim.id, "failed").catch(() => undefined);
        if (terminalFinancialError(error)) throw error;
      }
    }
    throw lastError;
  } catch (error) {
    await admin.from("generation_jobs").update({ status: "failed", error_message: "Generation provider is temporarily unavailable.", updated_at: new Date().toISOString() }).eq("id", job.id);
    await finalizeRequest(claim.id, "failed", { resourceId: job.id }).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Generation failed";
    const insufficient = message.includes("INSUFFICIENT_CREDITS"); const safety = message.includes("SPEND_LIMIT");
    if (!insufficient && !safety) logServerError("generation-billing-v2", error, { userId: user.id, modelId: model.id, modality, jobId: job.id });
    return NextResponse.json({ error: insufficient ? "Insufficient credits for this generation." : safety ? "This generation exceeds your spending safety limit." : "Generation provider is temporarily unavailable." }, { status: insufficient ? 402 : safety ? 403 : 502 });
  }
}

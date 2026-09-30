import { NextResponse } from "next/server";
import { z } from "zod";
import { previewProviderAuthorization } from "@/lib/billing/authorization";
import { mediaUsageFromRequest } from "@/lib/billing/media-job-billing-core";
import { resolveBillingProviderRoutes } from "@/lib/billing/provider-route";
import { getRuntimeModel } from "@/lib/model-store";
import { getMediaExecutionContract, validateMediaContractRequest } from "@/lib/media-execution-contract";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  modelId: z.string().min(1),
  prompt: z.string().min(1).max(20_000),
  duration: z.number().positive().max(600).optional(),
  resolution: z.string().max(40).optional(),
  aspectRatio: z.string().max(40).optional(),
  nativeAudio: z.boolean().optional(),
  imageFileIds: z.array(z.string().uuid()).max(10).default([]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid video configuration." }, { status: 400 });
  const input = parsed.data;
  const model = await getRuntimeModel(input.modelId);
  const contract = model ? getMediaExecutionContract(model.id) : undefined;
  if (!model || model.modality !== "video" || !contract || contract.modality !== "video") {
    return NextResponse.json({ error: "This video model is not available." }, { status: 400 });
  }
  const admin = createAdminClient();
  if (input.imageFileIds.length) {
    const { data, error } = await admin.from("user_files").select("id,mime_type")
      .eq("user_id", auth.user.id).in("id", input.imageFileIds);
    if (error || (data ?? []).length !== input.imageFileIds.length || (data ?? []).some((file) => !String(file.mime_type).startsWith("image/"))) {
      return NextResponse.json({ error: "One or more reference images are unavailable or invalid." }, { status: 400 });
    }
  }
  try {
    validateMediaContractRequest(contract, {
      referenceCount: input.imageFileIds.length,
      duration: input.duration,
      resolution: input.resolution,
      aspectRatio: input.aspectRatio,
      nativeAudio: input.nativeAudio,
    });
    const usage = {
      ...mediaUsageFromRequest({
        modality: "video", prompt: input.prompt, duration: input.duration,
        resolution: input.resolution, aspectRatio: input.aspectRatio,
        nativeAudio: input.nativeAudio, referenceCount: input.imageFileIds.length,
      }),
      inputType: (input.imageFileIds.length ? "image" : "text") as "image" | "text",
    };
    const dimensions = {
      resolution: input.resolution,
      inputType: input.imageFileIds.length ? "image" : "text",
    };
    const routes = await resolveBillingProviderRoutes(model.id);
    let lastError: unknown = new Error("No provider route can authorize this configuration.");
    for (const route of routes) {
      try {
        const preview = await previewProviderAuthorization({ route, modality: "video", usageEnvelope: usage, dimensions });
        return NextResponse.json({
          maximumAuthorizationCredits: preview.authorizationCredits,
          configuration: { modelId: model.id, duration: input.duration, resolution: input.resolution,
            aspectRatio: input.aspectRatio, referenceImages: input.imageFileIds.length },
          confirmationRequired: true,
          expiresInSeconds: preview.expiresInSeconds,
        });
      } catch (error) { lastError = error; }
    }
    throw lastError;
  } catch {
    return NextResponse.json({ error: "This video configuration cannot be safely authorized." }, { status: 400 });
  }
}

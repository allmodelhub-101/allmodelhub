import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generationInputSchema, prepareMediaRequest } from "@/lib/media-request";
import { getRuntimeModel } from "@/lib/model-store";
import { resolveBillingProviderRoutes } from "@/lib/billing/provider-route";
import { preflightProviderAuthorization } from "@/lib/billing/authorization";
import { classifyMediaRuntimeFailure } from "@/lib/media-runtime-error";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isFeatureEnabled } from "@/lib/feature-flags";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = (await (await createClient()).auth.getUser()).data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isFeatureEnabled("video_studio"))) return NextResponse.json({ error: "Video generation is currently unavailable." }, { status: 503 });
  const limit = await enforceRateLimit(`preflight:${user.id}`, "preflight");
  if (limit.unavailable || !limit.success) return NextResponse.json({ error: "Please try again shortly." }, { status: 429 });
  const parsed = generationInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid generation options." }, { status: 400 });
  try {
    const model = await getRuntimeModel(parsed.data.modelId);
    if (!model || model.modality !== "video") throw new Error("MEDIA_ADAPTER_UNAVAILABLE");
    const prepared = await prepareMediaRequest(user.id, parsed.data, "video");
    let lastError: unknown;
    for (const route of await resolveBillingProviderRoutes(model.id)) {
      try {
        const quote = await preflightProviderAuthorization({ route, modality: "video", usageEnvelope: prepared.usage, dimensions: prepared.dimensions });
        return NextResponse.json({ estimatedCredits: quote.estimatedCredits,
          authorizationCredits: quote.authorizationCredits, pricingVersion: quote.pricingVersion,
          policyVersion: quote.policy.policy_version }, { headers: { "Cache-Control": "private, no-store" } });
      } catch (error) { lastError = error; }
    }
    throw lastError ?? new Error("BILLING_V3_AUTHORIZATION_POLICY_UNAVAILABLE");
  } catch (error) {
    const failure = classifyMediaRuntimeFailure(error);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}


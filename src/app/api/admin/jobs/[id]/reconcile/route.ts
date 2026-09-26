import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { notifyUser } from "@/lib/notifications";
import { providerPollTask } from "@/lib/providers";
import { logServerError } from "@/lib/public-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeMediaGenerationBilling, failMediaGenerationBilling } from "@/lib/billing/media-job-billing";
import { mediaUsageFromRequest, normalizeMediaResult, providerFailureIsNonBillable, type MediaBillingInput } from "@/lib/billing/media-job-billing-core";
import { assertTrustedAssetUrl, persistGeneratedAssets } from "@/lib/generated-assets";
import { enforceRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const limit = await enforceRateLimit(`admin-reconcile:${actor.id}`, "admin");
  if (limit.unavailable) return NextResponse.json({ error: "Administrative rate limiting is unavailable." }, { status: 503 });
  if (!limit.success) return NextResponse.json({ error: "Too many reconciliation requests." }, { status: 429 });
  const admin = createAdminClient();
  const { data: job, error } = await admin.from("generation_jobs").select("*").eq("id", id).maybeSingle();
  if (error) { logServerError("admin-job-reconcile-read", error, { actorId: actor.id, jobId: id }); return NextResponse.json({ error: "Could not load job." }, { status: 500 }); }
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (["completed", "failed", "cancelled", "expired"].includes(job.status)) return NextResponse.json({ job, message: `${job.public_id} is already final.` });
  if (!job.provider_key || !job.provider_task_id) return NextResponse.json({ error: "This job has no provider task to reconcile." }, { status: 409 });

  try {
    const task = await providerPollTask({ provider: job.provider_key, modality: job.modality, taskId: job.provider_task_id });
    const summary = { provider_state: task.state, result_url_count: task.resultUrls?.length ?? 0 };
    if (task.state === "completed") {
      const resultUrls = (task.resultUrls ?? []).slice(0, 20);
      await Promise.all(resultUrls.map((url) => assertTrustedAssetUrl(url)));
      if (!resultUrls.length) return NextResponse.json({ error: "Provider reports completion without a trusted result." }, { status: 409 });
      const storedPaths = await persistGeneratedAssets(job.user_id, job.id, resultUrls);
      if (!job.billing_quote_id) return NextResponse.json({ error: "This legacy job requires legacy reconciliation." }, { status: 409 });
      const { data: claimed } = await admin.from("generation_jobs").update({ status: "settling", updated_at: new Date().toISOString() })
        .eq("id", job.id).in("status", ["queued", "submitted", "processing"]).select("id").maybeSingle();
      if (!claimed) return NextResponse.json({ error: "The job is already being settled." }, { status: 409 });
      const fallback = mediaUsageFromRequest({ ...(job.request_json ?? {}), prompt: String(job.prompt ?? "") } as MediaBillingInput);
      await completeMediaGenerationBilling({ jobId: job.id, normalized: normalizeMediaResult(task, fallback),
        resultJson: { ...summary, amhStoredPaths: storedPaths }, resultUrls, metadata: { source: "admin_reconciliation", actor_id: actor.id } });
      await notifyUser(job.user_id, { type: "generation", title: "Generation complete", body: `${job.public_id} is ready.`, href: `/usage?job=${job.id}` });
    } else if (task.state === "failed") {
      if (!job.billing_quote_id || !providerFailureIsNonBillable(job.provider_key)) return NextResponse.json({ error: "Provider failure billing requires manual reconciliation." }, { status: 409 });
      await failMediaGenerationBilling({ jobId: job.id, providerState: "failed", errorMessage: task.failMsg || "Provider reported failure",
        rawUsage: (task.raw && typeof task.raw === "object" ? task.raw : {}) as Record<string, unknown>, metadata: { source: "admin_reconciliation", actor_id: actor.id } });
      await notifyUser(job.user_id, { type: "generation", title: "Generation failed", body: `${job.public_id} failed and its wallet hold was released.`, href: "/usage" });
    } else {
      await admin.from("generation_jobs").update({ status: task.state === "processing" ? "processing" : "submitted", result_json: summary, updated_at: new Date().toISOString() }).eq("id", job.id);
    }
    await admin.from("audit_logs").insert({ actor_user_id: actor.id, action: "generation_job.reconciled", entity_type: "generation_job", entity_id: job.id, metadata: { provider_state: task.state } });
    const { data: updated } = await admin.from("generation_jobs").select("*").eq("id", job.id).single();
    return NextResponse.json({ job: updated, message: task.state === "completed" ? "Completed and charged exactly once." : task.state === "failed" ? "Failed and released the hold." : `Provider still reports ${task.state}; the hold remains active.` });
  } catch (pollError) {
    logServerError("admin-job-reconcile-provider", pollError, { actorId: actor.id, jobId: id, provider: job.provider_key });
    return NextResponse.json({ error: "Provider status could not be verified. The job and hold were left unchanged." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { notifyUser } from "@/lib/notifications";
import { providerPollTask } from "@/lib/providers";
import { logServerError } from "@/lib/public-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeGenerationJob, releaseWalletHold } from "@/lib/wallet";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: job, error } = await admin.from("generation_jobs").select("*").eq("id", id).maybeSingle();
  if (error) { logServerError("admin-job-reconcile-read", error, { actorId: actor.id, jobId: id }); return NextResponse.json({ error: "Could not load job." }, { status: 500 }); }
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (["completed", "failed", "cancelled", "expired"].includes(job.status)) return NextResponse.json({ job, message: `${job.public_id} is already final.` });
  if (!job.provider_key || !job.provider_task_id) return NextResponse.json({ error: "This job has no provider task to reconcile." }, { status: 409 });

  try {
    const task = await providerPollTask({ provider: job.provider_key, modality: job.modality, taskId: job.provider_task_id });
    if (task.state === "completed") {
      await completeGenerationJob({ jobId: job.id, chargedCredits: Number(job.estimated_credits), resultJson: (task.raw ?? {}) as Record<string, unknown>, resultUrls: task.resultUrls ?? [], metadata: { source: "admin_reconciliation", actor_id: actor.id } });
      await notifyUser(job.user_id, { type: "generation", title: "Generation complete", body: `${job.public_id} is ready.`, href: `/usage?job=${job.id}` });
    } else if (task.state === "failed") {
      if (job.hold_id) await releaseWalletHold(job.hold_id, "provider_failed_after_reconciliation");
      await admin.from("generation_jobs").update({ status: "failed", error_message: task.failMsg || "Provider reported failure", result_json: task.raw, updated_at: new Date().toISOString() }).eq("id", job.id);
      await notifyUser(job.user_id, { type: "generation", title: "Generation failed", body: `${job.public_id} failed and its wallet hold was released.`, href: "/usage" });
    } else {
      await admin.from("generation_jobs").update({ status: task.state === "processing" ? "processing" : "submitted", result_json: task.raw, updated_at: new Date().toISOString() }).eq("id", job.id);
    }
    await admin.from("audit_logs").insert({ actor_user_id: actor.id, action: "generation_job.reconciled", entity_type: "generation_job", entity_id: job.id, metadata: { provider_state: task.state } });
    const { data: updated } = await admin.from("generation_jobs").select("*").eq("id", job.id).single();
    return NextResponse.json({ job: updated, message: task.state === "completed" ? "Completed and charged exactly once." : task.state === "failed" ? "Failed and released the hold." : `Provider still reports ${task.state}; the hold remains active.` });
  } catch (pollError) {
    logServerError("admin-job-reconcile-provider", pollError, { actorId: actor.id, jobId: id, provider: job.provider_key });
    return NextResponse.json({ error: "Provider status could not be verified. The job and hold were left unchanged." }, { status: 502 });
  }
}

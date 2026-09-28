import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logServerError } from "@/lib/public-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileGenerationJob, type ReconciliationJob } from "@/lib/billing/reconciliation";
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
    const result = await reconcileGenerationJob(job as ReconciliationJob);
    await admin.from("audit_logs").insert({ actor_user_id: actor.id, action: "generation_job.reconciled", entity_type: "generation_job", entity_id: job.id, metadata: result });
    const { data: updated } = await admin.from("generation_jobs").select("*").eq("id", job.id).single();
    return NextResponse.json({ job: updated, message: `Reconciliation outcome: ${result.outcome}.` });
  } catch (pollError) {
    logServerError("admin-job-reconcile-provider", pollError, { actorId: actor.id, jobId: id, provider: job.provider_key });
    return NextResponse.json({ error: "Provider status could not be verified. The job and hold were left unchanged." }, { status: 502 });
  }
}

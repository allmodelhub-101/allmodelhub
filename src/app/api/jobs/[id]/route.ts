import { NextResponse } from "next/server";
import { z } from "zod";
import { assertTrustedAssetUrl, persistGeneratedAssets, signGeneratedPaths } from "@/lib/generated-assets";
import { notifyUser } from "@/lib/notifications";
import { providerPollTask } from "@/lib/providers";
import { logServerError } from "@/lib/public-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeMediaGenerationBilling, completeProviderAuthoritativeMediaBilling, failMediaGenerationBilling } from "@/lib/billing/media-job-billing";
import { mediaUsageFromRequest, normalizeMediaResult, providerFailureIsNonBillable, type MediaBillingInput } from "@/lib/billing/media-job-billing-core";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const jobFields = "id,public_id,user_id,project_id,modality,model_id,provider_key,provider_task_id,status,prompt,request_json,estimated_credits,reserved_credits,charged_credits,hold_id,billing_quote_id,result_json,result_urls,error_message,created_at,updated_at,completed_at";

type GenerationJob = {
  id: string; public_id: string; user_id: string; project_id?: string | null;
  modality: string; model_id: string; provider_key?: string | null; provider_task_id?: string | null;
  status: string; prompt?: string | null; estimated_credits?: number | null; reserved_credits?: number | null;
  charged_credits?: number | null; hold_id?: string | null; billing_quote_id?: string | null;
  request_json?: Record<string, unknown> | null; result_json?: { amhStoredPaths?: unknown } | null;
  result_urls?: string[] | null; error_message?: string | null; created_at?: string; updated_at?: string; completed_at?: string | null;
};

async function clientJob(job: GenerationJob) {
  const paths = Array.isArray(job.result_json?.amhStoredPaths) && job.result_json.amhStoredPaths.every((path): path is string => typeof path === "string") ? job.result_json.amhStoredPaths : [];
  const signed = await signGeneratedPaths(paths);
  return {
    id: job.id, public_id: job.public_id, project_id: job.project_id, modality: job.modality,
    model_id: job.model_id, status: job.status, prompt: job.prompt,
    estimated_credits: job.estimated_credits, reserved_credits: job.reserved_credits,
    charged_credits: job.charged_credits, error_message: job.error_message,
    created_at: job.created_at, updated_at: job.updated_at, completed_at: job.completed_at,
    result_urls: signed.length ? signed : (job.result_urls ?? [])
  };
}

async function trustedUrls(urls: string[]) {
  await Promise.all(urls.map((url) => assertTrustedAssetUrl(url)));
  return urls.slice(0, 20);
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedId = idSchema.safeParse((await context.params).id);
  if (!parsedId.success) return NextResponse.json({ error: "Generation job not found." }, { status: 404 });

  const admin = createAdminClient();
  const { data: rawJob, error } = await admin.from("generation_jobs").select(jobFields).eq("id", parsedId.data).eq("user_id", user.id).single();
  if (error || !rawJob) return NextResponse.json({ error: "Generation job not found." }, { status: 404 });
  const job = rawJob as GenerationJob;
  if (job.status === "settling" && job.modality === "video" && job.provider_task_id && job.result_urls?.length) {
    try {
      const settlement = await completeProviderAuthoritativeMediaBilling({ jobId: job.id, providerTaskId: job.provider_task_id });
      if ((settlement as Record<string, unknown>).status === "settled") {
        const { data: completed, error: updateError } = await admin.from("generation_jobs").update({ status: "completed",
          reconciliation_required: false, reconciliation_state: "resolved", next_reconcile_at: null,
          completed_at: new Date().toISOString() }).eq("id", job.id).select(jobFields).single();
        if (updateError) throw updateError;
        return NextResponse.json({ job: await clientJob(completed as GenerationJob) });
      }
    } catch (error) { logServerError("job-poll-v3-record-retry", error, { jobId: job.id }); }
  }
  if (["completed", "failed", "cancelled", "expired"].includes(job.status)
    || job.status === "settling" || !job.provider_task_id) {
    return NextResponse.json({ job: await clientJob(job) });
  }

  try {
    const task = await providerPollTask({ provider: String(job.provider_key || "apimodels"), modality: job.modality as "image" | "video" | "audio", taskId: job.provider_task_id });
    const summary = { provider_state: task.state, result_url_count: task.resultUrls?.length ?? 0 };
    if (task.state === "completed") {
      let resultUrls: string[];
      try { resultUrls = await trustedUrls(task.resultUrls ?? []); }
      catch (urlError) {
        logServerError("job-poll-asset-url", urlError, { jobId: job.id });
        return NextResponse.json({ job: await clientJob(job), warning: "Provider returned an untrusted output location." }, { status: 502 });
      }
      if (!resultUrls.length) return NextResponse.json({ job: await clientJob(job), warning: "Provider has not supplied a usable output yet." });

      const { data: quote, error: quoteError } = job.billing_quote_id
        ? await admin.from("billing_quotes").select("billing_engine").eq("id", job.billing_quote_id).single()
        : { data: null, error: null };
      if (quoteError) throw quoteError;
      const providerAuthoritativeOutput = quote?.billing_engine === "v3_provider_authoritative";
      const { data: claimed } = await admin.from("generation_jobs").update({ status: "settling", result_json: summary,
        updated_at: new Date().toISOString() })
        .eq("id", job.id).in("status", ["queued", "submitted", "processing"]).select(jobFields).maybeSingle();
      if (!claimed) {
        const { data: latest } = await admin.from("generation_jobs").select(jobFields).eq("id", job.id).single();
        return NextResponse.json({ job: await clientJob(latest as GenerationJob) });
      }

      const storedPaths = await persistGeneratedAssets(user.id, job.id, resultUrls);
      if (providerAuthoritativeOutput) {
        const { error: outputError } = await admin.from("generation_jobs").update({
          status: job.modality === "video" ? "settling" : "completed", result_json: { ...summary, amhStoredPaths: storedPaths }, result_urls: resultUrls,
          completed_at: new Date().toISOString(), reconciliation_required: true, reconciliation_state: "due",
          next_reconcile_at: new Date(Date.now() + 60_000).toISOString(), error_message: null, updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        if (outputError) throw outputError;
      }
      try {
        if (!job.billing_quote_id) throw new Error("BILLING_MEDIA_QUOTE_MISSING");
        const requestUsage = mediaUsageFromRequest({ ...(job.request_json ?? {}), prompt: job.prompt ?? "" } as MediaBillingInput);
        const normalized = normalizeMediaResult(task, requestUsage);
        const settlement = providerAuthoritativeOutput
          ? await completeProviderAuthoritativeMediaBilling({ jobId: job.id, providerTaskId: job.provider_task_id!,
            usage: normalized.usage, metadata: { job_id: job.id, model_id: job.model_id, source: "job_poll" } })
          : await completeMediaGenerationBilling({ jobId: job.id, normalized,
            resultJson: { ...summary, amhStoredPaths: storedPaths }, resultUrls,
            metadata: { job_id: job.id, model_id: job.model_id, source: "job_poll" } });
        const charge = providerAuthoritativeOutput
          ? Number((settlement as Record<string, unknown>).charge_credits ?? 0)
          : Number((settlement as Awaited<ReturnType<typeof completeMediaGenerationBilling>>).result.charge_credits ?? 0);
        if (providerAuthoritativeOutput && (settlement as Record<string, unknown>).status === "settled") {
          await admin.from("generation_jobs").update({ status: "completed", reconciliation_required: false,
            reconciliation_state: "resolved", next_reconcile_at: null }).eq("id", job.id);
        }
        if (job.modality !== "video" || !providerAuthoritativeOutput || (settlement as Record<string, unknown>).status === "settled") {
          await notifyUser(user.id, { type: "generation", title: `${job.modality} generation completed`, body: `${job.public_id} is ready.${charge > 0 ? ` ${charge.toFixed(2)} Credits charged.` : " Billing is finalizing."}`, href: `/${job.modality === "image" ? "images" : job.modality === "video" ? "video" : "audio"}` });
        }
      } catch (settlementError) {
        await admin.from("generation_jobs").update({
          error_message: providerAuthoritativeOutput ? null : "Wallet settlement pending reconciliation.",
          reconciliation_required: true, reconciliation_state: "due", next_reconcile_at: new Date(Date.now() + 60_000).toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        logServerError("job-poll-settlement", settlementError, { jobId: job.id });
        const { data: pendingJob } = await admin.from("generation_jobs").select(jobFields).eq("id", job.id).single();
        return NextResponse.json({ job: await clientJob(pendingJob as GenerationJob), warning: "Billing is pending reconciliation." });
      }
      const { data: updated } = await admin.from("generation_jobs").select(jobFields).eq("id", job.id).single();
      return NextResponse.json({ job: await clientJob(updated as GenerationJob) });
    }

    if (task.state === "failed") {
      if (!job.billing_quote_id || !providerFailureIsNonBillable(String(job.provider_key || ""))) throw new Error("BILLING_MEDIA_FAILURE_REQUIRES_RECONCILIATION");
      await failMediaGenerationBilling({ jobId: job.id, providerState: "failed", errorMessage: task.failMsg || "Generation failed", rawUsage: (task.raw && typeof task.raw === "object" ? task.raw : {}) as Record<string, unknown>, metadata: { source: "job_poll" } });
      const { data: updated } = await admin.from("generation_jobs").select(jobFields).eq("id", job.id).single();
      if (updated?.status === "failed") await notifyUser(user.id, { type: "generation", title: `${job.modality} generation failed`, body: `${job.public_id} failed. Eligible reserved Credits were released.` });
      return NextResponse.json({ job: await clientJob(updated as GenerationJob) });
    }

    const normalized = task.state === "processing" ? "processing" : "submitted";
    const checkedAt = new Date();
    const { data: updated } = await admin.from("generation_jobs").update({ status: normalized, result_json: summary,
      last_provider_check_at: checkedAt.toISOString(), next_reconcile_at: new Date(checkedAt.getTime() + 5 * 60_000).toISOString(),
      reconciliation_state: "processing", updated_at: checkedAt.toISOString() }).eq("id", job.id).select(jobFields).single();
    return NextResponse.json({ job: await clientJob(updated as GenerationJob) });
  } catch (pollError) {
    logServerError("job-poll-provider", pollError, { jobId: job.id });
    return NextResponse.json({ job: await clientJob(job), warning: "Could not refresh provider status." });
  }
}


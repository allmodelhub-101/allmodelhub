import "server-only";
import { assertTrustedAssetUrl, persistGeneratedAssets } from "@/lib/generated-assets";
import { notifyUser } from "@/lib/notifications";
import { providerPollTask } from "@/lib/providers";
import { logServerError } from "@/lib/public-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeGenerationJob } from "@/lib/wallet";
import { completeMediaGenerationBilling, failMediaGenerationBilling } from "./media-job-billing";
import { mediaUsageFromRequest, normalizeMediaResult, providerFailureIsNonBillable, type MediaBillingInput } from "./media-job-billing-core";
import { nextReconcileAt, rawProviderTerminalState, reconciliationDecision, type ReconciliationOutcome } from "./reconciliation-core";

export type ReconciliationJob = {
  id: string; user_id: string; public_id: string; modality: "image" | "video" | "audio";
  model_id: string; provider_key: string; provider_task_id: string; status: string;
  prompt: string | null; request_json: Record<string, unknown> | null; result_json: Record<string, unknown> | null;
  estimated_credits: number | string; billing_quote_id: string | null; reconcile_attempts: number;
};

async function recordResult(job: ReconciliationJob, outcome: ReconciliationOutcome, metadata: Record<string, unknown>, next?: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("billing_record_reconciliation_result", {
    p_job_id: job.id, p_outcome: outcome, p_next_reconcile_at: next ?? null, p_metadata: metadata,
  });
  if (error) throw error;
}

async function trustedUrls(urls: string[]) {
  const limited = urls.slice(0, 20);
  await Promise.all(limited.map((url) => assertTrustedAssetUrl(url)));
  return limited;
}

export async function reconcileGenerationJob(job: ReconciliationJob) {
  const admin = createAdminClient();
  try {
    const task = await providerPollTask({ provider: job.provider_key, modality: job.modality, taskId: job.provider_task_id });
    const { error: checkError } = await admin.from("generation_jobs")
      .update({ last_provider_check_at: new Date().toISOString() }).eq("id", job.id);
    if (checkError) throw checkError;
    const urls = task.state === "completed" ? await trustedUrls(task.resultUrls ?? []) : [];
    const decision = reconciliationDecision({ providerState: task.state, hasTrustedOutput: urls.length > 0,
      failureIsNonBillable: providerFailureIsNonBillable(job.provider_key) });
    if (decision === "retain") {
      const next = nextReconcileAt(new Date(), Math.min(job.reconcile_attempts, 3));
      await admin.from("generation_jobs").update({ status: task.state === "processing" ? "processing" : "submitted",
        result_json: { provider_state: task.state, reconciliation: "provider_still_processing" } }).eq("id", job.id);
      await recordResult(job, "processing", { provider_state: task.state }, next);
      return { jobId: job.id, outcome: "processing" } as const;
    }
    if (decision === "quarantine") {
      const next = nextReconcileAt(new Date(), job.reconcile_attempts);
      await recordResult(job, "quarantined", { provider_state: task.state,
        reason: task.state === "completed" ? "completed_without_trusted_output" : "provider_failure_billing_unknown" }, next);
      return { jobId: job.id, outcome: "quarantined" } as const;
    }
    if (decision === "release") {
      const providerState = rawProviderTerminalState(task.raw);
      if (job.billing_quote_id) {
        await failMediaGenerationBilling({ jobId: job.id, providerState, errorMessage: task.failMsg || `Provider confirmed ${providerState}`,
          rawUsage: task.raw && typeof task.raw === "object" ? task.raw as Record<string, unknown> : {}, metadata: { source: "scheduled_reconciliation" } });
      } else {
        const { error } = await admin.rpc("billing_reconcile_legacy_generation_failure", {
          p_job_id: job.id, p_provider_state: providerState, p_error_message: task.failMsg || `Provider confirmed ${providerState}`,
          p_metadata: { source: "scheduled_reconciliation", provider_task_id: job.provider_task_id },
        });
        if (error) throw error;
      }
      await notifyUser(job.user_id, { type: "generation", title: "Generation failed",
        body: `${job.public_id} failed and its eligible reserved Credits were released.`, href: "/usage" }).catch(() => undefined);
      return { jobId: job.id, outcome: "released" } as const;
    }

    const storedPaths = await persistGeneratedAssets(job.user_id, job.id, urls);
    const resultJson = { provider_state: task.state, result_url_count: urls.length, amhStoredPaths: storedPaths, reconciliation: "confirmed_success" };
    if (job.billing_quote_id) {
      if (job.status !== "settling") {
        const { error } = await admin.from("generation_jobs").update({ status: "settling" }).eq("id", job.id)
          .in("status", ["queued", "submitted", "processing"]);
        if (error) throw error;
      }
      const usage = mediaUsageFromRequest({ ...(job.request_json ?? {}), prompt: job.prompt ?? "" } as MediaBillingInput);
      await completeMediaGenerationBilling({ jobId: job.id, normalized: normalizeMediaResult(task, usage), resultJson, resultUrls: urls,
        metadata: { source: "scheduled_reconciliation", reconcile_attempt: job.reconcile_attempts } });
    } else {
      await completeGenerationJob({ jobId: job.id, chargedCredits: Number(job.estimated_credits), resultJson, resultUrls: urls,
        metadata: { source: "scheduled_legacy_reconciliation", provider_task_id: job.provider_task_id } });
    }
    await notifyUser(job.user_id, { type: "generation", title: "Generation complete",
      body: `${job.public_id} is ready.`, href: `/usage?job=${job.id}` }).catch(() => undefined);
    return { jobId: job.id, outcome: "settled" } as const;
  } catch (error) {
    const next = nextReconcileAt(new Date(), job.reconcile_attempts);
    await recordResult(job, "quarantined", { reason: "provider_unavailable_or_reconciliation_error",
      error: error instanceof Error ? error.message.slice(0, 500) : "Unknown reconciliation error" }, next).catch(() => undefined);
    logServerError("billing-reconciliation", error, { jobId: job.id, provider: job.provider_key, attempt: job.reconcile_attempts });
    return { jobId: job.id, outcome: "quarantined", error: true } as const;
  }
}

export async function runBillingReconciliation(limit = 20) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_claim_reconciliation_batch", { p_limit: limit });
  if (error) throw error;
  const jobs = (data ?? []) as ReconciliationJob[];
  const results = [];
  for (const job of jobs) results.push(await reconcileGenerationJob(job));
  const { data: invariants, error: invariantError } = await admin.rpc("billing_reconciliation_invariants");
  if (invariantError) throw invariantError;
  return { claimed: jobs.length, results, invariants } as const;
}

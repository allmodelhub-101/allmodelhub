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
import { getBillingV3Settings } from "./billing-v3-settings";
import { settleApimodelsTask } from "./provider-authoritative-settlement";

export type ReconciliationJob = {
  id: string; user_id: string; public_id: string; modality: "image" | "video" | "audio";
  model_id: string; provider_key: string; provider_task_id: string; status: string;
  prompt: string | null; request_json: Record<string, unknown> | null; result_json: Record<string, unknown> | null;
  estimated_credits: number | string; billing_quote_id: string | null; reconcile_attempts: number;
};

type ProviderBillingReconciliationRow = {
  id: string;
  quote_id: string;
  provider_key: string;
  provider_request_id: string | null;
  provider_task_id: string | null;
  reconciliation_attempts: number;
  message_id: string | null;
  generation_job_id: string | null;
};

export async function runBillingV3ReconciliationPump(limit = 3) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_v3_claim_reconciliation_batch", { p_limit: limit });
  if (error) throw error;
  const records = (data ?? []) as ProviderBillingReconciliationRow[];
  const results: Array<Record<string, unknown>> = [];
  for (const record of records) {
    const provider = record.provider_key.toLowerCase().replace(/[-_.]/g, "");
    const taskId = record.provider_task_id ?? record.provider_request_id;
    if (!taskId || (provider !== "apimodels" && provider !== "apimodelsapp")) {
      const next = nextReconcileAt(new Date(), record.reconciliation_attempts);
      await admin.rpc("billing_v3_mark_reconciliation_retry", {
        p_provider_billing_record_id: record.id,
        p_status: "anomaly",
        p_next_reconcile_at: next,
        p_details: { reason: "unsupported_provider_or_missing_identifier" },
      });
      results.push({ providerBillingRecordId: record.id, outcome: "anomaly" });
      continue;
    }
    try {
      if (record.generation_job_id) {
        const { error: recoveryError } = await admin.from("generation_jobs")
          .update({ provider_task_id: taskId }).eq("id", record.generation_job_id)
          .eq("billing_quote_id", record.quote_id).is("provider_task_id", null);
        if (recoveryError) throw recoveryError;
      }
      const settlement = await settleApimodelsTask({
        quoteId: record.quote_id,
        taskId,
        providerRequestId: record.provider_request_id,
        providerTaskId: record.provider_task_id,
        source: "reconciliation",
        links: { messageId: record.message_id, generationJobId: record.generation_job_id },
        metadata: { source: "billing_v3_reconciliation" },
      });
      results.push({
        providerBillingRecordId: record.id,
        outcome: String((settlement as Record<string, unknown>).status ?? "pending_reconciliation"),
      });
    } catch (providerError) {
      const next = nextReconcileAt(new Date(), record.reconciliation_attempts);
      try {
        await admin.rpc("billing_v3_mark_reconciliation_retry", {
          p_provider_billing_record_id: record.id,
          p_status: "retry",
          p_next_reconcile_at: next,
          p_details: { reason: "provider_record_temporarily_unavailable" },
        });
      } catch { /* the next cron run can reclaim an unchanged record */ }
      logServerError("billing-v3-reconciliation", providerError, { providerBillingRecordId: record.id });
      results.push({ providerBillingRecordId: record.id, outcome: "retry" });
    }
  }
  return { claimed: records.length, results } as const;
}

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
    const { data: quote, error: quoteError } = job.billing_quote_id
      ? await admin.from("billing_quotes").select("billing_engine").eq("id", job.billing_quote_id).maybeSingle()
      : { data: null, error: null };
    if (quoteError) throw quoteError;
    if (quote?.billing_engine === "v3_provider_authoritative") {
      if (task.state === "pending" || task.state === "processing") {
        const next = nextReconcileAt(new Date(), Math.min(job.reconcile_attempts, 3));
        await recordResult(job, "processing", { provider_state: task.state, billing_engine: "v3_provider_authoritative" }, next);
        return { jobId: job.id, outcome: "processing" } as const;
      }
      if (task.state === "completed" && !urls.length) {
        const next = nextReconcileAt(new Date(), job.reconcile_attempts);
        await recordResult(job, "quarantined", { provider_state: task.state, reason: "completed_without_trusted_output" }, next);
        return { jobId: job.id, outcome: "quarantined" } as const;
      }
      const storedPaths = task.state === "completed" ? await persistGeneratedAssets(job.user_id, job.id, urls) : [];
      if (task.state === "completed") {
        const { error: outputError } = await admin.from("generation_jobs").update({
          status: job.modality === "video" ? "settling" : "completed",
          result_json: { provider_state: task.state, result_url_count: urls.length, amhStoredPaths: storedPaths,
            reconciliation: "billing_pending" },
          result_urls: urls,
          completed_at: new Date().toISOString(),
          reconciliation_required: true,
          reconciliation_state: "due",
          error_message: null,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        if (outputError) throw outputError;
      }
      const settlement = await settleApimodelsTask({
        quoteId: job.billing_quote_id!, taskId: job.provider_task_id,
        providerTaskId: job.provider_task_id, source: "reconciliation",
        links: { generationJobId: job.id },
        metadata: { source: "scheduled_generation_reconciliation", billing_v3: true },
      });
      const status = String((settlement as Record<string, unknown>).status ?? "pending_reconciliation");
      if (status === "settled" && task.state !== "completed") {
        const { error } = await admin.from("generation_jobs").update({ status: "failed",
          error_message: task.failMsg || "Provider failed after billable work.",
          reconciliation_required: false, reconciliation_state: "resolved", next_reconcile_at: null }).eq("id", job.id);
        if (error) throw error;
        return { jobId: job.id, outcome: "settled" } as const;
      }
      if (status === "settled") {
        await admin.from("generation_jobs").update({ status: "completed", result_json: { provider_state: task.state,
          result_url_count: urls.length, amhStoredPaths: storedPaths, reconciliation: "confirmed_success" },
          result_urls: urls, reconciliation_required: false, reconciliation_state: "resolved",
          next_reconcile_at: null }).eq("id", job.id);
        await notifyUser(job.user_id, { type: "generation", title: "Generation complete",
          body: `${job.public_id} is ready.`, href: `/usage?job=${job.id}` }).catch(() => undefined);
        return { jobId: job.id, outcome: "settled" } as const;
      }
      if (status === "released") {
        await notifyUser(job.user_id, { type: "generation", title: "Generation failed",
          body: `${job.public_id} failed and its reserved Credits were released.`, href: "/usage" }).catch(() => undefined);
        return { jobId: job.id, outcome: "released" } as const;
      }
      const next = nextReconcileAt(new Date(), job.reconcile_attempts);
      await recordResult(job, "quarantined", { provider_state: task.state,
        reason: status === "authorization_shortfall" ? "authorization_shortfall" : "provider_billing_unsettled" }, next);
      return { jobId: job.id, outcome: "quarantined" } as const;
    }
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
  const settings = await getBillingV3Settings();
  const providerAuthoritative = settings.reconciliationEnabled
    ? await runBillingV3ReconciliationPump(limit)
    : { claimed: 0, results: [] };
  return { claimed: jobs.length, results, providerAuthoritative, invariants } as const;
}


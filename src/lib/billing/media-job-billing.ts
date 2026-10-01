import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAuthoritativePricingRule } from "./pricing-registry";
import { validateProfitabilityPolicy } from "./quote-reservation-core";
import { prepareUsageSettlement } from "./usage-settlement-core";
import type { NormalizedMediaResult } from "./media-job-billing-core";
import type { ValidatedPricingRule } from "./pricing-registry-core";
import { recordBillingShadowValidationBestEffort, recordMediaFailureShadowBestEffort } from "./shadow-validation";
import { settleApimodelsTask } from "./provider-authoritative-settlement";

type QuoteRow = {
  id: string; user_id: string; provider_key: string; model_id: string; upstream_model: string; pricing_version: string;
  internal_usd_pkr_rate: string; reservation_credits: string; created_at: string;
  input_dimensions: { pricingDimensions?: Record<string, string> };
  pricing_snapshot: { profitabilityPolicy?: Record<string, unknown>; authoritativeRule?: ValidatedPricingRule };
};

export async function completeMediaGenerationBilling(input: Readonly<{
  jobId: string;
  normalized: NormalizedMediaResult;
  resultJson: Readonly<Record<string, unknown>>;
  resultUrls: string[];
  metadata: Readonly<Record<string, unknown>>;
}>) {
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin.from("generation_jobs").select("id,billing_quote_id,provider_task_id").eq("id", input.jobId).single();
  if (jobError || !job?.billing_quote_id) throw jobError ?? new Error("BILLING_MEDIA_JOB_QUOTE_MISSING");
  const { data: quote, error: quoteError } = await admin.from("billing_media_settlement_quotes")
    .select("id,user_id,provider_key,model_id,upstream_model,pricing_version,internal_usd_pkr_rate,reservation_credits,created_at,input_dimensions,pricing_snapshot")
    .eq("id", job.billing_quote_id).single();
  if (quoteError || !quote) throw quoteError ?? new Error("BILLING_MEDIA_QUOTE_MISSING");
  const typedQuote = quote as QuoteRow;
  const rule = typedQuote.pricing_snapshot.authoritativeRule ?? await loadAuthoritativePricingRule({
    providerKey: typedQuote.provider_key, modelId: typedQuote.model_id, upstreamModel: typedQuote.upstream_model,
    pricingVersion: typedQuote.pricing_version, at: new Date(typedQuote.created_at),
  });
  if (rule.providerKey !== typedQuote.provider_key || rule.modelId !== typedQuote.model_id
    || rule.upstreamModel !== typedQuote.upstream_model || rule.pricingVersion !== typedQuote.pricing_version) {
    throw new Error("BILLING_MEDIA_RULE_SNAPSHOT_INVALID");
  }
  const rawPolicy = typedQuote.pricing_snapshot.profitabilityPolicy ?? {};
  const policy = validateProfitabilityPolicy({
    minimumRevenueCostRatio: rawPolicy.minimumRevenueCostRatio,
    minimumProfitPkr: rawPolicy.minimumProfitPkr,
    walletReservationQuantumCredits: rawPolicy.walletReservationQuantumCredits,
  });
  const prepared = prepareUsageSettlement({
    rule, usage: input.normalized.usage,
    dimensions: typedQuote.input_dimensions.pricingDimensions ?? {},
    internalUsdPkrRate: typedQuote.internal_usd_pkr_rate,
    profitabilityPolicy: policy,
    reservationCredits: typedQuote.reservation_credits,
    providerReportedCost: input.normalized.providerReportedCost,
    usageSource: Object.keys(input.normalized.rawUsage).length ? "provider_reported_usage" : "submitted_request_exact",
    providerRequestId: input.normalized.providerRequestId,
    providerTaskId: job.provider_task_id,
  });
  const { data, error } = await admin.rpc("billing_complete_media_quote", {
    p_job_id: input.jobId,
    p_usage: prepared.normalizedUsage,
    p_provider_request_id: input.normalized.providerRequestId ?? null,
    p_provider_reported_cost: input.normalized.providerReportedCost?.amount ?? null,
    p_provider_reported_currency: input.normalized.providerReportedCost?.currency ?? null,
    p_calculated_provider_cost_usd: prepared.calculatedProviderCostUsd,
    p_final_provider_cost_usd: prepared.finalProviderCostUsd,
    p_charge_credits: prepared.chargeCredits,
    p_cost_status: prepared.costStatus,
    p_raw_usage: input.normalized.rawUsage,
    p_usage_snapshot: prepared.usageSnapshot,
    p_result_json: input.resultJson,
    p_result_urls: input.resultUrls,
    p_metadata: { ...input.metadata, reservation_shortfall: !prepared.coverage.covered },
  });
  if (error || !data) throw error ?? new Error("BILLING_MEDIA_JOB_SETTLEMENT_FAILED");
  const result = data as Record<string, string>;
  await recordBillingShadowValidationBestEffort({
    phase: "settlement",
    quoteId: typedQuote.id,
    receiptId: result.receipt_id,
    userId: typedQuote.user_id,
    providerKey: typedQuote.provider_key,
    modelId: typedQuote.model_id,
    pricingVersion: typedQuote.pricing_version,
    internalUsdPkrRate: typedQuote.internal_usd_pkr_rate,
    usage: prepared.normalizedUsage,
    billingV2ChargeCredits: prepared.chargeCredits,
    details: { cost_status: prepared.costStatus, generation_job_id: input.jobId },
  });
  return { result, prepared } as const;
}

export async function completeProviderAuthoritativeMediaBilling(input: Readonly<{
  jobId: string;
  providerTaskId: string;
  usage?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
}>) {
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin.from("generation_jobs")
    .select("id,billing_quote_id,modality")
    .eq("id", input.jobId).single();
  if (jobError || !job?.billing_quote_id) throw jobError ?? new Error("BILLING_MEDIA_JOB_QUOTE_MISSING");
  if (job.modality !== "image" && job.modality !== "audio" && job.modality !== "video") {
    throw new Error("BILLING_V3_MEDIA_SETTLEMENT_SCOPE_INVALID");
  }
  const { data: quote, error: quoteError } = await admin.from("billing_quotes")
    .select("billing_engine").eq("id", job.billing_quote_id).single();
  if (quoteError || quote?.billing_engine !== "v3_provider_authoritative") {
    throw quoteError ?? new Error("BILLING_V3_MEDIA_QUOTE_REQUIRED");
  }
  return settleApimodelsTask({
    quoteId: job.billing_quote_id,
    taskId: input.providerTaskId,
    providerTaskId: input.providerTaskId,
    source: "records_api",
    usage: input.usage,
    links: { generationJobId: input.jobId },
    metadata: { billing_v3: true, ...input.metadata },
  });
}

export async function failMediaGenerationBilling(input: Readonly<{
  jobId: string;
  providerState: "failed" | "cancelled" | "expired";
  errorMessage: string;
  rawUsage?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
}>) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_fail_media_quote", {
    p_job_id: input.jobId,
    p_provider_state: input.providerState,
    p_error_message: input.errorMessage.slice(0, 1000),
    p_raw_usage: input.rawUsage ?? {},
    p_metadata: input.metadata ?? {},
  });
  if (error || !data) throw error ?? new Error("BILLING_MEDIA_JOB_FAILURE_FAILED");
  await recordMediaFailureShadowBestEffort(input.jobId);
  return data as Record<string, string>;
}

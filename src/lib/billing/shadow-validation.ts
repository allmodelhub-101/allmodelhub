import "server-only";
import Decimal from "decimal.js";
import { getModel } from "@/lib/models";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedUsage } from "./types";
import { calculateLegacyShadowCharge } from "./legacy-shadow-core";
import { compareShadowCharges } from "./shadow-validation-core";

export function billingShadowValidationEnabled() {
  return ["1", "true", "on"].includes((process.env.BILLING_V2_SHADOW_VALIDATION ?? "").toLowerCase());
}

export async function recordBillingShadowValidation(input: Readonly<{
  phase: "quote" | "settlement" | "failure";
  quoteId: string;
  receiptId?: string | null;
  userId: string;
  providerKey: string;
  modelId: string;
  pricingVersion: string;
  internalUsdPkrRate: string;
  usage: NormalizedUsage;
  billingV2ChargeCredits: string;
  qualityMultiplier?: string;
  details?: Readonly<Record<string, unknown>>;
}>) {
  if (!billingShadowValidationEnabled()) return { status: "disabled" } as const;
  const model = getModel(input.modelId);
  if (!model) return { status: "unsupported" } as const;
  const legacyExpected = calculateLegacyShadowCharge({
    model,
    phase: input.phase,
    usage: input.usage,
    internalUsdPkrRate: input.internalUsdPkrRate,
    qualityMultiplier: input.qualityMultiplier,
  });
  const comparison = compareShadowCharges({
    legacyExpectedChargeCredits: legacyExpected,
    billingV2ChargeCredits: input.billingV2ChargeCredits,
  });
  const admin = createAdminClient();
  const { data, error } = await admin.from("billing_shadow_validations").insert({
    quote_id: input.quoteId,
    receipt_id: input.receiptId ?? null,
    user_id: input.userId,
    phase: input.phase,
    provider_key: input.providerKey,
    model_id: input.modelId,
    pricing_version: input.pricingVersion,
    internal_usd_pkr_rate: input.internalUsdPkrRate,
    legacy_expected_charge_credits: comparison.legacyExpectedChargeCredits,
    billing_v2_charge_credits: comparison.billingV2ChargeCredits,
    relative_variance: comparison.relativeVariance,
    tolerance_credits: comparison.toleranceCredits,
    mismatch: comparison.mismatch,
    severity: comparison.severity,
    legacy_source: "catalog_pricing_shared_v1",
    details: { usage: input.usage, ...input.details },
  }).select("id").single();
  let validationId = data?.id as string | undefined;
  const duplicate = error?.code === "23505";
  if (duplicate) {
    const { data: existing, error: existingError } = await admin.from("billing_shadow_validations")
      .select("id").eq("quote_id", input.quoteId).eq("phase", input.phase).single();
    if (existingError || !existing) throw existingError ?? new Error("BILLING_SHADOW_VALIDATION_LOOKUP_FAILED");
    validationId = existing.id;
  } else if (error || !validationId) throw error ?? new Error("BILLING_SHADOW_VALIDATION_WRITE_FAILED");

  if (comparison.mismatch) {
    const fx = new Decimal(input.internalUsdPkrRate);
    const { error: anomalyError } = await admin.from("billing_anomalies").insert({
      user_id: input.userId,
      quote_id: input.quoteId,
      receipt_id: input.receiptId ?? null,
      provider_key: input.providerKey,
      model_id: input.modelId,
      upstream_model: model.upstreamModel,
      anomaly_type: `shadow_${input.phase}_charge_mismatch`,
      expected_cost_usd: new Decimal(comparison.legacyExpectedChargeCredits).div(fx).toFixed(),
      observed_cost_usd: new Decimal(comparison.billingV2ChargeCredits).div(fx).toFixed(),
      severity: comparison.severity,
      status: "open",
      details: {
        shadow_validation_id: validationId,
        legacy_expected_charge_credits: comparison.legacyExpectedChargeCredits,
        billing_v2_charge_credits: comparison.billingV2ChargeCredits,
        variance_credits: comparison.varianceCredits,
        tolerance_credits: comparison.toleranceCredits,
        pricing_version: input.pricingVersion,
        internal_usd_pkr_rate: input.internalUsdPkrRate,
      },
    });
    if (anomalyError && anomalyError.code !== "23505") throw anomalyError;
  }
  return { status: duplicate ? "duplicate" : "recorded", comparison, id: validationId } as const;
}

export function recordBillingShadowValidationBestEffort(input: Parameters<typeof recordBillingShadowValidation>[0]) {
  return recordBillingShadowValidation(input).catch((error) => {
    console.error("Billing shadow validation failed", error);
    return undefined;
  });
}

export async function recordMediaFailureShadowBestEffort(jobId: string) {
  if (!billingShadowValidationEnabled()) return;
  await (async () => {
    const admin = createAdminClient();
    const { data: job, error: jobError } = await admin.from("generation_jobs").select("billing_quote_id").eq("id", jobId).single();
    if (jobError || !job?.billing_quote_id) throw jobError ?? new Error("BILLING_SHADOW_JOB_QUOTE_MISSING");
    const { data: quote, error: quoteError } = await admin.from("billing_quotes")
      .select("id,user_id,provider_key,model_id,pricing_version,internal_usd_pkr_rate,input_dimensions")
      .eq("id", job.billing_quote_id).single();
    if (quoteError || !quote) throw quoteError ?? new Error("BILLING_SHADOW_QUOTE_MISSING");
    const dimensions = quote.input_dimensions as { estimatedUsage?: NormalizedUsage };
    await recordBillingShadowValidation({
      phase: "failure",
      quoteId: quote.id,
      userId: quote.user_id,
      providerKey: quote.provider_key,
      modelId: quote.model_id,
      pricingVersion: quote.pricing_version,
      internalUsdPkrRate: quote.internal_usd_pkr_rate,
      usage: dimensions.estimatedUsage ?? {},
      billingV2ChargeCredits: "0",
      details: { generation_job_id: jobId, final_charge_reason: "provider_confirmed_non_billable_failure" },
    });
  })().catch((error) => console.error("Billing media failure shadow validation failed", error));
}

export async function recordJobSettlementShadowBestEffort(input: Readonly<{
  jobId: string;
  receiptId: string;
  usage: NormalizedUsage;
  billingV2ChargeCredits: string;
}>) {
  if (!billingShadowValidationEnabled()) return;
  await (async () => {
    const admin = createAdminClient();
    const { data: job, error: jobError } = await admin.from("generation_jobs").select("billing_quote_id").eq("id", input.jobId).single();
    if (jobError || !job?.billing_quote_id) throw jobError ?? new Error("BILLING_SHADOW_JOB_QUOTE_MISSING");
    const { data: quote, error: quoteError } = await admin.from("billing_quotes")
      .select("id,user_id,provider_key,model_id,pricing_version,internal_usd_pkr_rate")
      .eq("id", job.billing_quote_id).single();
    if (quoteError || !quote) throw quoteError ?? new Error("BILLING_SHADOW_QUOTE_MISSING");
    await recordBillingShadowValidation({
      phase: "settlement", quoteId: quote.id, receiptId: input.receiptId, userId: quote.user_id,
      providerKey: quote.provider_key, modelId: quote.model_id, pricingVersion: quote.pricing_version,
      internalUsdPkrRate: quote.internal_usd_pkr_rate, usage: input.usage,
      billingV2ChargeCredits: input.billingV2ChargeCredits, details: { generation_job_id: input.jobId },
    });
  })().catch((error) => console.error("Billing job settlement shadow validation failed", error));
}

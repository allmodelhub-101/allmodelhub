import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createIdempotencyKey } from "@/lib/security/ids";
import { calculateAuthoritativePrice, type FormulaEvaluator, type PricingDimensions } from "./pricing-registry-core";
import { loadAuthoritativePricingContext } from "./pricing-registry";
import { resolveBillingProviderRoute } from "./provider-route";
import {
  buildBillingQuotePlan,
  validateProfitabilityPolicy,
  type BillingQuotePlan,
  type ProfitabilityPolicy,
  type QuoteKind,
} from "./quote-reservation-core";
import type { NormalizedUsage } from "./types";
import { recordBillingShadowValidationBestEffort } from "./shadow-validation";

type PersistedReservation = Readonly<{
  quote_id: string;
  wallet_hold_id: string;
  status: "reserved";
  expires_at: string;
  customer_quote_credits: string;
  reservation_credits: string;
  pricing_snapshot: Readonly<Record<string, unknown>>;
  reservation_kind: "deterministic" | "maximum";
}>;

export type UniversalQuoteRequest = Readonly<{
  userId: string;
  requestIdempotencyId: string;
  modelId: string;
  providerKey?: string;
  pricingVersion?: string;
  kind: QuoteKind;
  estimatedUsage: NormalizedUsage;
  maximumUsage?: NormalizedUsage;
  dimensions?: PricingDimensions;
  options?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
  formulaEvaluators?: Readonly<Record<string, FormulaEvaluator>>;
}>;

async function loadProfitabilityPolicy(): Promise<ProfitabilityPolicy> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("billing_quote_policy_registry")
    .select("key,decimal_value")
    .in("key", [
      "billing_v2_min_revenue_cost_ratio",
      "billing_v2_min_profit_pkr",
      "billing_v2_wallet_reservation_quantum_credits",
    ]);
  if (error) throw new Error("BILLING_PROFITABILITY_POLICY_UNAVAILABLE");
  const settings = new Map((data ?? []).map((row) => [row.key, row.decimal_value]));
  return validateProfitabilityPolicy({
    minimumRevenueCostRatio: settings.get("billing_v2_min_revenue_cost_ratio"),
    minimumProfitPkr: settings.get("billing_v2_min_profit_pkr"),
    walletReservationQuantumCredits: settings.get("billing_v2_wallet_reservation_quantum_credits"),
  });
}

async function persistQuoteReservation(input: Readonly<{
  request: UniversalQuoteRequest;
  plan: BillingQuotePlan;
  pricingRuleId: string;
  providerKey: string;
  upstreamModel: string;
  pricingVersion: string;
  internalUsdPkrRate: string;
}>) {
  const admin = createAdminClient();
  const holdKey = createIdempotencyKey("billing-v2-quote-hold", input.request.userId, input.request.requestIdempotencyId);
  const { data, error } = await admin.rpc("billing_reserve_quote", {
    p_user_id: input.request.userId,
    p_request_idempotency_id: input.request.requestIdempotencyId,
    p_pricing_rule_id: input.pricingRuleId,
    p_provider_key: input.providerKey,
    p_model_id: input.request.modelId,
    p_upstream_model: input.upstreamModel,
    p_pricing_version: input.pricingVersion,
    p_internal_usd_pkr_rate: input.internalUsdPkrRate,
    p_estimated_provider_cost_usd: input.plan.estimatedProviderCostUsd,
    p_customer_quote_credits: input.plan.estimatedCustomerChargeCredits,
    p_reservation_credits: input.plan.reservationCredits,
    p_input_dimensions: input.plan.inputDimensions,
    p_pricing_snapshot: input.plan.pricingSnapshot,
    p_reservation_kind: input.plan.reservationKind,
    p_reservation_basis: input.plan.reservationBasis,
    p_hold_idempotency_key: holdKey,
    p_hold_metadata: {
      ...input.request.metadata,
      billing_v2: true,
      model_id: input.request.modelId,
      provider_key: input.providerKey,
      request_idempotency_id: input.request.requestIdempotencyId,
    },
  });
  if (error || !data) throw error ?? new Error("BILLING_QUOTE_RESERVATION_FAILED");
  return data as PersistedReservation;
}

export async function createAndReserveBillingQuote(request: UniversalQuoteRequest) {
  // This input intentionally contains no client-supplied price, markup, FX rate,
  // provider cost, customer charge, or reservation amount.
  const route = await resolveBillingProviderRoute({ modelId: request.modelId, providerKey: request.providerKey });
  const [pricingContext, profitabilityPolicy] = await Promise.all([
    loadAuthoritativePricingContext({
      providerKey: route.providerKey,
      modelId: route.modelId,
      upstreamModel: route.upstreamModel,
      pricingVersion: request.pricingVersion,
    }),
    loadProfitabilityPolicy(),
  ]);
  const estimatedPrice = calculateAuthoritativePrice({
    rule: pricingContext.rule,
    usage: request.estimatedUsage,
    dimensions: request.dimensions,
    internalUsdPkrRate: pricingContext.internalUsdPkrRate,
    formulaEvaluators: request.formulaEvaluators,
  });
  const maximumPrice = request.kind === "variable" && request.maximumUsage
    ? calculateAuthoritativePrice({
        rule: pricingContext.rule,
        usage: request.maximumUsage,
        dimensions: request.dimensions,
        internalUsdPkrRate: pricingContext.internalUsdPkrRate,
        formulaEvaluators: request.formulaEvaluators,
      })
    : undefined;
  const plan = buildBillingQuotePlan({
    kind: request.kind,
    route,
    rule: pricingContext.rule,
    estimatedUsage: request.estimatedUsage,
    maximumUsage: request.maximumUsage,
    dimensions: request.dimensions,
    options: request.options,
    estimatedPrice,
    maximumPrice,
    profitabilityPolicy,
  });
  const reservation = await persistQuoteReservation({
    request,
    plan,
    pricingRuleId: pricingContext.rule.id,
    providerKey: route.providerKey,
    upstreamModel: route.upstreamModel,
    pricingVersion: pricingContext.rule.pricingVersion,
    internalUsdPkrRate: pricingContext.internalUsdPkrRate,
  });
  const legacyShadowUsage = request.kind === "variable" && request.maximumUsage
    ? { ...request.estimatedUsage, outputTokens: request.maximumUsage.outputTokens }
    : request.estimatedUsage;
  await recordBillingShadowValidationBestEffort({
    phase: "quote",
    quoteId: reservation.quote_id,
    userId: request.userId,
    providerKey: route.providerKey,
    modelId: route.modelId,
    pricingVersion: pricingContext.rule.pricingVersion,
    internalUsdPkrRate: pricingContext.internalUsdPkrRate,
    usage: legacyShadowUsage,
    billingV2ChargeCredits: reservation.customer_quote_credits,
    qualityMultiplier: typeof request.options?.qualityMultiplier === "string" ? request.options.qualityMultiplier : undefined,
    details: { reservation_credits: reservation.reservation_credits, reservation_kind: reservation.reservation_kind },
  });

  return {
    quoteId: reservation.quote_id,
    userId: request.userId,
    walletHoldId: reservation.wallet_hold_id,
    requestIdempotencyId: request.requestIdempotencyId,
    status: reservation.status,
    expiresAt: reservation.expires_at,
    route,
    pricing: {
      ruleId: pricingContext.rule.id,
      version: pricingContext.rule.pricingVersion,
      internalUsdPkrRate: pricingContext.internalUsdPkrRate,
    },
    estimatedCustomerChargeCredits: reservation.customer_quote_credits,
    estimatedProviderCostUsd: plan.estimatedProviderCostUsd,
    reservationCredits: reservation.reservation_credits,
    reservationKind: reservation.reservation_kind,
    reservationIsCustomerCharge: false as const,
    estimatedUsage: request.estimatedUsage,
    pricingSnapshot: reservation.pricing_snapshot,
    authoritativeRule: pricingContext.rule,
    profitabilityPolicy,
    dimensions: request.dimensions ?? {},
  } as const;
}

export async function expireBillingQuoteReservation(quoteId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_expire_quote_reservation", { p_quote_id: quoteId });
  if (error) throw error;
  return Boolean(data);
}

export async function acceptBillingQuote(quoteId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_accept_quote", { p_quote_id: quoteId });
  if (error || !data) throw error ?? new Error("BILLING_QUOTE_ACCEPT_FAILED");
}

export async function cancelBillingQuoteReservation(quoteId: string, reason: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_cancel_quote_reservation", {
    p_quote_id: quoteId,
    p_reason: reason,
  });
  if (error || !data) throw error ?? new Error("BILLING_QUOTE_CANCEL_FAILED");
}

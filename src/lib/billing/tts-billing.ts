import "server-only";
import { claimRequest, finalizeRequest } from "@/lib/idempotency";
import { providerTtsStreamExact } from "@/lib/providers";
import { createIdempotencyKey } from "@/lib/security/ids";
import { assertSpendingAllowed } from "@/lib/spending";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBillingProviderRoutes } from "./provider-route";
import { acceptBillingQuote, cancelBillingQuoteReservation, createAndReserveBillingQuote } from "./quote-reservation";
import type { Currency, NormalizedUsage } from "./types";
import { countSubmittedCharacters } from "./audio-usage-core";
import { prepareUsageSettlement } from "./usage-settlement-core";
import { recordBillingShadowValidationBestEffort } from "./shadow-validation";

type ReservedQuote = Awaited<ReturnType<typeof createAndReserveBillingQuote>>;

export type TtsBillingAttempt = Readonly<{
  quote: ReservedQuote;
  billingClaimId: string;
  response: Response;
  providerRequestId?: string;
}>;

function terminalFinancialError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("INSUFFICIENT_CREDITS") || message.includes("SPEND_LIMIT");
}

export async function beginTtsBillingAttempt(input: Readonly<{
  userId: string;
  parentRequestId: string;
  modelId: string;
  text: string;
  voiceId: string;
  languageCode?: string;
  confirmedCost: boolean;
}>) {
  const usage: NormalizedUsage = { characters: countSubmittedCharacters(input.text) };
  const routes = await resolveBillingProviderRoutes(input.modelId);
  let lastError: unknown = new Error("No billable TTS provider route is available.");
  for (const route of routes) {
    const claim = await claimRequest(input.userId, `billing-v2:tts:${input.parentRequestId}`, route.routeId);
    if (!claim.claimed) continue;
    let quote: ReservedQuote | null = null;
    try {
      quote = await createAndReserveBillingQuote({
        userId: input.userId,
        requestIdempotencyId: claim.id,
        modelId: input.modelId,
        providerKey: route.providerKey,
        kind: "deterministic",
        estimatedUsage: usage,
        options: { voiceId: input.voiceId, languageCode: input.languageCode ?? null },
        metadata: { operation: "tts", parent_request_id: input.parentRequestId },
      });
      if (Number(quote.estimatedCustomerChargeCredits) >= 50 && !input.confirmedCost) {
        throw new Error(`COST_CONFIRMATION_REQUIRED:${quote.estimatedCustomerChargeCredits}`);
      }
      await assertSpendingAllowed(input.userId, quote.reservationCredits);
      await acceptBillingQuote(quote.quoteId);
      const upstream = await providerTtsStreamExact(route, input);
      if (!upstream.response.ok || !upstream.response.body) throw new Error(`Provider returned HTTP ${upstream.response.status}`);
      return { quote, billingClaimId: claim.id, response: upstream.response, providerRequestId: upstream.providerRequestId } as const;
    } catch (error) {
      lastError = error;
      if (quote) {
        await cancelBillingQuoteReservation(quote.quoteId, "tts_provider_attempt_failed").catch(() => undefined);
        await recordBillingShadowValidationBestEffort({ phase: "failure", quoteId: quote.quoteId, userId: quote.userId,
          providerKey: quote.route.providerKey, modelId: quote.route.modelId, pricingVersion: quote.pricing.version,
          internalUsdPkrRate: quote.pricing.internalUsdPkrRate, usage: quote.estimatedUsage,
          billingV2ChargeCredits: "0", details: { operation: "tts", reason: "provider_attempt_failed" } });
      }
      await finalizeRequest(claim.id, "failed").catch(() => undefined);
      if (terminalFinancialError(error) || (error instanceof Error && error.message.startsWith("COST_CONFIRMATION_REQUIRED:"))) throw error;
    }
  }
  throw lastError;
}

export async function cancelTtsBillingAttempt(attempt: TtsBillingAttempt, reason: string) {
  await attempt.response.body?.cancel().catch(() => undefined);
  await cancelBillingQuoteReservation(attempt.quote.quoteId, reason).catch(() => undefined);
  await recordBillingShadowValidationBestEffort({ phase: "failure", quoteId: attempt.quote.quoteId, userId: attempt.quote.userId,
    providerKey: attempt.quote.route.providerKey, modelId: attempt.quote.route.modelId, pricingVersion: attempt.quote.pricing.version,
    internalUsdPkrRate: attempt.quote.pricing.internalUsdPkrRate, usage: attempt.quote.estimatedUsage,
    billingV2ChargeCredits: "0", details: { operation: "tts", reason } });
  await finalizeRequest(attempt.billingClaimId, "failed").catch(() => undefined);
}

export async function settleTtsBillingAttempt(input: Readonly<{
  attempt: TtsBillingAttempt;
  text: string;
  providerReportedCost?: Readonly<{ amount: string; currency: Currency }>;
}>) {
  const prepared = prepareUsageSettlement({
    rule: input.attempt.quote.authoritativeRule,
    usage: { characters: countSubmittedCharacters(input.text) },
    dimensions: input.attempt.quote.dimensions,
    internalUsdPkrRate: input.attempt.quote.pricing.internalUsdPkrRate,
    profitabilityPolicy: input.attempt.quote.profitabilityPolicy,
    reservationCredits: input.attempt.quote.reservationCredits,
    providerReportedCost: input.providerReportedCost,
    usageSource: "submitted_text_exact",
    providerRequestId: input.attempt.providerRequestId,
  });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_settle_usage_quote", {
    p_quote_id: input.attempt.quote.quoteId,
    p_capture_idempotency_key: createIdempotencyKey("billing-v2-tts-capture", input.attempt.quote.route.modelId, input.attempt.quote.quoteId),
    p_usage_idempotency_key: createIdempotencyKey("billing-v2-tts-usage", input.attempt.quote.route.modelId, input.attempt.quote.quoteId),
    p_usage: prepared.normalizedUsage,
    p_provider_request_id: input.attempt.providerRequestId ?? null,
    p_provider_task_id: null,
    p_provider_reported_cost: input.providerReportedCost?.amount ?? null,
    p_provider_reported_currency: input.providerReportedCost?.currency ?? null,
    p_calculated_provider_cost_usd: prepared.calculatedProviderCostUsd,
    p_final_provider_cost_usd: prepared.finalProviderCostUsd,
    p_charge_credits: prepared.chargeCredits,
    p_cost_status: prepared.costStatus,
    p_message_id: null,
    p_generation_job_id: null,
    p_raw_usage: { characters: prepared.normalizedUsage.characters, source: "submitted_request" },
    p_usage_snapshot: prepared.usageSnapshot,
    p_metadata: { billing_v2: true, operation: "tts", provider_route_id: input.attempt.quote.route.routeId, reservation_shortfall: !prepared.coverage.covered },
  });
  if (error || !data) throw error ?? new Error("BILLING_TTS_SETTLEMENT_FAILED");
  await finalizeRequest(input.attempt.billingClaimId, "completed", { resourceId: String((data as Record<string, unknown>).receipt_id ?? ""), response: data });
  const result = data as Record<string, unknown>;
  await recordBillingShadowValidationBestEffort({
    phase: "settlement",
    quoteId: input.attempt.quote.quoteId,
    receiptId: String(result.receipt_id),
    userId: input.attempt.quote.userId,
    providerKey: input.attempt.quote.route.providerKey,
    modelId: input.attempt.quote.route.modelId,
    pricingVersion: input.attempt.quote.pricing.version,
    internalUsdPkrRate: input.attempt.quote.pricing.internalUsdPkrRate,
    usage: prepared.normalizedUsage,
    billingV2ChargeCredits: prepared.chargeCredits,
    details: { cost_status: prepared.costStatus, provider_request_id: input.attempt.providerRequestId ?? null },
  });
  return {
    receiptId: String(result.receipt_id),
    usageEventId: String(result.usage_event_id),
    walletTransactionId: String(result.wallet_transaction_id),
    prepared,
  } as const;
}

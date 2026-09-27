import "server-only";
import { claimRequest, finalizeRequest } from "@/lib/idempotency";
import { providerChatStreamExact } from "@/lib/providers";
import type { ChatMessage, NormalizedProviderUsage, ProviderChatResult } from "@/lib/providers/types";
import { createIdempotencyKey } from "@/lib/security/ids";
import { assertSpendingAllowed } from "@/lib/spending";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBillingProviderRoutes } from "./provider-route";
import {
  acceptBillingQuote,
  cancelBillingQuoteReservation,
  createAndReserveBillingQuote,
} from "./quote-reservation";
import { estimateTextUsageForReservation, prepareTextSettlement } from "./text-billing-core";
import { recordBillingShadowValidationBestEffort } from "./shadow-validation";

type ReservedQuote = Awaited<ReturnType<typeof createAndReserveBillingQuote>>;

export type TextBillingAttempt = Readonly<{
  quote: ReservedQuote;
  billingClaimId: string;
  upstream: ProviderChatResult;
}>;

function terminalFinancialError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("INSUFFICIENT_CREDITS") || message.includes("SPEND_LIMIT");
}

export async function beginTextBillingAttempt(input: Readonly<{
  userId: string;
  parentRequestId: string;
  modelId: string;
  textForReservation: string;
  inputOverheadTokens?: number;
  maxOutputTokens: number;
  messages: ChatMessage[];
  temperature?: number;
  deepThink?: boolean;
  allowFallback: boolean;
  operation: "chat" | "prompt_enhancer";
  options?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
}>) {
  const routes = await resolveBillingProviderRoutes(input.modelId);
  const usage = estimateTextUsageForReservation({
    text: input.textForReservation,
    maxOutputTokens: input.maxOutputTokens,
    inputOverheadTokens: input.inputOverheadTokens,
  });
  let lastError: unknown = new Error("No billable provider route is available.");

  for (const [index, route] of routes.entries()) {
    if (index > 0 && !input.allowFallback) break;
    const claim = await claimRequest(
      input.userId,
      `billing-v2:${input.operation}:${input.parentRequestId}`,
      route.routeId,
    );
    if (!claim.claimed) continue;

    let quote: ReservedQuote | null = null;
    try {
      quote = await createAndReserveBillingQuote({
        userId: input.userId,
        requestIdempotencyId: claim.id,
        modelId: input.modelId,
        providerKey: route.providerKey,
        kind: "variable",
        estimatedUsage: usage.estimatedUsage,
        maximumUsage: usage.maximumUsage,
        options: input.options,
        metadata: { operation: input.operation, parent_request_id: input.parentRequestId, ...input.metadata },
      });
      await assertSpendingAllowed(input.userId, quote.reservationCredits);
      await acceptBillingQuote(quote.quoteId);
      const upstream = await providerChatStreamExact(route, {
        messages: input.messages,
        maxTokens: input.maxOutputTokens,
        temperature: input.temperature,
        deepThink: input.deepThink,
      });
      if (!upstream.response.ok || !upstream.response.body) {
        throw new Error(`Provider returned HTTP ${upstream.response.status}`);
      }
      return { quote, billingClaimId: claim.id, upstream } as const;
    } catch (error) {
      lastError = error;
      if (quote) {
        await cancelBillingQuoteReservation(quote.quoteId, "text_provider_attempt_failed").catch(() => undefined);
        await recordBillingShadowValidationBestEffort({ phase: "failure", quoteId: quote.quoteId, userId: quote.userId,
          providerKey: quote.route.providerKey, modelId: quote.route.modelId, pricingVersion: quote.pricing.version,
          internalUsdPkrRate: quote.pricing.internalUsdPkrRate, usage: quote.estimatedUsage,
          billingV2ChargeCredits: "0", details: { operation: input.operation, reason: "provider_attempt_failed" } });
      }
      await finalizeRequest(claim.id, "failed").catch(() => undefined);
      if (terminalFinancialError(error)) throw error;
    }
  }
  throw lastError;
}

export async function cancelTextBillingAttempt(attempt: TextBillingAttempt, reason: string) {
  await cancelBillingQuoteReservation(attempt.quote.quoteId, reason).catch(() => undefined);
  await recordBillingShadowValidationBestEffort({ phase: "failure", quoteId: attempt.quote.quoteId, userId: attempt.quote.userId,
    providerKey: attempt.quote.route.providerKey, modelId: attempt.quote.route.modelId, pricingVersion: attempt.quote.pricing.version,
    internalUsdPkrRate: attempt.quote.pricing.internalUsdPkrRate, usage: attempt.quote.estimatedUsage,
    billingV2ChargeCredits: "0", details: { operation: "text", reason } });
  await finalizeRequest(attempt.billingClaimId, "failed").catch(() => undefined);
}

export async function settleTextBillingAttempt(input: Readonly<{
  attempt: TextBillingAttempt;
  usage: NormalizedProviderUsage;
  messageId?: string | null;
  rawUsage?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
}>) {
  const prepared = prepareTextSettlement({
    rule: input.attempt.quote.authoritativeRule,
    usage: input.usage,
    dimensions: input.attempt.quote.dimensions,
    internalUsdPkrRate: input.attempt.quote.pricing.internalUsdPkrRate,
    profitabilityPolicy: input.attempt.quote.profitabilityPolicy,
    reservationCredits: input.attempt.quote.reservationCredits,
  });
  const admin = createAdminClient();
  const providerCost = input.usage.providerReportedCost;
  const { data, error } = await admin.rpc("billing_settle_usage_quote", {
    p_quote_id: input.attempt.quote.quoteId,
    p_capture_idempotency_key: createIdempotencyKey("billing-v2-text-capture", input.attempt.quote.route.modelId, input.attempt.quote.quoteId),
    p_usage_idempotency_key: createIdempotencyKey("billing-v2-text-usage", input.attempt.quote.route.modelId, input.attempt.quote.quoteId),
    p_usage: prepared.normalizedUsage,
    p_provider_request_id: input.usage.providerRequestId ?? input.attempt.upstream.providerRequestId ?? null,
    p_provider_task_id: null,
    p_provider_reported_cost: providerCost?.amount ?? null,
    p_provider_reported_currency: providerCost?.currency ?? null,
    p_calculated_provider_cost_usd: prepared.calculatedProviderCostUsd,
    p_final_provider_cost_usd: prepared.finalProviderCostUsd,
    p_charge_credits: prepared.chargeCredits,
    p_cost_status: prepared.costStatus,
    p_message_id: input.messageId ?? null,
    p_generation_job_id: null,
    p_raw_usage: input.rawUsage ?? {},
    p_usage_snapshot: prepared.usageSnapshot,
    p_metadata: {
      billing_v2: true,
      provider_route_id: input.attempt.quote.route.routeId,
      reservation_shortfall: !prepared.coverage.covered,
      ...input.metadata,
    },
  });
  if (error || !data) throw error ?? new Error("BILLING_TEXT_SETTLEMENT_FAILED");
  await finalizeRequest(input.attempt.billingClaimId, "completed", {
    resourceId: String((data as Record<string, unknown>).receipt_id ?? ""),
    response: data,
  });
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
    details: { cost_status: prepared.costStatus, provider_request_id: input.usage.providerRequestId ?? null },
  });
  return {
    receiptId: String(result.receipt_id),
    usageEventId: String(result.usage_event_id),
    walletTransactionId: String(result.wallet_transaction_id),
    prepared,
  } as const;
}

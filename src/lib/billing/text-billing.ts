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
import { usesProviderAuthoritativeBilling } from "./billing-v3-settings";
import { createProviderAuthorization, type ProviderAuthorization } from "./authorization";
import { markProviderSettlementPending, recordProviderBillingAnomaly, settleApimodelsTask } from "./provider-authoritative-settlement";

type ReservedQuote = Awaited<ReturnType<typeof createAndReserveBillingQuote>>;

type BillingV2TextAttempt = Readonly<{
  engine: "v2";
  quote: ReservedQuote;
  billingClaimId: string;
  upstream: ProviderChatResult;
}>;

type BillingV3TextAttempt = Readonly<{
  engine: "v3_provider_authoritative";
  authorization: ProviderAuthorization;
  billingClaimId: string;
  upstream: ProviderChatResult;
  providerBillingRecordId: string;
}>;

export type TextBillingAttempt = BillingV2TextAttempt | BillingV3TextAttempt;

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
  const useV3 = await usesProviderAuthoritativeBilling(input.modelId);
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
    let authorization: ProviderAuthorization | null = null;
    let providerStarted = false;
    let providerRequestId: string | undefined;
    try {
      if (useV3) {
        authorization = await createProviderAuthorization({
          userId: input.userId,
          requestIdempotencyId: claim.id,
          route,
          modality: "text",
          usageEnvelope: usage.maximumUsage,
          options: input.options,
          metadata: { operation: input.operation, parent_request_id: input.parentRequestId, ...input.metadata },
        });
        await assertSpendingAllowed(input.userId, authorization.authorizationCredits);
      } else {
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
      }
      const upstream = await providerChatStreamExact(route, {
        messages: input.messages,
        maxTokens: input.maxOutputTokens,
        temperature: input.temperature,
        deepThink: input.deepThink,
      });
      providerStarted = true;
      providerRequestId = upstream.providerRequestId;
      if (!upstream.response.ok || !upstream.response.body) {
        throw new Error(`Provider returned HTTP ${upstream.response.status}`);
      }
      if (useV3) {
        if (!authorization || !upstream.providerRequestId) throw new Error("BILLING_V3_PROVIDER_REQUEST_ID_MISSING");
        const pending = await markProviderSettlementPending({
          quoteId: authorization.quoteId,
          providerRequestId: upstream.providerRequestId,
          source: "response_header",
        });
        return {
          engine: "v3_provider_authoritative",
          authorization,
          billingClaimId: claim.id,
          upstream,
          providerBillingRecordId: pending.ledgerId,
        } as const;
      }
      return { engine: "v2", quote: quote!, billingClaimId: claim.id, upstream } as const;
    } catch (error) {
      lastError = error;
      if (authorization && providerStarted) {
        if (providerRequestId) {
          await markProviderSettlementPending({ quoteId: authorization.quoteId,
            providerRequestId, source: "response_header" }).catch(() => undefined);
        } else {
          await recordProviderBillingAnomaly({ quoteId: authorization.quoteId,
            anomalyType: "provider_record_missing_identifier",
            details: { operation: input.operation, hold_retained: true } }).catch(() => undefined);
        }
      }
      if (authorization && !providerStarted) {
        await cancelBillingQuoteReservation(authorization.quoteId, "text_provider_attempt_failed").catch(() => undefined);
      } else if (quote) {
        await cancelBillingQuoteReservation(quote.quoteId, "text_provider_attempt_failed").catch(() => undefined);
        await recordBillingShadowValidationBestEffort({ phase: "failure", quoteId: quote.quoteId, userId: quote.userId,
          providerKey: quote.route.providerKey, modelId: quote.route.modelId, pricingVersion: quote.pricing.version,
          internalUsdPkrRate: quote.pricing.internalUsdPkrRate, usage: quote.estimatedUsage,
          billingV2ChargeCredits: "0", details: { operation: input.operation, reason: "provider_attempt_failed" } });
      }
      await finalizeRequest(claim.id, providerStarted ? "completed" : "failed", providerStarted
        ? { resourceId: authorization?.quoteId ?? quote?.quoteId, response: { billingStatus: "pending_reconciliation" } }
        : undefined).catch(() => undefined);
      if (providerStarted) throw error;
      if (terminalFinancialError(error)) throw error;
    }
  }
  throw lastError;
}

export async function cancelTextBillingAttempt(attempt: TextBillingAttempt, reason: string) {
  if (attempt.engine === "v3_provider_authoritative") {
    await markProviderSettlementPending({
      quoteId: attempt.authorization.quoteId,
      providerRequestId: attempt.upstream.providerRequestId,
      source: "records_api",
    }).catch(() => undefined);
    await finalizeRequest(attempt.billingClaimId, "completed", {
      resourceId: attempt.authorization.quoteId,
      response: { billingStatus: "pending_reconciliation", reason },
    }).catch(() => undefined);
    return;
  }
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
  if (input.attempt.engine === "v3_provider_authoritative") {
    const requestId = input.usage.providerRequestId ?? input.attempt.upstream.providerRequestId;
    if (!requestId) throw new Error("BILLING_V3_PROVIDER_REQUEST_ID_MISSING");
    try {
      const result = await settleApimodelsTask({
        quoteId: input.attempt.authorization.quoteId,
        taskId: requestId,
        providerRequestId: requestId,
        source: "records_api",
        usage: input.rawUsage,
        links: { messageId: input.messageId },
        metadata: { billing_v3: true, operation: "text", ...input.metadata },
      });
      const status = String((result as Record<string, unknown>).status ?? "pending_reconciliation");
      const chargeCredits = String((result as Record<string, unknown>).charge_credits ?? "0");
      await finalizeRequest(input.attempt.billingClaimId, "completed", {
        resourceId: String((result as Record<string, unknown>).receipt_id ?? input.messageId ?? input.attempt.authorization.quoteId),
        response: { billingStatus: status, chargeCredits },
      });
      return {
        billingStatus: status,
        receiptId: (result as Record<string, unknown>).receipt_id ? String((result as Record<string, unknown>).receipt_id) : undefined,
        usageEventId: (result as Record<string, unknown>).usage_event_id ? String((result as Record<string, unknown>).usage_event_id) : undefined,
        walletTransactionId: (result as Record<string, unknown>).wallet_transaction_id ? String((result as Record<string, unknown>).wallet_transaction_id) : undefined,
        chargeCredits,
      } as const;
    } catch {
      const pending = await markProviderSettlementPending({
        quoteId: input.attempt.authorization.quoteId,
        providerRequestId: requestId,
        source: "records_api",
        links: { messageId: input.messageId },
      });
      await finalizeRequest(input.attempt.billingClaimId, "completed", {
        resourceId: input.messageId ?? input.attempt.authorization.quoteId,
        response: { billingStatus: "pending_reconciliation" },
      });
      return { billingStatus: "pending_reconciliation", providerBillingRecordId: pending.ledgerId, chargeCredits: "0" } as const;
    }
  }
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
    billingStatus: "settled",
    receiptId: String(result.receipt_id),
    usageEventId: String(result.usage_event_id),
    walletTransactionId: String(result.wallet_transaction_id),
    prepared,
    chargeCredits: prepared.chargeCredits,
  } as const;
}

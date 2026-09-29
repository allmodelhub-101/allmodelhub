import "server-only";
import { claimRequest, finalizeRequest } from "@/lib/idempotency";
import { providerChatStreamExact } from "@/lib/providers";
import type { ChatMessage, NormalizedProviderUsage, ProviderChatResult } from "@/lib/providers/types";
import { assertSpendingAllowed } from "@/lib/spending";
import { resolveBillingProviderRoutes } from "./provider-route";
import { cancelBillingQuoteReservation } from "./quote-reservation";
import { estimateTextUsageForReservation } from "./text-billing-core";
import { createProviderAuthorization, type ProviderAuthorization } from "./authorization";
import { markProviderSettlementPending, recordProviderBillingAnomaly, settleApimodelsTask } from "./provider-authoritative-settlement";

type BillingV3TextAttempt = Readonly<{
  engine: "v3_provider_authoritative";
  authorization: ProviderAuthorization;
  billingClaimId: string;
  upstream: ProviderChatResult;
  providerBillingRecordId: string;
}>;

export type TextBillingAttempt = BillingV3TextAttempt;

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
      `billing-v3:${input.operation}:${input.parentRequestId}`,
      route.routeId,
    );
    if (!claim.claimed) continue;

    let authorization: ProviderAuthorization | null = null;
    let providerStarted = false;
    let providerRequestId: string | undefined;
    try {
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
      if (!upstream.providerRequestId) throw new Error("BILLING_V3_PROVIDER_REQUEST_ID_MISSING");
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
      }
      await finalizeRequest(claim.id, providerStarted ? "completed" : "failed", providerStarted
        ? { resourceId: authorization?.quoteId, response: { billingStatus: "pending_reconciliation" } }
        : undefined).catch(() => undefined);
      if (providerStarted) throw error;
      if (terminalFinancialError(error)) throw error;
    }
  }
  throw lastError;
}

export async function cancelTextBillingAttempt(attempt: TextBillingAttempt, reason: string) {
  await markProviderSettlementPending({
    quoteId: attempt.authorization.quoteId,
    providerRequestId: attempt.upstream.providerRequestId,
    source: "records_api",
  }).catch(() => undefined);
  await finalizeRequest(attempt.billingClaimId, "completed", {
    resourceId: attempt.authorization.quoteId,
    response: { billingStatus: "pending_reconciliation", reason },
  }).catch(() => undefined);
}

export async function settleTextBillingAttempt(input: Readonly<{
  attempt: TextBillingAttempt;
  usage: NormalizedProviderUsage;
  messageId?: string | null;
  rawUsage?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
}>) {
  {
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
}

const BACKGROUND_SETTLEMENT_DELAYS_MS = [500, 1_500, 3_000, 5_000] as const;

export async function settleTextBillingInBackground(input: Readonly<{
  attempt: BillingV3TextAttempt;
  usage: NormalizedProviderUsage;
  messageId?: string | null;
  rawUsage?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
}>) {
  const requestId = input.usage.providerRequestId ?? input.attempt.upstream.providerRequestId;
  if (!requestId) return { billingStatus: "pending_reconciliation" } as const;
  for (const delay of BACKGROUND_SETTLEMENT_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const result = await settleApimodelsTask({
        quoteId: input.attempt.authorization.quoteId,
        taskId: requestId,
        providerRequestId: requestId,
        source: "records_api",
        usage: input.rawUsage,
        links: { messageId: input.messageId },
        metadata: { billing_v3: true, operation: "text", background_settlement: true, ...input.metadata },
      });
      const status = String((result as Record<string, unknown>).status ?? "pending_reconciliation");
      if (status !== "pending_reconciliation") {
        await finalizeRequest(input.attempt.billingClaimId, "completed", {
          resourceId: String((result as Record<string, unknown>).receipt_id ?? input.messageId ?? input.attempt.authorization.quoteId),
          response: { billingStatus: status, chargeCredits: (result as Record<string, unknown>).charge_credits },
        }).catch(() => undefined);
        return { billingStatus: status } as const;
      }
    } catch {
      // The daily reconciliation endpoint remains the disaster-recovery path.
    }
  }
  return { billingStatus: "pending_reconciliation" } as const;
}

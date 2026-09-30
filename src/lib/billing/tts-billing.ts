import "server-only";
import { claimRequest, finalizeRequest } from "@/lib/idempotency";
import { providerTtsStreamExact } from "@/lib/providers";
import { assertSpendingAllowed } from "@/lib/spending";
import { resolveBillingProviderRoutes } from "./provider-route";
import { cancelBillingQuoteReservation } from "./quote-reservation";
import type { NormalizedUsage } from "./types";
import { countSubmittedCharacters } from "./audio-usage-core";
import { createProviderAuthorization, type ProviderAuthorization } from "./authorization";
import { markProviderSettlementPending, recordProviderBillingAnomaly, recordProviderBillingObservation, settleApimodelsTask, settleProviderBillingRecord } from "./provider-authoritative-settlement";

type BillingV3TtsAttempt = Readonly<{
  engine: "v3_provider_authoritative";
  authorization: ProviderAuthorization;
  billingClaimId: string;
  response: Response;
  providerRequestId?: string;
  providerBillingRecordId?: string;
  immediateSettlement?: Readonly<Record<string, unknown>>;
}>;

export type TtsBillingAttempt = BillingV3TtsAttempt;

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
    const claim = await claimRequest(input.userId, `billing-v3:tts:${input.parentRequestId}`, route.routeId);
    if (!claim.claimed) continue;
    let authorization: ProviderAuthorization | null = null;
    let providerStarted = false;
    let providerRequestId: string | undefined;
    try {
      authorization = await createProviderAuthorization({
        userId: input.userId, requestIdempotencyId: claim.id, route,
        modality: "audio", usageEnvelope: usage,
        options: { voiceId: input.voiceId, languageCode: input.languageCode ?? null },
        metadata: { operation: "tts", parent_request_id: input.parentRequestId },
      });
      if (Number(authorization.authorizationCredits) >= 50 && !input.confirmedCost) {
        throw new Error(`COST_CONFIRMATION_REQUIRED:${authorization.authorizationCredits}`);
      }
      await assertSpendingAllowed(input.userId, authorization.authorizationCredits);
      const upstream = await providerTtsStreamExact(route, input);
      providerRequestId = upstream.providerRequestId;
      if (!upstream.response.ok || !upstream.response.body) throw new Error(`Provider returned HTTP ${upstream.response.status}`);
      providerStarted = true;
      let providerBillingRecordId: string | undefined;
      let immediateSettlement: Record<string, unknown> | undefined;
      if (upstream.providerReportedCost) {
        providerBillingRecordId = await recordProviderBillingObservation({
          quoteId: authorization.quoteId,
          providerRequestId: upstream.providerRequestId,
          record: {
            taskId: upstream.providerRequestId ?? authorization.quoteId,
            state: "completed", settled: true,
            creditsUsd: upstream.providerReportedCost.amount, currency: "USD", usage,
          },
          source: "response_header",
        });
        immediateSettlement = await settleProviderBillingRecord({
          providerBillingRecordId, usage,
          metadata: { billing_v3: true, operation: "tts", exact_cost_header: true },
        });
      } else if (upstream.providerRequestId) {
        const pending = await markProviderSettlementPending({
          quoteId: authorization.quoteId, providerRequestId: upstream.providerRequestId, source: "response_header",
        });
        providerBillingRecordId = pending.ledgerId;
      } else {
        await recordProviderBillingAnomaly({ quoteId: authorization.quoteId,
          anomalyType: "provider_success_without_billing_identifier",
          details: { operation: "tts", hold_retained: true, response_ok: true,
            request_id_header_present: false, cost_header_present: false } });
      }
      return { engine: "v3_provider_authoritative", authorization, billingClaimId: claim.id,
        response: upstream.response, providerRequestId: upstream.providerRequestId,
        providerBillingRecordId, immediateSettlement } as const;
    } catch (error) {
      lastError = error;
      if (authorization && providerStarted) {
        if (providerRequestId) {
          await markProviderSettlementPending({ quoteId: authorization.quoteId,
            providerRequestId, source: "response_header" }).catch(() => undefined);
        } else {
          await recordProviderBillingAnomaly({ quoteId: authorization.quoteId,
            anomalyType: "provider_record_missing_identifier",
            details: { operation: "tts", hold_retained: true } }).catch(() => undefined);
        }
      }
      if (authorization && !providerStarted) {
        await cancelBillingQuoteReservation(authorization.quoteId, "tts_provider_attempt_failed").catch(() => undefined);
      }
      await finalizeRequest(claim.id, providerStarted ? "completed" : "failed", providerStarted
        ? { resourceId: authorization?.quoteId, response: { billingStatus: "pending_reconciliation" } }
        : undefined).catch(() => undefined);
      if (providerStarted) throw error;
      if (terminalFinancialError(error) || (error instanceof Error && error.message.startsWith("COST_CONFIRMATION_REQUIRED:"))) throw error;
    }
  }
  throw lastError;
}

export async function cancelTtsBillingAttempt(attempt: TtsBillingAttempt, reason: string) {
  await attempt.response.body?.cancel().catch(() => undefined);
  if (!attempt.immediateSettlement && attempt.providerRequestId) await markProviderSettlementPending({ quoteId: attempt.authorization.quoteId,
    providerRequestId: attempt.providerRequestId, source: "records_api" }).catch(() => undefined);
  await finalizeRequest(attempt.billingClaimId, "completed", { resourceId: attempt.authorization.quoteId,
    response: { billingStatus: "pending_reconciliation", reason } }).catch(() => undefined);
}

export async function settleTtsBillingAttempt(input: Readonly<{
  attempt: TtsBillingAttempt;
  text: string;
}>) {
  {
    if (input.attempt.immediateSettlement) {
      const result = input.attempt.immediateSettlement;
      const status = String(result.status ?? "settled");
      const chargeCredits = String(result.charge_credits ?? "0");
      await finalizeRequest(input.attempt.billingClaimId, "completed", {
        resourceId: String(result.receipt_id ?? input.attempt.authorization.quoteId),
        response: { billingStatus: status, chargeCredits },
      });
      return { billingStatus: status, chargeCredits,
        receiptId: result.receipt_id ? String(result.receipt_id) : undefined,
        walletTransactionId: result.wallet_transaction_id ? String(result.wallet_transaction_id) : undefined } as const;
    }
    if (!input.attempt.providerRequestId) {
      await finalizeRequest(input.attempt.billingClaimId, "completed", { resourceId: input.attempt.authorization.quoteId,
        response: { billingStatus: "pending_reconciliation" } });
      return { billingStatus: "pending_reconciliation", chargeCredits: "0" } as const;
    }
    try {
      const result = await settleApimodelsTask({
        quoteId: input.attempt.authorization.quoteId,
        taskId: input.attempt.providerRequestId,
        providerRequestId: input.attempt.providerRequestId,
        source: "records_api",
        usage: { characters: countSubmittedCharacters(input.text) },
        metadata: { billing_v3: true, operation: "tts" },
      });
      const status = String((result as Record<string, unknown>).status ?? "pending_reconciliation");
      const chargeCredits = String((result as Record<string, unknown>).charge_credits ?? "0");
      await finalizeRequest(input.attempt.billingClaimId, "completed", {
        resourceId: String((result as Record<string, unknown>).receipt_id ?? input.attempt.authorization.quoteId),
        response: { billingStatus: status, chargeCredits },
      });
      return {
        billingStatus: status, chargeCredits,
        receiptId: (result as Record<string, unknown>).receipt_id ? String((result as Record<string, unknown>).receipt_id) : undefined,
        walletTransactionId: (result as Record<string, unknown>).wallet_transaction_id ? String((result as Record<string, unknown>).wallet_transaction_id) : undefined,
      } as const;
    } catch {
      await markProviderSettlementPending({ quoteId: input.attempt.authorization.quoteId,
        providerRequestId: input.attempt.providerRequestId, source: "records_api" });
      await finalizeRequest(input.attempt.billingClaimId, "completed", { resourceId: input.attempt.authorization.quoteId,
        response: { billingStatus: "pending_reconciliation" } });
      return { billingStatus: "pending_reconciliation", chargeCredits: "0" } as const;
    }
  }
}

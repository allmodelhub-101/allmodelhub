import "server-only";
import { getApimodelsBillingRecord } from "@/lib/providers/apimodels";
import { ApimodelsBillingRecordError, type ApimodelsBillingRecord } from "@/lib/providers/apimodels-billing-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicSettlementSummary } from "./provider-authoritative-core";

export type ProviderSettlementLink = Readonly<{
  messageId?: string | null;
  generationJobId?: string | null;
}>;

export async function recordProviderBillingObservation(input: Readonly<{
  quoteId: string;
  providerRequestId?: string | null;
  providerTaskId?: string | null;
  record: ApimodelsBillingRecord;
  source: "response_header" | "callback" | "records_api" | "reconciliation";
  rawRecord?: Readonly<Record<string, unknown>>;
  links?: ProviderSettlementLink;
}>) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_v3_record_provider_observation", {
    p_quote_id: input.quoteId,
    p_provider_request_id: input.providerRequestId ?? null,
    p_provider_task_id: input.providerTaskId ?? null,
    p_state: input.record.state,
    p_settled: input.record.settled,
    p_credits_usd: input.record.creditsUsd ?? null,
    p_currency: input.record.currency ?? null,
    p_usage: input.record.usage,
    p_source: input.source,
    p_raw_record: input.rawRecord ?? {},
    p_provider_created_at: input.record.createdAt ?? null,
    p_provider_completed_at: input.record.completedAt ?? null,
    p_message_id: input.links?.messageId ?? null,
    p_generation_job_id: input.links?.generationJobId ?? null,
  });
  if (error || !data) throw error ?? new Error("BILLING_V3_PROVIDER_OBSERVATION_FAILED");
  return String(data);
}

export async function markProviderSettlementPending(input: Readonly<{
  quoteId: string;
  providerRequestId?: string | null;
  providerTaskId?: string | null;
  state?: "pending" | "running";
  source?: "response_header" | "callback" | "records_api" | "reconciliation";
  links?: ProviderSettlementLink;
}>) {
  const taskId = input.providerTaskId ?? input.providerRequestId;
  if (!taskId) throw new Error("BILLING_V3_PROVIDER_ID_REQUIRED");
  const ledgerId = await recordProviderBillingObservation({
    quoteId: input.quoteId,
    providerRequestId: input.providerRequestId,
    providerTaskId: input.providerTaskId,
    source: input.source ?? "records_api",
    record: { taskId, state: input.state ?? "pending", settled: false, usage: {} },
    links: input.links,
  });
  return { ledgerId, ...publicSettlementSummary({ status: "pending_reconciliation" }) } as const;
}

export async function settleProviderBillingRecord(input: Readonly<{
  providerBillingRecordId: string;
  usage?: Readonly<Record<string, unknown>>;
  links?: ProviderSettlementLink;
  metadata?: Readonly<Record<string, unknown>>;
}>) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_v3_settle_provider_record", {
    p_provider_billing_record_id: input.providerBillingRecordId,
    p_usage: input.usage ?? {},
    p_message_id: input.links?.messageId ?? null,
    p_generation_job_id: input.links?.generationJobId ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error || !data) throw error ?? new Error("BILLING_V3_PROVIDER_SETTLEMENT_FAILED");
  return data as Record<string, unknown>;
}

export async function releaseAuthoritativeProviderFailure(input: Readonly<{
  providerBillingRecordId: string;
  generationJobId?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
}>) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_v3_release_authoritative_failure", {
    p_provider_billing_record_id: input.providerBillingRecordId,
    p_generation_job_id: input.generationJobId ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error || !data) throw error ?? new Error("BILLING_V3_PROVIDER_FAILURE_RELEASE_FAILED");
  return data as Record<string, unknown>;
}

export async function recordProviderBillingAnomaly(input: Readonly<{
  quoteId: string;
  providerRequestId?: string | null;
  providerTaskId?: string | null;
  anomalyType: string;
  details?: Readonly<Record<string, unknown>>;
}>) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_v3_record_provider_anomaly", {
    p_quote_id: input.quoteId,
    p_provider_request_id: input.providerRequestId ?? null,
    p_provider_task_id: input.providerTaskId ?? null,
    p_anomaly_type: input.anomalyType,
    p_details: input.details ?? {},
  });
  if (error || !data) throw error ?? new Error("BILLING_V3_PROVIDER_ANOMALY_FAILED");
  return String(data);
}

export async function settleApimodelsTask(input: Readonly<{
  quoteId: string;
  taskId: string;
  providerRequestId?: string | null;
  providerTaskId?: string | null;
  source?: "records_api" | "reconciliation";
  usage?: Readonly<Record<string, unknown>>;
  links?: ProviderSettlementLink;
  metadata?: Readonly<Record<string, unknown>>;
}>) {
  let record: ApimodelsBillingRecord;
  try {
    record = await getApimodelsBillingRecord(input.taskId);
  } catch (error) {
    if (error instanceof ApimodelsBillingRecordError && error.code !== "RECORD_UNAVAILABLE") {
      await recordProviderBillingAnomaly({
        quoteId: input.quoteId,
        providerRequestId: input.providerRequestId,
        providerTaskId: input.providerTaskId,
        anomalyType: `provider_record_${error.code.toLowerCase()}`,
        details: { provider: "apimodels", error_code: error.code },
      }).catch(() => undefined);
    }
    throw error;
  }
  const ledgerId = await recordProviderBillingObservation({
    quoteId: input.quoteId,
    providerRequestId: input.providerRequestId,
    providerTaskId: input.providerTaskId,
    record,
    source: input.source ?? "records_api",
    links: input.links,
  });
  if (!record.settled) return { ledgerId, ...publicSettlementSummary({ status: "pending_reconciliation" }) } as const;
  if (record.state === "failed" || record.state === "cancelled") {
    const result = await releaseAuthoritativeProviderFailure({
      providerBillingRecordId: ledgerId,
      generationJobId: input.links?.generationJobId,
      metadata: input.metadata,
    });
    return { ledgerId, ...result } as const;
  }
  if (record.state !== "completed") return { ledgerId, ...publicSettlementSummary({ status: "pending_reconciliation" }) } as const;
  const result = await settleProviderBillingRecord({
    providerBillingRecordId: ledgerId,
    usage: input.usage,
    links: input.links,
    metadata: input.metadata,
  });
  return { ledgerId, ...result } as const;
}

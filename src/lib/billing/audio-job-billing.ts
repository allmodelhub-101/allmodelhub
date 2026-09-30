import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedUsage } from "./types";
import { recordJobSettlementShadowBestEffort } from "./shadow-validation";

export function audioGenerationUsage(input: Readonly<{
  prompt: string;
  duration?: number;
  references?: number;
}>) {
  return {
    characters: Array.from(input.prompt).length.toString(),
    ...(input.duration === undefined ? {} : { seconds: input.duration.toString() }),
    ...(input.references === undefined ? {} : { references: String(input.references) }),
  } as NormalizedUsage;
}

export async function completeAudioGenerationBilling(input: Readonly<{
  jobId: string;
  usage: NormalizedUsage;
  providerTaskId: string;
  resultJson: Readonly<Record<string, unknown>>;
  resultUrls: string[];
  metadata: Readonly<Record<string, unknown>>;
}>) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_complete_generation_quote", {
    p_job_id: input.jobId,
    p_usage: input.usage,
    p_provider_task_id: input.providerTaskId,
    p_result_json: input.resultJson,
    p_result_urls: input.resultUrls,
    p_metadata: input.metadata,
  });
  if (error || !data) throw error ?? new Error("BILLING_AUDIO_JOB_SETTLEMENT_FAILED");
  const result = data as Record<string, string>;
  await recordJobSettlementShadowBestEffort({ jobId: input.jobId, receiptId: result.receipt_id,
    usage: input.usage, billingV2ChargeCredits: result.charge_credits });
  return result;
}


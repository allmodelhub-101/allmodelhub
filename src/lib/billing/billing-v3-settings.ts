import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type BillingV3Settings = Readonly<{
  enabled: boolean;
  reconciliationEnabled: boolean;
  canaryModels: readonly string[];
}>;

function boolean(value: unknown) {
  return value === true || value === "true";
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export async function getBillingV3Settings(): Promise<BillingV3Settings> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("system_settings").select("key,value").in("key", [
    "billing_v3_provider_authoritative_enabled",
    "billing_v3_canary_models",
    "billing_v3_reconciliation_enabled",
  ]);
  if (error) return { enabled: false, reconciliationEnabled: false, canaryModels: [] };
  const settings = new Map((data ?? []).map((row) => [String(row.key), row.value]));
  return {
    enabled: boolean(settings.get("billing_v3_provider_authoritative_enabled")),
    reconciliationEnabled: boolean(settings.get("billing_v3_reconciliation_enabled")),
    canaryModels: strings(settings.get("billing_v3_canary_models")),
  };
}

export async function usesProviderAuthoritativeBilling(modelId: string) {
  const settings = await getBillingV3Settings();
  return settings.enabled || settings.canaryModels.includes(modelId);
}

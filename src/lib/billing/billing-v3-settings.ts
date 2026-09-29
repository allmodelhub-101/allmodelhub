import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type BillingV3Settings = Readonly<{
  enabled: true;
  reconciliationEnabled: boolean;
  canaryModels: readonly [];
}>;

function boolean(value: unknown) {
  return value === true || value === "true";
}

export async function getBillingV3Settings(): Promise<BillingV3Settings> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("system_settings").select("key,value").in("key", [
    "billing_v3_reconciliation_enabled",
  ]);
  if (error) return { enabled: true, reconciliationEnabled: false, canaryModels: [] };
  const settings = new Map((data ?? []).map((row) => [String(row.key), row.value]));
  return {
    enabled: true,
    reconciliationEnabled: boolean(settings.get("billing_v3_reconciliation_enabled")),
    canaryModels: [],
  };
}

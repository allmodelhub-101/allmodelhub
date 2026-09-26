import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BillingRouteUnavailableError,
  listBillingProviderRoutes,
  selectBillingProviderRoute,
  type BillingProviderRouteRow,
} from "./provider-route-core";

export async function resolveBillingProviderRoute(input: Readonly<{ modelId: string; providerKey?: string }>) {
  const admin = createAdminClient();
  let query = admin
    .from("provider_models")
    .select("id,model_id,provider_key,upstream_model,priority,active,metadata")
    .eq("model_id", input.modelId)
    .eq("active", true);
  if (input.providerKey) query = query.eq("provider_key", input.providerKey);
  const { data, error } = await query.order("priority", { ascending: true });
  if (error) {
    throw new BillingRouteUnavailableError("ROUTE_NOT_FOUND", "The provider route registry could not be loaded.");
  }
  return selectBillingProviderRoute((data ?? []) as BillingProviderRouteRow[], input);
}

export async function resolveBillingProviderRoutes(modelId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("provider_models")
    .select("id,model_id,provider_key,upstream_model,priority,active,metadata")
    .eq("model_id", modelId)
    .eq("active", true)
    .order("priority", { ascending: true });
  if (error) {
    throw new BillingRouteUnavailableError("ROUTE_NOT_FOUND", "The provider route registry could not be loaded.");
  }
  return listBillingProviderRoutes((data ?? []) as BillingProviderRouteRow[], modelId);
}

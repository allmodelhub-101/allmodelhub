import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export {
  DEFAULT_INTERNAL_USD_PKR,
  actualTextCredits,
  creditsFromUsd,
  estimateMediaCredits,
  estimateTextHold,
  mediaSupplierUsd,
  textSupplierUsd
} from "@/lib/pricing-shared";
import { DEFAULT_INTERNAL_USD_PKR } from "@/lib/pricing-shared";

export async function getInternalUsdPkr() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("system_settings").select("value").eq("key", "internal_usd_pkr").maybeSingle();
    if (error || data?.value === undefined || data?.value === null) return DEFAULT_INTERNAL_USD_PKR;
    const value = Number(data.value);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_INTERNAL_USD_PKR;
  } catch {
    return DEFAULT_INTERNAL_USD_PKR;
  }
}

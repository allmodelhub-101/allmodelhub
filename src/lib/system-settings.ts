import { createAdminClient } from "@/lib/supabase/admin";

async function getNumericSetting(key: string, fallback: number) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("system_settings").select("value").eq("key", key).maybeSingle();
    if (error || data?.value === undefined || data?.value === null) return fallback;
    const value = Number(data.value);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function getMinimumTopupPkr() {
  return getNumericSetting("min_topup_pkr", 500);
}

export function getWelcomeCredits() {
  return getNumericSetting("welcome_credits", Number(process.env.WELCOME_CREDITS || 10));
}
